// e2e/fixtures/workout-fixtures.ts
// Test data derived from reacher_build_cycle2.xlsx.
// Mirrors the shape of Workout/Exercise objects produced by xlsx-parser.ts.

import type { Workout, Exercise } from "@/lib/types";

const makeExercise = (overrides: Partial<Exercise>): Exercise => ({
  id: crypto.randomUUID(),
  order: 1,
  name: "Test Exercise",
  phase: "main",
  equipmentType: "barbell_45",
  equipmentDetail: null,
  baseWeight: { type: "fixed", value: 0 },
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
export const landminePress: Exercise = makeExercise({
  name: "Landmine Press",
  equipmentType: "barbell_45",
  sets: 3,
  repMin: 8,
  repMax: { type: "count", value: 10 },
  lastSetAmrap: true,
  totalWeight: 90,
  restSeconds: 120,
  progressionRule: "add_5lb",
  notes: null,
});

// ── Assisted Pull-ups (Friday main) ──────────────────────────────────────────
export const assistedPullups: Exercise = makeExercise({
  name: "Assisted Pull-ups",
  equipmentType: "assisted_pullup",
  equipmentDetail: "3_bands",
  sets: 3,
  repMin: 3,
  repMax: { type: "count", value: 5 },
  restSeconds: 120,
  progressionRule: "2 bands",
  totalWeight: 0,
});

export const assistedPullupsAmrap: Exercise = makeExercise({
  name: "Assisted Pull-ups",
  equipmentType: "assisted_pullup",
  equipmentDetail: "3_bands",
  sets: 1,
  repMin: 1,
  repMax: { type: "failure" },
  lastSetAmrap: true,
  restSeconds: 120,
  progressionRule: "2 bands",
  totalWeight: 0,
});

// ── Scapular Hangs (Friday/Saturday main) ────────────────────────────────────
export const scapularHangs: Exercise = makeExercise({
  name: "Scapular Hangs",
  equipmentType: "assisted_pullup",
  equipmentDetail: "3_bands",
  sets: 3,
  repMin: 30,
  repMax: { type: "count", value: 30 },
  restSeconds: 30,
  progressionRule: "none",
  isTimeBased: true,
  totalWeight: 0,
});

// ── Dips (Monday main) ───────────────────────────────────────────────────────
export const dips: Exercise = makeExercise({
  name: "Dips",
  equipmentType: "band",
  equipmentDetail: "Green",
  sets: 2,
  repMin: 12,
  repMax: { type: "count", value: 15 },
  restSeconds: 120,
  progressionRule: "Blue",
  totalWeight: 0,
});

// ── External Rotations warmup ────────────────────────────────────────────────
export const externalRotations: Exercise = makeExercise({
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
  totalWeight: 0,
});

// ── Workout fixtures ─────────────────────────────────────────────────────────

export const landminePressWorkout: Workout = {
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

export const pullUpWorkout: Workout = {
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

export const warmupWorkout: Workout = {
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