import { describe, it, expect } from "vitest";
import { buildCustomSets } from "../custom-workout";

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
});
