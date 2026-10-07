import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { buildPreviousPerformanceMap, seedAssistedWeights } from "../last-performance";
import type { CompletedSet, ResolvedExercise, WorkoutSessionDoc } from "../types";

const exercise = {
  id: "bench-occurrence",
  definitionId: "bench-definition",
  name: "Bench Press",
  equipmentType: "barbell_45",
  isTimeBased: false,
} as ResolvedExercise;

function completedSet(overrides: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: crypto.randomUUID(),
    exerciseName: "Bench Press",
    definitionId: "bench-definition",
    exerciseOrder: 1,
    setNumber: 1,
    targetWeight: 0,
    actualWeight: 135,
    targetReps: 8,
    actualReps: 8,
    completed: true,
    timestamp: Timestamp.fromDate(new Date("2026-01-01")),
    notes: null,
    ...overrides,
  };
}

function session(date: string, sets: CompletedSet[]): WorkoutSessionDoc {
  return {
    id: date,
    programId: "program-1",
    programName: "Program",
    week: 1,
    dayOfWeek: "Monday",
    date: Timestamp.fromDate(new Date(date)),
    completed: true,
    durationSeconds: 100,
    sets,
  };
}

describe("buildPreviousPerformanceMap", () => {
  it("uses the strongest completed set from the latest matching session", () => {
    const performances = buildPreviousPerformanceMap([exercise], [
      session("2026-01-01", [completedSet({ actualWeight: 200, actualReps: 3 })]),
      session("2026-02-01", [
        completedSet({ actualWeight: 145, actualReps: 8 }),
        completedSet({ actualWeight: 150, actualReps: 6 }),
        completedSet({ actualWeight: 155, actualReps: 5, completed: false }),
      ]),
    ]);

    expect(performances[exercise.id]).toEqual({ weight: 150, reps: 6 });
  });

  it("matches renamed exercises by definition ID and legacy sets by name", () => {
    const renamed = { ...exercise, name: "Barbell Bench Press" };
    const byId = buildPreviousPerformanceMap([renamed], [
      session("2026-02-01", [completedSet({ exerciseName: "Old Bench Name" })]),
    ]);
    expect(byId[exercise.id]).toEqual({ weight: 135, reps: 8 });

    const legacy = buildPreviousPerformanceMap([exercise], [
      session("2026-02-01", [completedSet({ definitionId: undefined })]),
    ]);
    expect(legacy[exercise.id]).toEqual({ weight: 135, reps: 8 });
  });

  it("omits exercises with no completed history", () => {
    const performances = buildPreviousPerformanceMap([exercise], [
      session("2026-02-01", [completedSet({ completed: false })]),
    ]);
    expect(performances).toEqual({});
  });

  it("treats the fewest bands as the best assisted set", () => {
    const assisted = { ...exercise, name: "Assisted Pull-ups", equipmentType: "assisted_pullup" } as ResolvedExercise;
    const performances = buildPreviousPerformanceMap([assisted], [
      session("2026-02-01", [
        completedSet({ exerciseName: "Assisted Pull-ups", actualWeight: 3, actualReps: 8 }),
        completedSet({ exerciseName: "Assisted Pull-ups", actualWeight: 2, actualReps: 5 }),
      ]),
    ]);
    expect(performances[assisted.id]).toEqual({ weight: 2, reps: 5 });
  });
});

describe("seedAssistedWeights", () => {
  const assisted = { id: "a1", equipmentType: "assisted_pullup", currentWeight: 0 } as ResolvedExercise;

  it("starts an assisted exercise at last session's band count when it has no weight", () => {
    expect(seedAssistedWeights([assisted], { a1: { weight: 2, reps: 8 } })).toEqual({ a1: 2 });
  });

  it("leaves exercises that already have a weight, or other equipment, alone", () => {
    const weighted = { ...assisted, id: "a2", currentWeight: 3 } as ResolvedExercise;
    const bench = { ...exercise, id: "b1", currentWeight: 0 } as ResolvedExercise;
    expect(seedAssistedWeights([weighted, bench], { a2: { weight: 2, reps: 8 }, b1: { weight: 135, reps: 8 } })).toEqual({});
  });

  it("ignores history that recorded no bands", () => {
    expect(seedAssistedWeights([assisted], { a1: { weight: 0, reps: 8 } })).toEqual({});
  });
});
