import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, orderBy, limit, Timestamp, deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Program, Workout, Exercise, UserSettings, WorkoutSessionDoc,
  CompletedSet, PersonalRecordDoc, PRResult,
} from "./types";

// ── Path helpers ──

function userRef(userId: string) {
  return doc(db, "users", userId);
}
function settingsRef(userId: string) {
  return doc(db, "users", userId, "settings", "prefs");
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

// ── Settings ──

export async function getSettings(userId: string): Promise<UserSettings> {
  const snap = await getDoc(settingsRef(userId));
  if (snap.exists()) return snap.data() as UserSettings;
  const defaults: UserSettings = {
    defaultRestSeconds: 120,
    soundEnabled: true,
    currentWeeks: {},
  };
  await setDoc(settingsRef(userId), defaults);
  return defaults;
}

export async function updateSettings(userId: string, updates: Partial<UserSettings>) {
  await setDoc(settingsRef(userId), updates, { merge: true });
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
  });
  return id;
}

// ── Workouts (exercise definitions by program/week/day) ──

function workoutDocId(programName: string, week: number, day: string): string {
  return `${programName.toLowerCase().replace(/\s+/g, "-")}_${week}_${day}`;
}

export async function getWorkout(
  userId: string, programName: string, week: number, day: string
): Promise<Workout | null> {
  const id = workoutDocId(programName, week, day);
  const snap = await getDoc(doc(workoutsCol(userId), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Workout;
}

export async function getWorkoutsForProgram(
  userId: string, programName: string, week: number
): Promise<Workout[]> {
  const q = query(
    workoutsCol(userId),
    where("programName", "==", programName),
    where("week", "==", week)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Workout));
}

export async function getAllWorkoutsForProgram(
  userId: string, programName: string
): Promise<Workout[]> {
  const q = query(workoutsCol(userId), where("programName", "==", programName));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Workout));
}

export async function saveWorkout(userId: string, workout: Workout) {
  const id = workoutDocId(workout.programName, workout.week, workout.dayOfWeek);
  await setDoc(doc(workoutsCol(userId), id), {
    programName: workout.programName,
    week: workout.week,
    dayOfWeek: workout.dayOfWeek,
    exercises: workout.exercises,
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

export async function getSessions(
  userId: string, limitCount: number = 50
): Promise<WorkoutSessionDoc[]> {
  const q = query(sessionsCol(userId), orderBy("date", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutSessionDoc));
}

export async function getCompletedDays(
  userId: string, programName: string, week: number
): Promise<Set<string>> {
  const q = query(
    sessionsCol(userId),
    where("programName", "==", programName),
    where("week", "==", week),
    where("completed", "==", true)
  );
  const snap = await getDocs(q);
  const days = new Set<string>();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.dayOfWeek) days.add(data.dayOfWeek);
  });
  return days;
}

export async function getLastSetsForExercise(
  userId: string, exerciseName: string
): Promise<CompletedSet[]> {
  // Get most recent session containing this exercise
  const q = query(sessionsCol(userId), orderBy("date", "desc"), limit(20));
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const session = d.data() as WorkoutSessionDoc;
    const sets = (session.sets || []).filter((s) => s.exerciseName === exerciseName);
    if (sets.length > 0) return sets;
  }
  return [];
}

export async function getExerciseHistory(
  userId: string, exerciseName: string, limitCount: number = 50
): Promise<{ date: Date; weight: number; reps: number; volume: number }[]> {
  const q = query(sessionsCol(userId), orderBy("date", "desc"), limit(limitCount));
  const snap = await getDocs(q);

  const results: { date: Date; weight: number; reps: number; volume: number }[] = [];

  for (const d of snap.docs) {
    const session = d.data() as WorkoutSessionDoc;
    const date = session.date instanceof Timestamp ? session.date.toDate() : new Date(session.date as unknown as string);
    const sets = (session.sets || []).filter(
      (s) => s.exerciseName === exerciseName && s.completed
    );
    for (const s of sets) {
      results.push({
        date,
        weight: s.actualWeight,
        reps: s.actualReps,
        volume: s.actualWeight * s.actualReps,
      });
    }
  }

  return results.reverse();
}

export async function getAllExerciseNames(userId: string): Promise<string[]> {
  const q = query(sessionsCol(userId), orderBy("date", "desc"), limit(100));
  const snap = await getDocs(q);
  const names = new Set<string>();
  snap.docs.forEach((d) => {
    const session = d.data() as WorkoutSessionDoc;
    (session.sets || []).forEach((s) => names.add(s.exerciseName));
  });
  return Array.from(names).sort();
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
