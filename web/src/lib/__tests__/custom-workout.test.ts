import { describe, it, expect } from "vitest";
import { buildCustomSets, suggestCustomWeight } from "../custom-workout";
import type { CompletedSet, ExerciseDefinition, WorkoutSessionDoc } from "../types";

describe("buildCustomSets", () => {
  const at = new Date("2026-10-12T12:00:00Z");

  it("numbers sets per exercise and orders exercises by first appearance", () => {
    const sets = buildCustomSets(
      [
        { exerciseName: "Bench Press", weight: 135, reps: 8 },
        { exerciseName: "Bench Press", weight: 145, reps: 6 },
        { exerciseName: "Row", weight: 100, reps: 10 },
      ],
      {},
      at,
    );
    expect(sets.map((s) => [s.exerciseName, s.exerciseOrder, s.setNumber])).toEqual([
      ["Bench Press", 1, 1],
      ["Bench Press", 1, 2],
      ["Row", 2, 1],
    ]);
  });

  it("groups a revisited exercise under its original order", () => {
    const sets = buildCustomSets(
      [
        { exerciseName: "Squat", weight: 200, reps: 5 },
        { exerciseName: "Row", weight: 100, reps: 10 },
        { exerciseName: "squat ", weight: 205, reps: 5 },
      ],
      {},
      at,
    );
    expect(sets.map((s) => [s.exerciseOrder, s.setNumber])).toEqual([[1, 1], [2, 1], [1, 2]]);
  });

  it("logs each set as completed at the entered weight and reps", () => {
    const [set] = buildCustomSets([{ exerciseName: "Curl", weight: 30, reps: 12 }], {}, at);
    expect(set).toMatchObject({
      actualWeight: 30, targetWeight: 30, actualReps: 12, targetReps: 12, completed: true, notes: null, phase: "main",
    });
  });

  it("links library exercises by definition id, case-insensitively", () => {
    const [set] = buildCustomSets(
      [{ exerciseName: "bench press", weight: 135, reps: 8 }],
      { "bench press": { definitionId: "def-1", name: "Bench Press", equipmentType: "barbell_45", isTimeBased: false } },
      at,
    );
    expect(set).toMatchObject({ definitionId: "def-1", exerciseName: "Bench Press", equipmentType: "barbell_45" });
  });

  it("leaves definitionId off for a brand-new exercise name", () => {
    const [set] = buildCustomSets([{ exerciseName: "Zercher Squat", weight: 95, reps: 8 }], {}, at);
    expect(set.definitionId).toBeUndefined();
    expect(set.exerciseName).toBe("Zercher Squat");
  });

  it("logs a timed entry as seconds with isTimeBased set, even for a free-form exercise", () => {
    const [set] = buildCustomSets([{ exerciseName: "Plank", weight: 0, reps: 45, isTimeBased: true }], {}, at);
    expect(set).toMatchObject({ actualReps: 45, targetReps: 45, actualWeight: 0, isTimeBased: true });
  });

  it("lets an explicit rep entry override a library exercise's time default", () => {
    const [set] = buildCustomSets(
      [{ exerciseName: "plank", weight: 0, reps: 10, isTimeBased: false }],
      { plank: { definitionId: "d", name: "Plank", equipmentType: "bodyweight", isTimeBased: true } },
      at,
    );
    expect(set.isTimeBased).toBe(false);
  });

  it("carries the entered rating onto the set so progression and the coach can read it", () => {
    const [rated, unrated] = buildCustomSets(
      [{ exerciseName: "Curl", weight: 30, reps: 12, rating: "hard" }, { exerciseName: "Curl", weight: 30, reps: 12 }],
      {},
      at,
    );
    expect(rated.rating).toBe("hard");
    expect(unrated.rating).toBe("normal");
  });
});

describe("suggestCustomWeight", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const def = {
    id: "def-1", name: "Bench Press", muscleGroups: [], equipmentType: "kettlebell", equipmentDetail: null,
    progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, currentWeight: 50, hardStreak: 0,
    createdAt: now, updatedAt: now,
  } as ExerciseDefinition;

  function set(over: Partial<CompletedSet>): CompletedSet {
    return {
      id: crypto.randomUUID(), exerciseName: "Bench Press", definitionId: "def-1", exerciseOrder: 1, setNumber: 1,
      targetWeight: 100, actualWeight: 100, targetReps: 8, actualReps: 8, completed: true,
      timestamp: now, notes: null, rating: "normal", phase: "main", ...over,
    };
  }
  function session(date: Date, sets: CompletedSet[]): WorkoutSessionDoc {
    return {
      id: String(date.getTime()), programId: "p", programName: "P", week: 1, dayOfWeek: "Monday",
      date, completed: true, durationSeconds: 1, sets,
    } as WorkoutSessionDoc;
  }

  it("returns null with no history", () => {
    expect(suggestCustomWeight(def, [], undefined, now)).toBeNull();
  });

  it("applies the progression rule to the latest final set's rating", () => {
    const s = suggestCustomWeight(def, [
      session(daysAgo(30), [set({ actualWeight: 80 })]),
      session(daysAgo(3), [set({ setNumber: 1, actualWeight: 100, rating: "normal" }), set({ setNumber: 2, actualWeight: 100, rating: "easy" })]),
    ], undefined, now);
    expect(s).toMatchObject({ weight: 110, lastWeight: 100, lastReps: 8, daysAgo: 3 });
  });

  it("holds the weight when it has been over two weeks, and deloads after four", () => {
    expect(suggestCustomWeight(def, [session(daysAgo(20), [set({ rating: "easy" })])], undefined, now)?.weight).toBe(100);
    expect(suggestCustomWeight(def, [session(daysAgo(40), [set({ rating: "easy" })])], undefined, now)?.weight).toBe(95);
  });

  it("ignores warm-up sets and matches legacy sets by name", () => {
    const s = suggestCustomWeight(def, [session(daysAgo(2), [
      set({ actualWeight: 100, phase: "main" }),
      set({ actualWeight: 45, phase: "warmup", setNumber: 5 }),
      set({ definitionId: undefined, actualWeight: 100, setNumber: 2, rating: "normal" }),
    ])], undefined, now);
    expect(s?.lastWeight).toBe(100);
  });

  it("repeats the last weight when the rule has no numeric change, and skips bodyweight and timed exercises", () => {
    const maintain = { ...def, progressionRule: "maintain" } as ExerciseDefinition;
    expect(suggestCustomWeight(maintain, [session(daysAgo(2), [set({ rating: "easy" })])], undefined, now)?.weight).toBe(100);
    expect(suggestCustomWeight(def, [session(daysAgo(2), [set({ actualWeight: 0 })])], undefined, now)).toBeNull();
    expect(suggestCustomWeight({ ...def, isTimeBased: true }, [session(daysAgo(2), [set({})])], undefined, now)).toBeNull();
  });
});
