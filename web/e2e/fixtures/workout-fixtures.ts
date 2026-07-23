// e2e/fixtures/workout-fixtures.ts
// Test data seeded directly into localStorage as an ActiveSession (see how these
// fixtures are consumed in e2e/tests/*.spec.ts), so exercises here use the
// RESOLVED shape (occurrence + definition merged) that ActiveSession.workout
// requires — the same shape resolveWorkout()/resolveExercise() produce at runtime.

import type { ResolvedWorkout, ResolvedExercise } from "@/lib/types";

const makeExercise = (overrides: Partial<ResolvedExercise>): ResolvedExercise => ({
  id: crypto.randomUUID(),
  definitionId: crypto.randomUUID(),
  order: 1,
  name: "Test Exercise",
  phase: "main",
  equipmentType: "barbell_45",
  equipmentDetail: null,
  muscleGroups: [],
  currentWeight: 0,
  hardStreak: 0,
  sets: 3,
  repMin: 8,
  repMax: { type: "count", value: 10 },
  restSeconds: 120,
  progressionRule: "add_5lb",
  isUnilateral: false,
  isTimeBased: false,
  notes: null,
  ...overrides,
});

// ── Landmine Press (Monday main) ─────────────────────────────────────────────
export const landminePress: ResolvedExercise = makeExercise({
  name: "Landmine Press",
  equipmentType: "barbell_45",
  sets: 3,
  repMin: 8,
  repMax: { type: "count", value: 10 },
  lastSetAmrap: true,
  currentWeight: 90,
  restSeconds: 120,
  progressionRule: "add_5lb",
  notes: null,
});

// ── Meadows Row (one-sided landmine-style loading, no "landmine" in name) ────
export const meadowsRow: ResolvedExercise = makeExercise({
  name: "Meadows Row",
  equipmentType: "barbell_45",
  sets: 3,
  repMin: 8,
  repMax: { type: "count", value: 10 },
  lastSetAmrap: true,
  currentWeight: 90,
  restSeconds: 120,
  progressionRule: "add_5lb",
  notes: null,
});

// ── Assisted Pull-ups (Friday main) ──────────────────────────────────────────
export const assistedPullups: ResolvedExercise = makeExercise({
  name: "Assisted Pull-ups",
  equipmentType: "assisted_pullup",
  equipmentDetail: "3_bands",
  sets: 3,
  repMin: 3,
  repMax: { type: "count", value: 5 },
  restSeconds: 120,
  progressionRule: "2 bands",
  currentWeight: 0,
});

export const assistedPullupsAmrap: ResolvedExercise = makeExercise({
  name: "Assisted Pull-ups",
  equipmentType: "assisted_pullup",
  equipmentDetail: "3_bands",
  sets: 1,
  repMin: 1,
  repMax: { type: "failure" },
  lastSetAmrap: true,
  restSeconds: 120,
  progressionRule: "2 bands",
  currentWeight: 0,
});

// ── Scapular Hangs (Friday/Saturday main) ────────────────────────────────────
export const scapularHangs: ResolvedExercise = makeExercise({
  name: "Scapular Hangs",
  equipmentType: "assisted_pullup",
  equipmentDetail: "3_bands",
  sets: 3,
  repMin: 30,
  repMax: { type: "count", value: 30 },
  restSeconds: 30,
  progressionRule: "none",
  isTimeBased: true,
  currentWeight: 0,
});

// ── Dips (Monday main) ───────────────────────────────────────────────────────
export const dips: ResolvedExercise = makeExercise({
  name: "Dips",
  equipmentType: "band",
  equipmentDetail: "Green",
  sets: 2,
  repMin: 12,
  repMax: { type: "count", value: 15 },
  restSeconds: 120,
  progressionRule: "Blue",
  currentWeight: 0,
});

// ── PowerBlock Curl (Wednesday main) ─────────────────────────────────────────
export const powerblockCurl: ResolvedExercise = makeExercise({
  name: "PowerBlock Curl",
  equipmentType: "powerblock",
  equipmentDetail: null,
  sets: 3,
  repMin: 8,
  repMax: { type: "count", value: 10 },
  restSeconds: 90,
  progressionRule: "add_2.5lb",
  currentWeight: 20,
});

// ── External Rotations warmup ────────────────────────────────────────────────
export const externalRotations: ResolvedExercise = makeExercise({
  name: "External Rotations",
  phase: "warmup",
  equipmentType: "band",
  equipmentDetail: "Purple",
  sets: 2,
  repMin: 12,
  repMax: { type: "count", value: 12 },
  restSeconds: 60,
  restAfter: false,
  progressionRule: "none",
  isUnilateral: true,
  currentWeight: 0,
});

// ── Workout fixtures ─────────────────────────────────────────────────────────

export const landminePressWorkout: ResolvedWorkout = {
  id: "reacher-build_1_monday",
  programId: "reacher-build",
  programName: "Reacher Build",
  week: 1,
  dayOfWeek: "Monday",
  exercises: [
    { ...landminePress, id: "exercise-1", order: 1 },
  ],
  isChecklist: false,
};

export const meadowsRowWorkout: ResolvedWorkout = {
  id: "reacher-build_1_monday",
  programId: "reacher-build",
  programName: "Reacher Build",
  week: 1,
  dayOfWeek: "Monday",
  exercises: [
    { ...meadowsRow, id: "exercise-1", order: 1 },
  ],
  isChecklist: false,
};

export const pullUpWorkout: ResolvedWorkout = {
  id: "reacher-build_1_friday",
  programId: "reacher-build",
  programName: "Reacher Build",
  week: 1,
  dayOfWeek: "Friday",
  exercises: [
    { ...scapularHangs, id: "exercise-1", order: 1 },
    { ...assistedPullups, id: "exercise-2", order: 2 },
    { ...assistedPullupsAmrap, id: "exercise-3", order: 3 },
  ],
  isChecklist: false,
};

export const powerblockCurlWorkout: ResolvedWorkout = {
  id: "reacher-build_1_wednesday",
  programId: "reacher-build",
  programName: "Reacher Build",
  week: 1,
  dayOfWeek: "Wednesday",
  exercises: [
    { ...powerblockCurl, id: "exercise-1", order: 1 },
  ],
  isChecklist: false,
};

export const warmupWorkout: ResolvedWorkout = {
  id: "reacher-build_1_tuesday",
  programId: "reacher-build",
  programName: "Reacher Build",
  week: 1,
  dayOfWeek: "Tuesday",
  exercises: [
    { ...externalRotations, id: "exercise-1", order: 1 },
    { ...landminePress, id: "exercise-2", order: 2 },
  ],
  isChecklist: false,
};
