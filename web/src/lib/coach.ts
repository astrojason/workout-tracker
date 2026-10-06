import type { CompletedSet, Workout, WorkoutSessionDoc } from "./types";

// ── Input sent to the coach ──

export interface CoachSetResult {
  exerciseName: string;
  setNumber: number;
  targetWeight: number;
  actualWeight: number;
  targetReps: number;
  actualReps: number;
  completed: boolean;
  rating?: "easy" | "normal" | "hard";
}

export interface CoachUpcomingWorkout {
  week: number;
  dayOfWeek: string;
  exercises: { name: string; sets: number; repMin: number; repMax: string; weight: number }[];
}

export interface CoachInput {
  programName: string;
  week: number;
  dayOfWeek: string;
  durationSeconds: number;
  sets: CoachSetResult[];
  prs: { exerciseName: string; type: string; value: number }[];
  recentSessions: { date: string; dayOfWeek: string; sets: CoachSetResult[] }[];
  upcoming: CoachUpcomingWorkout[];
}

// ── Output from the coach ──

export type CoachField = "weight" | "sets" | "repMin";

export interface CoachAdjustment {
  exerciseName: string;
  field: CoachField;
  to: number;
  reason: string;
}

export interface CoachResponse {
  feedback: string;
  adjustments: CoachAdjustment[];
}

export const COACH_SYSTEM_PROMPT =
  "You are a strength coach reviewing a lifter's finished workout. Give brief, specific feedback " +
  "(2-4 sentences) and, only where the data clearly supports it, propose small adjustments to future " +
  "workouts. Never propose more than one change per exercise and field. Weight is in lbs. " +
  "Ratings: 'easy' means the set felt easy, 'hard' means near failure. Prefer no adjustment over a guess. " +
  "Respond only by calling the submit_coaching tool.";

export const COACH_TOOL = {
  name: "submit_coaching",
  description: "Submit coaching feedback and suggested adjustments to upcoming workouts.",
  input_schema: {
    type: "object",
    properties: {
      feedback: { type: "string" },
      adjustments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            exerciseName: { type: "string", description: "Exact exercise name from the data" },
            field: { type: "string", enum: ["weight", "sets", "repMin"] },
            to: { type: "number", description: "New value (weight in lbs, set count, or minimum reps)" },
            reason: { type: "string" },
          },
          required: ["exerciseName", "field", "to", "reason"],
        },
      },
    },
    required: ["feedback", "adjustments"],
  },
};

function fmtSets(sets: CoachSetResult[]): string {
  return sets
    .map(
      (s) =>
        `  ${s.exerciseName} set ${s.setNumber}: ${s.completed ? "done" : "skipped"}, ` +
        `${s.actualReps}/${s.targetReps} reps @ ${s.actualWeight} lbs (target ${s.targetWeight})` +
        (s.rating ? `, felt ${s.rating}` : ""),
    )
    .join("\n");
}

export function buildCoachPrompt(input: CoachInput): string {
  const parts: string[] = [];
  parts.push(
    `Program: ${input.programName} — week ${input.week}, ${input.dayOfWeek}. ` +
      `Duration ${Math.round(input.durationSeconds / 60)} min.`,
  );
  parts.push(`Today's results:\n${fmtSets(input.sets)}`);
  if (input.prs.length) {
    parts.push(`PRs today: ${input.prs.map((p) => `${p.exerciseName} ${p.type} ${p.value}`).join("; ")}`);
  }
  if (input.recentSessions.length) {
    parts.push(
      "Recent sessions (newest first):\n" +
        input.recentSessions.map((s) => `${s.date} ${s.dayOfWeek}\n${fmtSets(s.sets)}`).join("\n"),
    );
  }
  if (input.upcoming.length) {
    parts.push(
      "Upcoming workouts you may adjust:\n" +
        input.upcoming
          .map(
            (u) =>
              `Week ${u.week} ${u.dayOfWeek}: ` +
              u.exercises.map((e) => `${e.name} ${e.sets}x${e.repMin}-${e.repMax} @ ${e.weight}`).join("; "),
          )
          .join("\n"),
    );
  }
  return parts.join("\n\n");
}

const LIMITS: Record<CoachField, [number, number]> = {
  weight: [0, 2000],
  sets: [1, 10],
  repMin: [1, 50],
};

// The model's output is untrusted: keep only well-formed adjustments for exercises we know about.
export function validateCoachResponse(raw: unknown, knownExercises: string[]): CoachResponse {
  if (!raw || typeof raw !== "object" || typeof (raw as { feedback?: unknown }).feedback !== "string") {
    throw new Error("Coach returned a malformed response");
  }
  const r = raw as { feedback: string; adjustments?: unknown };
  const list = Array.isArray(r.adjustments) ? r.adjustments : [];
  const adjustments: CoachAdjustment[] = [];
  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    const { exerciseName, field, to, reason } = a as Record<string, unknown>;
    if (typeof exerciseName !== "string" || !knownExercises.includes(exerciseName)) continue;
    if (field !== "weight" && field !== "sets" && field !== "repMin") continue;
    if (typeof to !== "number" || !Number.isFinite(to)) continue;
    const [min, max] = LIMITS[field];
    if (to < min || to > max) continue;
    adjustments.push({ exerciseName, field, to, reason: typeof reason === "string" ? reason : "" });
  }
  return { feedback: r.feedback, adjustments };
}

// Returns copies of the workouts that changed (current week onward, matching exercise only).
export function applyStructureAdjustment(
  workouts: Workout[],
  definitionId: string,
  field: "sets" | "repMin",
  to: number,
  fromWeek: number,
): Workout[] {
  const changed: Workout[] = [];
  for (const w of workouts) {
    if (w.week < fromWeek) continue;
    if (!w.exercises.some((e) => e.definitionId === definitionId)) continue;
    changed.push({
      ...w,
      exercises: w.exercises.map((e) => {
        if (e.definitionId !== definitionId) return e;
        if (field === "sets") return { ...e, sets: to };
        const repMax =
          e.repMax.type === "count" && e.repMax.value < to ? { type: "count" as const, value: to } : e.repMax;
        return { ...e, repMin: to, repMax };
      }),
    });
  }
  return changed;
}

export type CoachSuggestion = CoachAdjustment & { from: number | null };

export function toCoachSet(s: CompletedSet): CoachSetResult {
  return {
    exerciseName: s.exerciseName,
    setNumber: s.setNumber,
    targetWeight: s.targetWeight,
    actualWeight: s.actualWeight,
    targetReps: s.targetReps,
    actualReps: s.actualReps,
    completed: s.completed,
    ...(s.rating && { rating: s.rating }),
  };
}

function toDate(d: WorkoutSessionDoc["date"]): Date {
  return typeof (d as { toDate?: unknown }).toDate === "function" ? (d as { toDate(): Date }).toDate() : new Date(d as Date);
}

// The last few completed sessions of a program that happened before `before`, newest first.
export function pickRecentSessions(
  sessions: WorkoutSessionDoc[],
  programId: string,
  before: Date,
  count = 5,
): CoachInput["recentSessions"] {
  return sessions
    .filter((s) => s.programId === programId && s.completed && !s.skipped && toDate(s.date) < before)
    .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
    .slice(0, count)
    .map((s) => ({
      date: toDate(s.date).toISOString().slice(0, 10),
      dayOfWeek: s.dayOfWeek,
      sets: (s.sets ?? []).map(toCoachSet),
    }));
}
