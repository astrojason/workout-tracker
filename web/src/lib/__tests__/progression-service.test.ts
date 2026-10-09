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

describe("computeNextWeight — non-AMRAP sets progress from reps achieved (Epley)", () => {
  it("raises the weight when reps beat the rep minimum, whatever the rating", () => {
    // hip thrust style: 15 reps at 105 against a 12-rep minimum
    const exercise = makeExercise({ progressionRule: "add_10lb", currentWeight: 105, repMin: 12, hardStreak: 1 });
    // 1RM = 105 * 1.5 = 157.5; next = 157.5 * 30/42 = 112.5
    for (const rating of ["easy", "normal", "hard"] as const) {
      const result = computeNextWeight(exercise, makeSet({ rating, actualWeight: 105, actualReps: 15, targetReps: 12 }));
      expect(result).toEqual({ currentWeight: 112.5, hardStreak: 0 });
    }
  });

  it("holds the weight when reps only match the rep minimum", () => {
    const exercise = makeExercise({ currentWeight: 100, repMin: 8 });
    const result = computeNextWeight(exercise, makeSet({ actualWeight: 100, actualReps: 8, rating: "easy" }));
    expect(result).toEqual({ currentWeight: 100, hardStreak: 0 });
  });

  it("never lowers the weight on a completed set that fell short of the rep minimum", () => {
    const exercise = makeExercise({ currentWeight: 100, repMin: 8 });
    const result = computeNextWeight(exercise, makeSet({ actualWeight: 100, actualReps: 6 }));
    expect(result.currentWeight).toBe(100);
  });

  it("projects from the weight actually lifted, not the planned weight", () => {
    const exercise = makeExercise({ currentWeight: 100, repMin: 10 });
    // 120 x 10 → 1RM 160 → 160 * 30/40 = 120
    const result = computeNextWeight(exercise, makeSet({ actualWeight: 120, actualReps: 10 }));
    expect(result.currentWeight).toBe(120);
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
    expect(result.currentWeight).toBeCloseTo(105.263, 2); // plain Epley on the 10 reps, not a flat +5
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
  // 12 reps against a 10-rep minimum projects to 1.05x the weight lifted (1.4 * 30/40).
  const beatRepMin = { repMin: 10 };
  const lift = (weight: number) => makeSet({ actualWeight: weight, actualReps: 12 });

  it("floors to the nearest achievable barbell plate combination", () => {
    // 50 * 1.05 = 52.5 on 45lb bar → per side = 3.75 → not exact, rounds down to 52 (2.5+1)
    const exercise = makeExercise({ ...beatRepMin, equipmentType: "barbell_45", currentWeight: 50 });
    expect(computeNextWeight(exercise, lift(50)).currentWeight).toBe(52);
  });

  it("applies one-sided landmine loading for Meadows Row", () => {
    // 80 * 1.05 = 84 on 45lb bar, landmine (one-sided): 39 = 35+2.5+1+0.5 → achieves 84 exactly
    const exercise = makeExercise({ ...beatRepMin, name: "Meadows Row", equipmentType: "barbell_45", currentWeight: 80 });
    expect(computeNextWeight(exercise, lift(80)).currentWeight).toBe(84);
  });

  it("floors PowerBlock to the nearest 2.5lb step instead of rounding", () => {
    // 45 * 1.05 = 47.25 → floored to 45 (rounding to nearest would give 47.5)
    const exercise = makeExercise({ ...beatRepMin, equipmentType: "powerblock", currentWeight: 45 });
    expect(computeNextWeight(exercise, lift(45)).currentWeight).toBe(45);
  });

  it("doesn't adjust weight for equipment with no snap function (kettlebell)", () => {
    const exercise = makeExercise({ ...beatRepMin, equipmentType: "kettlebell", currentWeight: 30 });
    expect(computeNextWeight(exercise, lift(30)).currentWeight).toBeCloseTo(31.5, 5);
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
