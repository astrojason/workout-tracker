import { describe, expect, it } from "vitest";
import type { EquipmentItem, ExerciseDefinition, Program, ResolvedExercise, UserEquipmentConfig } from "../types";
import { DEFAULT_EQUIPMENT_CONFIG, getEquipmentDisplay, equipmentDisplayText } from "../equipment-calculator";
import { itemLoads, validateEquipmentItem } from "../equipment-items";
import { equipmentReach, unmakeableWeights } from "../equipment-reach";
import { computeNextWeight, roundDownToAchievable } from "../progression-service";

const fitarc: EquipmentItem = { id: "fitarc", name: "FitArc", kind: "plate_loaded", baseWeight: 5, sides: 1 };
const medBalls: EquipmentItem = { id: "medballs", name: "Medicine balls", kind: "fixed", weights: [2, 6, 9] };
const stabilityBall: EquipmentItem = { id: "ball", name: "Stability ball", kind: "none" };
const config: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  plates: [{ weight: 10, totalOwned: 2 }, { weight: 5, totalOwned: 2 }, { weight: 2.5, totalOwned: 2 }],
  items: [fitarc, medBalls, stabilityBall],
};

const now = new Date();
const def = (extra: Partial<ExerciseDefinition>): ExerciseDefinition => ({
  id: "x", name: "Wrist Roll", muscleGroups: [], equipmentType: "barbell_45", equipmentDetail: null, progressionRule: "add_5lb",
  isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now, ...extra,
});
const resolved = (extra: Partial<ResolvedExercise>): ResolvedExercise => ({
  ...def({}), id: "o1", definitionId: "x", order: 1, phase: "main", sets: 3, repMin: 8,
  repMax: { type: "count", value: 12 }, restSeconds: 60, notes: null, ...extra,
} as ResolvedExercise);

describe("itemLoads", () => {
  it("loads a one-sided item with all your plates on its one side", () => {
    // 5 lb handle + any of 10, 10, 5, 5, 2.5, 2.5 on one side: 5 to 40 in 2.5 steps.
    const loads = itemLoads(fitarc, config);
    expect(loads[0]).toBe(5);
    expect(loads).toContain(7.5);
    expect(loads).toContain(40);
    expect(loads[loads.length - 1]).toBe(40);
  });
  it("loads a two-sided item with half your plates a side", () => {
    expect(itemLoads({ ...fitarc, sides: 2 }, config)).toEqual([5, 10, 15, 20, 25, 30, 35, 40]);
  });
  it("lists a fixed set's weights in order, and nothing for a no-weight item", () => {
    expect(itemLoads({ ...medBalls, weights: [9, 2, 6] }, config)).toEqual([2, 6, 9]);
    expect(itemLoads(stabilityBall, config)).toEqual([]);
  });
});

describe("validateEquipmentItem", () => {
  const blank = { name: "", kind: "plate_loaded" as const, baseWeight: "", sides: 1 as const, weights: "" };
  it("needs a unique name", () => {
    expect(validateEquipmentItem({ ...blank, name: " " }, [])).toEqual({ ok: false, error: "Enter a name for the item." });
    expect(validateEquipmentItem({ ...blank, name: "fitarc", baseWeight: "5" }, [fitarc])).toEqual({ ok: false, error: 'You already have an item named "fitarc".' });
    expect(validateEquipmentItem({ ...blank, name: "FitArc", baseWeight: "6" }, [fitarc], "fitarc").ok).toBe(true);
  });
  it("needs the empty weight of a plate-loaded item", () => {
    expect(validateEquipmentItem({ ...blank, name: "Pin", baseWeight: "x" }, [])).toEqual({ ok: false, error: "Enter what it weighs empty, in lb (0 if nothing)." });
    expect(validateEquipmentItem({ ...blank, name: "Pin", baseWeight: "0" }, [])).toEqual({ ok: true, item: { name: "Pin", kind: "plate_loaded", baseWeight: 0, sides: 1 } });
  });
  it("needs at least one weight for a fixed set, and nothing for a no-weight item", () => {
    expect(validateEquipmentItem({ ...blank, name: "Balls", kind: "fixed", weights: "" }, [])).toEqual({ ok: false, error: "Enter its weights, separated by commas (e.g. 2, 6, 9)." });
    expect(validateEquipmentItem({ ...blank, name: "Balls", kind: "fixed", weights: "9, 2, 6, 6" }, [])).toEqual({ ok: true, item: { name: "Balls", kind: "fixed", weights: [2, 6, 9] } });
    expect(validateEquipmentItem({ ...blank, name: "Ball", kind: "none" }, [])).toEqual({ ok: true, item: { name: "Ball", kind: "none" } });
  });
});

describe("equipment items in the rest of the app", () => {
  it("shows one-sided plate math on the item's own weight during a workout", () => {
    const display = getEquipmentDisplay(resolved({ equipmentItemId: "fitarc" }), 22.5, config);
    expect(display).toMatchObject({ type: "barbell", config: { barWeight: 5, achievedWeight: 22.5, isLandmine: true } });
  });

  it("shows a fixed-weight item by name", () => {
    const display = getEquipmentDisplay(resolved({ equipmentType: "dumbbell", equipmentItemId: "medballs" }), 6, config);
    expect(equipmentDisplayText(display)).toBe("Medicine balls: 6 lbs");
  });

  it("falls back to the exercise's own equipment when the item is gone", () => {
    const display = getEquipmentDisplay(resolved({ equipmentType: "dumbbell", equipmentItemId: "deleted" }), 6, config);
    expect(display).toEqual({ type: "dumbbell", weight: 6 });
  });

  it("moves to the item's next weight on a next-weight-step progression", () => {
    const exercise = resolved({ equipmentType: "dumbbell", equipmentItemId: "medballs", progressionRule: "add_weight", currentWeight: 6 });
    const finalSet = { id: "s", exerciseName: "Slam", exerciseOrder: 1, setNumber: 3, targetWeight: 6, actualWeight: 6, targetReps: 8, actualReps: 12, completed: true, timestamp: now, notes: null, rating: "easy" as const };
    expect(computeNextWeight(exercise, finalSet, config).currentWeight).toBe(9);
  });

  it("snaps a progressed weight down to what the item can make", () => {
    // 5 lb handle with 10, 10, 5, 5, 2.5, 2.5 on one side: 41 isn't possible, 40 is.
    expect(roundDownToAchievable(41, resolved({ equipmentItemId: "fitarc" }), config)).toBe(40);
  });

  it("adds a row to what you can load for each weighted item", () => {
    const names = equipmentReach(config).map((r) => r.name);
    expect(names).toContain("FitArc");
    expect(names).toContain("Medicine balls");
    expect(names).not.toContain("Stability ball");
  });

  it("checks a linked exercise's working weight against the item, not its equipment type", () => {
    const definitions = { roll: def({ id: "roll", name: "Wrist Roll", equipmentItemId: "fitarc" }), slam: def({ id: "slam", name: "Slam", equipmentType: "dumbbell", equipmentItemId: "medballs" }) };
    const program: Program = { id: "p1", name: "Grip", totalWeeks: 4, createdAt: now, weights: { roll: { currentWeight: 22.5, hardStreak: 0 }, slam: { currentWeight: 5, hardStreak: 0 } } };
    const result = unmakeableWeights([program], definitions, { ...config, barbells: { has45lb: false, has35lb: false, hasEZBar: false } });
    expect(result.map((r) => [r.exerciseName, r.reason, r.below, r.above])).toEqual([["Slam", "Not one of the Medicine balls", 2, 6]]);
  });
});
