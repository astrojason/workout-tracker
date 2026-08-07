import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, orderBy, limit, Timestamp, deleteDoc, onSnapshot, writeBatch,
  type CollectionReference, type DocumentReference,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Program, Workout, Exercise, UserSettings, WorkoutSessionDoc,
  CompletedSet, PersonalRecordDoc, PRResult, UserEquipmentConfig, ExerciseDefinition,
  EquipmentType, ProgressionRule,
} from "./types";

// ── Path helpers ──

function userRef(userId: string) {
  return doc(db, "users", userId);
}
function settingsRef(userId: string) {
  return doc(db, "users", userId, "settings", "prefs");
}
function equipmentRef(userId: string) {
  return doc(db, "users", userId, "settings", "equipment");
}
function programsCol(userId: string) {
  return collection(db, "users", userId, "programs");
}
function workoutsCol(userId: string) {
  return collection(db, "users", userId, "workouts");
}
function sessionsCol(userId: string) {
  return collection(db, "users", userId, "sessions");
}
function prsCol(userId: string) {
  return collection(db, "users", userId, "personalRecords");
}
function exerciseDefinitionsCol(userId: string) {
  return collection(db, "users", userId, "exerciseDefinitions");
}

// ── Settings ──

export async function getSettings(userId: string): Promise<UserSettings> {
  const snap = await getDoc(settingsRef(userId));
  const defaults: UserSettings = {
    defaultRestSeconds: 120,
    soundEnabled: true,
    currentWeeks: {},
  };
  // Merge over defaults rather than trusting the doc as fully-formed — a
  // partial write (e.g. an early updateSettings() merge call before the doc
  // ever existed) would otherwise return an object missing required fields
  // like currentWeeks, crashing anything that indexes into it.
  if (snap.exists()) return { ...defaults, ...snap.data() } as UserSettings;
  await setDoc(settingsRef(userId), defaults);
  return defaults;
}

export async function updateSettings(userId: string, updates: Partial<UserSettings>) {
  await setDoc(settingsRef(userId), updates, { merge: true });
}

// ── Equipment config ──

// Returns null when no equipment doc exists yet; callers fall back to DEFAULT_EQUIPMENT_CONFIG.
export async function getEquipmentConfig(userId: string): Promise<UserEquipmentConfig | null> {
  const snap = await getDoc(equipmentRef(userId));
  if (!snap.exists()) return null;
  return snap.data() as UserEquipmentConfig;
}

// Full replacement (not merge) — plates array is order-dependent and must be stored atomically.
export async function saveEquipmentConfig(userId: string, config: UserEquipmentConfig): Promise<void> {
  await setDoc(equipmentRef(userId), config);
}

// ── Programs ──

export async function getPrograms(userId: string): Promise<Program[]> {
  const snap = await getDocs(programsCol(userId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Program));
}

export async function saveProgram(userId: string, program: Omit<Program, "id"> & { id?: string }) {
  const id = program.id || program.name.toLowerCase().replace(/\s+/g, "-");
  await setDoc(doc(programsCol(userId), id), {
    name: program.name,
    totalWeeks: program.totalWeeks,
    createdAt: program.createdAt || Timestamp.now(),
    archived: program.archived ?? false,
  });
  return id;
}

export async function setProgramArchived(userId: string, programId: string, archived: boolean) {
  await updateDoc(doc(programsCol(userId), programId), { archived });
}

export async function deleteProgramDoc(userId: string, programId: string) {
  await deleteDoc(doc(programsCol(userId), programId));
}

export async function deleteAllWorkoutsForProgram(userId: string, programId: string) {
  const q = query(workoutsCol(userId), where("programId", "==", programId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
}

// Firestore batched writes cap out at 500 ops; chunk conservatively below that.
const BATCH_CHUNK_SIZE = 400;

async function commitBatchUpdates(updates: { ref: DocumentReference; data: Record<string, unknown> }[]) {
  for (let i = 0; i < updates.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const { ref, data } of updates.slice(i, i + BATCH_CHUNK_SIZE)) {
      batch.update(ref, data);
    }
    await batch.commit();
  }
}

// Renaming a program must not disconnect its workouts/history, which are
// queried by programId — only the denormalized display copy needs updating.
export async function renameProgram(userId: string, programId: string, newName: string): Promise<void> {
  await updateDoc(doc(programsCol(userId), programId), { name: newName });
  await cascadeProgramName(workoutsCol(userId), programId, newName);
  await cascadeProgramName(sessionsCol(userId), programId, newName);
}

async function cascadeProgramName(col: CollectionReference, programId: string, newName: string) {
  const snap = await getDocs(query(col, where("programId", "==", programId)));
  await commitBatchUpdates(snap.docs.map((d) => ({ ref: d.ref, data: { programName: newName } })));
}

// One-time, idempotent backfill: adds programId to legacy Workout/WorkoutSessionDoc
// docs that predate the field, matched by their current programName. Only ever
// links docs to a program that still exists — never guesses.
export async function migrateProgramIds(userId: string, programs: Program[]): Promise<void> {
  const idByName = new Map(programs.map((p) => [p.name, p.id]));
  await backfillProgramId(workoutsCol(userId), idByName);
  await backfillProgramId(sessionsCol(userId), idByName);
}

async function backfillProgramId(col: CollectionReference, idByName: Map<string, string>) {
  const snap = await getDocs(col);
  const updates = snap.docs
    .filter((d) => !d.data().programId && idByName.has(d.data().programName))
    .map((d) => ({ ref: d.ref, data: { programId: idByName.get(d.data().programName)! } }));
  await commitBatchUpdates(updates);
}

// One-time, idempotent migration: replaces each workout's embedded exercise metadata
// (name, equipment, progression rule, weight) with a definitionId reference into the
// global exercise library. Unifies same-named exercises across EVERY one of the
// user's programs (not just within one program), so a weight change or progression
// update propagates everywhere that exercise appears — including days/weeks/programs
// that predate the exercise library.
//
// Legacy exercises are matched to a definition by name (first occurrence encountered
// wins for equipment/progression-rule metadata). currentWeight is seeded from the most
// recent COMPLETED set logged for that name across all session history, falling back to
// whatever that occurrence's planned weight was if nothing has been logged yet.
interface LegacyExercise {
  id: string;
  definitionId?: string;
  order: number;
  phase: string;
  name?: string;
  equipmentType?: EquipmentType;
  equipmentDetail?: string | null;
  baseWeight?: { type: "fixed"; value: number } | { type: "progressive" };
  totalWeight?: number;
  sets: number;
  repMin: number;
  repMax: unknown;
  restSeconds: number;
  progressionRule?: ProgressionRule;
  isUnilateral?: boolean;
  isTimeBased?: boolean;
  notes: string | null;
  lastSetAmrap?: boolean;
  restAfter?: false | number;
}

function legacyPlannedWeight(e: LegacyExercise): number {
  if (!e.baseWeight) return e.totalWeight ?? 0;
  return e.baseWeight.type === "fixed" ? e.baseWeight.value : (e.totalWeight ?? 0);
}

export async function migrateToExerciseLibrary(userId: string): Promise<void> {
  const workoutsSnap = await getDocs(workoutsCol(userId));
  const workoutDocs = workoutsSnap.docs.map((d) => ({
    ref: d.ref,
    exercises: (d.data().exercises || []) as LegacyExercise[],
  }));

  const needsMigration = workoutDocs.some((w) => w.exercises.some((e) => !e.definitionId));
  if (!needsMigration) return;

  // Most recent completed weight logged for each exercise name, across all history.
  const sessionsSnap = await getDocs(query(sessionsCol(userId), orderBy("date", "desc")));
  const lastWeightByName = new Map<string, number>();
  for (const d of sessionsSnap.docs) {
    const session = d.data() as WorkoutSessionDoc;
    for (const set of session.sets || []) {
      if (!set.completed) continue;
      const key = set.exerciseName.trim().toLowerCase();
      if (!lastWeightByName.has(key)) lastWeightByName.set(key, set.actualWeight);
    }
  }

  const existingDefs = await getExerciseDefinitions(userId);
  const defByName = new Map(existingDefs.map((d) => [d.name.trim().toLowerCase(), d.id]));

  // First pass: create/find one definition per unique legacy exercise name.
  for (const { exercises } of workoutDocs) {
    for (const e of exercises) {
      if (e.definitionId || !e.name) continue;
      const key = e.name.trim().toLowerCase();
      if (defByName.has(key)) continue;
      const seedWeight = lastWeightByName.get(key) ?? legacyPlannedWeight(e);
      const id = await createExerciseDefinition(userId, {
        name: e.name,
        muscleGroups: [],
        equipmentType: e.equipmentType ?? "bodyweight",
        equipmentDetail: e.equipmentDetail ?? null,
        progressionRule: e.progressionRule ?? "none",
        isUnilateral: e.isUnilateral ?? false,
        isTimeBased: e.isTimeBased ?? false,
        currentWeight: seedWeight,
        hardStreak: 0,
      });
      defByName.set(key, id);
    }
  }

  // Second pass: rewrite each workout doc's exercises to slim occurrences.
  const updates: { ref: DocumentReference; data: Record<string, unknown> }[] = [];
  for (const { ref, exercises } of workoutDocs) {
    if (!exercises.some((e) => !e.definitionId)) continue; // already fully migrated
    const rewritten = exercises.map((e) => {
      if (e.definitionId) return e;
      const key = (e.name || "").trim().toLowerCase();
      const definitionId = defByName.get(key)!;
      const occurrence: Exercise = {
        id: e.id,
        definitionId,
        order: e.order,
        phase: e.phase as Exercise["phase"],
        sets: e.sets,
        repMin: e.repMin,
        repMax: e.repMax as Exercise["repMax"],
        restSeconds: e.restSeconds,
        notes: e.notes,
        ...(e.lastSetAmrap ? { lastSetAmrap: true } : {}),
        ...(e.restAfter !== undefined ? { restAfter: e.restAfter } : {}),
      };
      return occurrence;
    });
    updates.push({ ref, data: { exercises: rewritten } });
  }
  await commitBatchUpdates(updates);
}

// ── Workouts (exercise definitions by program/week/day) ──

function workoutDocId(programId: string, week: number, day: string): string {
  return `${programId}_${week}_${day}`;
}

async function getWorkout(
  userId: string, programId: string, week: number, day: string
): Promise<Workout | null> {
  const id = workoutDocId(programId, week, day);
  const snap = await getDoc(doc(workoutsCol(userId), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Workout;
}

export async function getWorkoutsForProgram(
  userId: string, programId: string, week: number
): Promise<Workout[]> {
  const q = query(
    workoutsCol(userId),
    where("programId", "==", programId),
    where("week", "==", week)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Workout));
}

async function getAllWorkoutsForProgram(
  userId: string, programId: string
): Promise<Workout[]> {
  const q = query(workoutsCol(userId), where("programId", "==", programId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Workout));
}

export async function saveWorkout(userId: string, workout: Workout) {
  const id = workoutDocId(workout.programId, workout.week, workout.dayOfWeek);
  await setDoc(doc(workoutsCol(userId), id), {
    programId: workout.programId,
    programName: workout.programName,
    week: workout.week,
    dayOfWeek: workout.dayOfWeek,
    exercises: workout.exercises,
    ...(workout.isChecklist !== undefined && { isChecklist: workout.isChecklist }),
  });
}

// ── Sessions (completed workout history) ──

export async function saveSession(userId: string, session: Omit<WorkoutSessionDoc, "id">) {
  const ref = await addDoc(sessionsCol(userId), {
    ...session,
    date: Timestamp.now(),
  });
  return ref.id;
}

export async function getTodayChecklistSession(
  userId: string, programId: string, dayOfWeek: string
): Promise<(WorkoutSessionDoc & { firestoreId: string }) | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use single equality filter only — no orderBy — to avoid composite index requirement.
  // Filter dayOfWeek and today's date entirely client-side.
  const q = query(
    sessionsCol(userId),
    where("programId", "==", programId),
  );
  const snap = await getDocs(q);
  let best: (WorkoutSessionDoc & { firestoreId: string }) | null = null;
  for (const d of snap.docs) {
    const data = d.data() as WorkoutSessionDoc;
    if (data.dayOfWeek !== dayOfWeek) continue;
    const sessionDate = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date as unknown as string);
    if (sessionDate < today) continue;
    // Keep the most recent match
    if (!best) {
      best = { ...data, firestoreId: d.id };
    } else {
      const bestDate = best.date instanceof Timestamp ? best.date.toDate() : new Date(best.date as unknown as string);
      if (sessionDate > bestDate) {
        best = { ...data, firestoreId: d.id };
      }
    }
  }
  return best;
}

export async function upsertChecklistSession(
  userId: string,
  firestoreId: string | null,
  session: Omit<WorkoutSessionDoc, "id">
): Promise<string> {
  if (firestoreId) {
    const ref = doc(sessionsCol(userId), firestoreId);
    await setDoc(ref, { ...session, date: Timestamp.now() });
    return firestoreId;
  }
  const ref = await addDoc(sessionsCol(userId), {
    ...session,
    date: Timestamp.now(),
  });
  return ref.id;
}

export async function getSessions(
  userId: string, limitCount: number = 50
): Promise<WorkoutSessionDoc[]> {
  const q = query(sessionsCol(userId), orderBy("date", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutSessionDoc));
}

export function subscribeToSessions(
  userId: string,
  limitCount: number,
  callback: (sessions: WorkoutSessionDoc[]) => void
): () => void {
  const q = query(sessionsCol(userId), orderBy("date", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutSessionDoc)));
  });
}

export async function getSession(
  userId: string, sessionId: string
): Promise<WorkoutSessionDoc | null> {
  const snap = await getDoc(doc(sessionsCol(userId), sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as WorkoutSessionDoc;
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  await deleteDoc(doc(sessionsCol(userId), sessionId));
}

export async function getCompletedDays(
  userId: string, programId: string, week: number, since?: Date
): Promise<Set<string>> {
  const q = query(
    sessionsCol(userId),
    where("programId", "==", programId),
    where("week", "==", week),
    where("completed", "==", true)
  );
  const snap = await getDocs(q);
  const days = new Set<string>();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (!data.dayOfWeek) return;
    const sessionDate = data.date instanceof Timestamp
      ? data.date.toDate()
      : new Date(data.date);
    if (since && sessionDate < since) return;
    days.add(sessionDate.toLocaleDateString("en-CA")); // YYYY-MM-DD in local time
  });
  return days;
}

export async function getSessionsForWeek(
  userId: string, programId: string, week: number
): Promise<WorkoutSessionDoc[]> {
  const q = query(
    sessionsCol(userId),
    where("programId", "==", programId),
    where("week", "==", week)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutSessionDoc));
}

// Matches by definitionId when a set has one — reliable across exercise renames,
// since the id never changes even when the definition's display name does.
// Legacy sets logged before CompletedSet carried a definitionId fall back to a
// name match; those can't be rename-proofed retroactively without a backfill.
function matchesExercise(set: CompletedSet, exerciseName: string, definitionId: string | null): boolean {
  if (definitionId && set.definitionId) return set.definitionId === definitionId;
  return set.exerciseName === exerciseName;
}

export async function getExerciseHistory(
  userId: string, exerciseName: string, definitionId: string | null = null, limitCount: number = 50
): Promise<{ date: Date; weight: number; reps: number; volume: number; isTimeBased?: boolean; isBodyweight?: boolean }[]> {
  const q = query(sessionsCol(userId), orderBy("date", "desc"), limit(limitCount));
  const snap = await getDocs(q);

  const results: { date: Date; weight: number; reps: number; volume: number; isTimeBased?: boolean; isBodyweight?: boolean }[] = [];

  for (const d of snap.docs) {
    const session = d.data() as WorkoutSessionDoc;
    const date = session.date instanceof Timestamp ? session.date.toDate() : new Date(session.date as unknown as string);
    const sets = (session.sets || []).filter(
      (s) => matchesExercise(s, exerciseName, definitionId) && s.completed
    );
    if (sets.length === 0) continue;

    const timeBased = sets[0].isTimeBased === true;
    const bodyweight = !timeBased && sets[0].equipmentType === "bodyweight";

    // For weighted: pick heaviest set. For time/bodyweight: pick highest reps.
    const best = timeBased || bodyweight
      ? sets.reduce((top, s) => s.actualReps > top.actualReps ? s : top, sets[0])
      : sets.reduce((top, s) => s.actualWeight > top.actualWeight ? s : top, sets[0]);

    results.push({
      date,
      weight: best.actualWeight,
      reps: best.actualReps,
      volume: best.actualWeight * best.actualReps,
      isTimeBased: timeBased || undefined,
      isBodyweight: bodyweight || undefined,
    });
  }

  return results.reverse();
}

// ── Personal Records ──

function prDocId(exerciseName: string, recordType: string): string {
  return `${exerciseName}_${recordType}`;
}

export async function getPR(
  userId: string, exerciseName: string, recordType: string
): Promise<number | null> {
  const snap = await getDoc(doc(prsCol(userId), prDocId(exerciseName, recordType)));
  if (!snap.exists()) return null;
  return (snap.data() as PersonalRecordDoc).value;
}

export async function savePR(
  userId: string, exerciseName: string, recordType: string, value: number
) {
  await setDoc(doc(prsCol(userId), prDocId(exerciseName, recordType)), {
    exerciseName,
    recordType,
    value,
    date: Timestamp.now(),
  });
}

// ── Exercise Definitions (global per-user exercise library) ──

export async function getExerciseDefinitions(userId: string): Promise<ExerciseDefinition[]> {
  const snap = await getDocs(exerciseDefinitionsCol(userId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExerciseDefinition));
}

export async function getExerciseDefinition(
  userId: string, definitionId: string
): Promise<ExerciseDefinition | null> {
  const snap = await getDoc(doc(exerciseDefinitionsCol(userId), definitionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ExerciseDefinition;
}

// Case-insensitive/trimmed match against existing definitions by display name.
// No normalized-name field is stored — comparison happens live so the join key
// everywhere else stays the Firestore-generated id, which is always distinct.
export async function findExerciseDefinitionByName(
  userId: string, name: string
): Promise<ExerciseDefinition | null> {
  const target = name.trim().toLowerCase();
  const all = await getExerciseDefinitions(userId);
  return all.find((d) => d.name.trim().toLowerCase() === target) ?? null;
}

export async function createExerciseDefinition(
  userId: string, definition: Omit<ExerciseDefinition, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(exerciseDefinitionsCol(userId), {
    ...definition,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

// Metadata-only update (name, muscle groups, equipment, progression rule) — never touches
// currentWeight/hardStreak so re-imports and library edits can't clobber in-progress weight.
export async function updateExerciseDefinitionMeta(
  userId: string,
  definitionId: string,
  updates: Partial<Pick<ExerciseDefinition, "name" | "muscleGroups" | "equipmentType" | "equipmentDetail" | "progressionRule" | "isUnilateral" | "isTimeBased">>
): Promise<void> {
  await updateDoc(doc(exerciseDefinitionsCol(userId), definitionId), {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function updateExerciseDefinitionWeight(
  userId: string,
  definitionId: string,
  currentWeight: number,
  hardStreak: number
): Promise<void> {
  await updateDoc(doc(exerciseDefinitionsCol(userId), definitionId), {
    currentWeight,
    hardStreak,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteExerciseDefinition(userId: string, definitionId: string): Promise<void> {
  await deleteDoc(doc(exerciseDefinitionsCol(userId), definitionId));
}
