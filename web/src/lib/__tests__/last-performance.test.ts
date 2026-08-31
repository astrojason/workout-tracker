import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { buildPreviousPerformanceMap } from "../last-performance";
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
});
