import { describe, expect, it } from "vitest";
import type { CompletedSet, ExerciseDefinition } from "../types";
import { addedSetError, buildAddedExercise } from "../added-exercise";

const now = new Date("2026-11-20T10:00:00Z");

function set(overrides: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: "s1", exerciseName: "Back Squat", definitionId: "squat", exerciseOrder: 1, setNumber: 1,
    targetWeight: 225, actualWeight: 225, targetReps: 5, actualReps: 5, completed: true,
    timestamp: now, notes: null, phase: "main", ...overrides,
  };
}

const def = (overrides: Partial<ExerciseDefinition>): ExerciseDefinition => ({
  id: "fp", name: "Face Pull", muscleGroups: [], equipmentType: "machine", equipmentDetail: null, progressionRule: "add_reps",
  isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now, ...overrides,
});

describe("addedSetError", () => {
  it("needs a weight of 0 or more and a whole number of reps or seconds above 0", () => {
    expect(addedSetError({ weight: "40", reps: "12" }, false)).toBeNull();
    expect(addedSetError({ weight: "", reps: "12" }, false)).toBeNull(); // blank weight = bodyweight
    expect(addedSetError({ weight: "-1", reps: "12" }, false)).toBe("Weight must be a number of 0 or more");
    expect(addedSetError({ weight: "40", reps: "0" }, false)).toBe("Reps must be a whole number above 0");
    expect(addedSetError({ weight: "40", reps: "1.5" }, false)).toBe("Reps must be a whole number above 0");
    expect(addedSetError({ weight: "", reps: "" }, true)).toBe("Seconds must be a whole number above 0");
  });
});

describe("buildAddedExercise", () => {
  it("adds a library exercise after the session's last exercise, numbered from set 1", () => {
    const existing = [set(), set({ id: "b1", exerciseName: "Bench Press", exerciseOrder: 2 })];
    const result = buildAddedExercise(existing, {
      name: " face pull ", definition: def({}), isTimeBased: false,
      sets: [{ weight: "40", reps: "15" }, { weight: "40", reps: "12" }],
    }, now);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      exerciseName: "Face Pull", definitionId: "fp", equipmentType: "machine", exerciseOrder: 3, setNumber: 1,
      actualWeight: 40, targetWeight: 40, actualReps: 15, targetReps: 15, completed: true, phase: "main",
      isTimeBased: false, timestamp: now, notes: null,
    });
    expect(result[1]).toMatchObject({ exerciseOrder: 3, setNumber: 2, actualReps: 12 });
    expect(result[0].id).not.toBe(result[1].id);
  });

  it("logs a new name without a library link, and a timed exercise as seconds with no weight", () => {
    const [plank] = buildAddedExercise([], { name: "Side Plank", isTimeBased: true, sets: [{ weight: "25", reps: "60" }] }, now);
    expect(plank).toMatchObject({ exerciseName: "Side Plank", exerciseOrder: 1, actualReps: 60, actualWeight: 0, isTimeBased: true });
    expect(plank.definitionId).toBeUndefined();
    expect(plank.equipmentType).toBeUndefined();
  });

  it("keeps a band exercise's band so it doesn't read as bodyweight", () => {
    const [row] = buildAddedExercise([], {
      name: "Band Pull-apart", definition: def({ id: "bp", name: "Band Pull-apart", equipmentType: "band", equipmentDetail: "Red" }),
      isTimeBased: false, sets: [{ weight: "", reps: "20" }],
    }, now);
    expect(row).toMatchObject({ equipmentType: "band", equipmentDetail: "Red", actualWeight: 0 });
  });

  it("refuses a blank name, no sets, or an invalid set, naming the set", () => {
    expect(() => buildAddedExercise([], { name: "  ", isTimeBased: false, sets: [{ weight: "1", reps: "1" }] }, now)).toThrow("Pick or type an exercise");
    expect(() => buildAddedExercise([], { name: "Curl", isTimeBased: false, sets: [] }, now)).toThrow("Add at least one set");
    expect(() => buildAddedExercise([], { name: "Curl", isTimeBased: false, sets: [{ weight: "20", reps: "8" }, { weight: "x", reps: "8" }] }, now))
      .toThrow("Curl set 2: Weight must be a number of 0 or more");
  });
});
