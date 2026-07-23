import { describe, it, expect } from "vitest";
import { computeNextWeight, liveEasyBump } from "../progression-service";
import type { ResolvedExercise, CompletedSet } from "../types";
import { Timestamp } from "firebase/firestore";

function makeExercise(overrides: Partial<ResolvedExercise> = {}): ResolvedExercise {
  return {
    id: "ex-1",
    definitionId: "def-1",
    order: 1,
    name: "Bench Press",
    phase: "main",
    equipmentType: "kettlebell", // no equipment snapping by default — isolates the math
    equipmentDetail: null,
    muscleGroups: [],
    sets: 3,
    repMin: 8,
    repMax: { type: "count", value: 12 },
    restSeconds: 120,
    progressionRule: "add_5lb",
    isUnilateral: false,
    isTimeBased: false,
    notes: null,
    currentWeight: 100,
    hardStreak: 0,
    ...overrides,
  };
}

function makeSet(overrides: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: "set-1",
    exerciseName: "Bench Press",
    definitionId: "def-1",
    exerciseOrder: 1,
    setNumber: 3,
    targetWeight: 100,
    actualWeight: 100,
    targetReps: 10,
    actualReps: 10,
    completed: true,
    timestamp: Timestamp.now(),
    notes: null,
    rating: "normal",
    ...overrides,
  };
}

describe("computeNextWeight — non-numeric progression rules", () => {
  it.each(["maintain", "none", "deload", "add_reps", "add_time", "add_rounds", "progress_gripper", "Blue", "2 bands"])(
    "leaves currentWeight and hardStreak untouched for %s",
    (rule) => {
      const exercise = makeExercise({ progressionRule: rule, currentWeight: 100, hardStreak: 1 });
      const result = computeNextWeight(exercise, makeSet({ rating: "easy" }));
      expect(result).toEqual({ currentWeight: 100, hardStreak: 1 });
    }
  );
});

describe("computeNextWeight — normal rating", () => {
  it("increases by 1x the increment and resets hardStreak", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", currentWeight: 100, hardStreak: 2 });
    const result = computeNextWeight(exercise, makeSet({ rating: "normal" }));
    expect(result).toEqual({ currentWeight: 105, hardStreak: 0 });
  });

  it("uses the 2.5lb increment for add_2.5lb", () => {
    const exercise = makeExercise({ progressionRule: "add_2.5lb", currentWeight: 50 });
    const result = computeNextWeight(exercise, makeSet({ rating: "normal" }));
    expect(result.currentWeight).toBe(52.5);
  });

  it("uses the 10lb increment for add_10lb", () => {
    const exercise = makeExercise({ progressionRule: "add_10lb", currentWeight: 200 });
    const result = computeNextWeight(exercise, makeSet({ rating: "normal" }));
    expect(result.currentWeight).toBe(210);
  });
});

describe("computeNextWeight — easy rating", () => {
  it("increases by 2x the increment (final set) and resets hardStreak", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", currentWeight: 100, hardStreak: 1 });
    const result = computeNextWeight(exercise, makeSet({ rating: "easy" }));
    expect(result).toEqual({ currentWeight: 110, hardStreak: 0 });
  });
});

describe("computeNextWeight — hard rating streak", () => {
  it("1st consecutive hard: weight holds, streak becomes 1", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", currentWeight: 100, hardStreak: 0 });
    const result = computeNextWeight(exercise, makeSet({ rating: "hard" }));
    expect(result).toEqual({ currentWeight: 100, hardStreak: 1 });
  });

  it("2nd consecutive hard: weight still holds, streak becomes 2", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", currentWeight: 100, hardStreak: 1 });
    const result = computeNextWeight(exercise, makeSet({ rating: "hard" }));
    expect(result).toEqual({ currentWeight: 100, hardStreak: 2 });
  });

  it("3rd consecutive hard: drops by 1x increment, streak resets to 0", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", currentWeight: 100, hardStreak: 2 });
    const result = computeNextWeight(exercise, makeSet({ rating: "hard" }));
    expect(result).toEqual({ currentWeight: 95, hardStreak: 0 });
  });

  it("a normal rating after hard ratings breaks the streak", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", currentWeight: 100, hardStreak: 2 });
    const result = computeNextWeight(exercise, makeSet({ rating: "normal" }));
    expect(result).toEqual({ currentWeight: 105, hardStreak: 0 });
  });
});

describe("computeNextWeight — skipped/failed final set", () => {
  it("treats an incomplete final set the same as a hard rating", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", currentWeight: 100, hardStreak: 0 });
    const result = computeNextWeight(exercise, makeSet({ completed: false, rating: undefined, actualReps: 0, actualWeight: 0 }));
    expect(result).toEqual({ currentWeight: 100, hardStreak: 1 });
  });

  it("a 3rd consecutive skip drops the weight like a 3rd hard", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", currentWeight: 100, hardStreak: 2 });
    const result = computeNextWeight(exercise, makeSet({ completed: false, rating: undefined }));
    expect(result).toEqual({ currentWeight: 95, hardStreak: 0 });
  });
});

describe("computeNextWeight — AMRAP final set (Epley projection)", () => {
  it("ignores the subjective rating and projects from reps/weight instead", () => {
    const exercise = makeExercise({
      progressionRule: "add_5lb",
      currentWeight: 100, // irrelevant to the AMRAP calculation
      repMax: { type: "failure" },
      sets: 3,
    });
    // estimated1RM = 135 * (1 + 10/30) = 180; nextWeight = 180 * 30/38 ≈ 142.105
    const result = computeNextWeight(
      exercise,
      makeSet({ rating: "hard", setNumber: 3, actualWeight: 135, actualReps: 10, targetReps: 8, completed: true })
    );
    expect(result.currentWeight).toBeCloseTo(142.105, 2);
    expect(result.hardStreak).toBe(0);
  });

  it("also triggers via lastSetAmrap flag on a count-type repMax, only on the final set", () => {
    const exercise = makeExercise({
      progressionRule: "add_5lb",
      repMax: { type: "count", value: 12 },
      lastSetAmrap: true,
      sets: 3,
    });
    const result = computeNextWeight(
      exercise,
      makeSet({ setNumber: 3, actualWeight: 100, actualReps: 12, targetReps: 8, completed: true })
    );
    // estimated1RM = 100 * (1 + 12/30) = 140; nextWeight = 140 * 30/38 ≈ 110.526
    expect(result.currentWeight).toBeCloseTo(110.526, 2);
  });

  it("does not treat a non-final set as AMRAP even with lastSetAmrap set", () => {
    const exercise = makeExercise({
      progressionRule: "add_5lb",
      repMax: { type: "count", value: 12 },
      lastSetAmrap: true,
      sets: 3,
      currentWeight: 100,
    });
    const result = computeNextWeight(
      exercise,
      makeSet({ setNumber: 1, rating: "normal", actualWeight: 100, actualReps: 10 })
    );
    expect(result.currentWeight).toBe(105); // normal +1x increment, not an Epley projection
  });

  it("falls back to hard-streak handling when the AMRAP set was skipped", () => {
    const exercise = makeExercise({
      progressionRule: "add_5lb",
      currentWeight: 100,
      repMax: { type: "failure" },
      hardStreak: 0,
    });
    const result = computeNextWeight(exercise, makeSet({ completed: false, actualReps: 0, actualWeight: 0 }));
    expect(result).toEqual({ currentWeight: 100, hardStreak: 1 });
  });
});

describe("computeNextWeight — equipment rounding", () => {
  it("floors to the nearest achievable barbell plate combination", () => {
    // 50 + 2.5 = 52.5 on 45lb bar → per side = 3.75 → not exact, rounds down to 52 (2.5+1)
    const exercise = makeExercise({ progressionRule: "add_2.5lb", equipmentType: "barbell_45", currentWeight: 50 });
    const result = computeNextWeight(exercise, makeSet({ rating: "normal" }));
    expect(result.currentWeight).toBe(52);
  });

  it("applies one-sided landmine loading for Meadows Row", () => {
    // 79 + 5 = 84 on 45lb bar, landmine (one-sided): 39 = 35+2.5+1+0.5 → achieves 84 exactly
    const exercise = makeExercise({ name: "Meadows Row", progressionRule: "add_5lb", equipmentType: "barbell_45", currentWeight: 79 });
    const result = computeNextWeight(exercise, makeSet({ rating: "normal" }));
    expect(result.currentWeight).toBe(84);
  });

  it("floors PowerBlock to the nearest 2.5lb step instead of rounding", () => {
    // 47.5 + 5 = 52.5 → clamped down to max 50 (not rounded to 52.5)
    const exercise = makeExercise({ progressionRule: "add_5lb", equipmentType: "powerblock", currentWeight: 47.5 });
    const result = computeNextWeight(exercise, makeSet({ rating: "normal" }));
    expect(result.currentWeight).toBe(50);
  });

  it("doesn't adjust weight for equipment with no snap function (kettlebell)", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb", equipmentType: "kettlebell", currentWeight: 30 });
    const result = computeNextWeight(exercise, makeSet({ rating: "normal" }));
    expect(result.currentWeight).toBe(35);
  });
});

describe("liveEasyBump", () => {
  it("bumps by 1x the increment for a numeric progression rule", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb" });
    expect(liveEasyBump(100, exercise)).toBe(105);
  });

  it("leaves weight unchanged for non-numeric progression rules", () => {
    const exercise = makeExercise({ progressionRule: "maintain" });
    expect(liveEasyBump(100, exercise)).toBe(100);
  });
});
