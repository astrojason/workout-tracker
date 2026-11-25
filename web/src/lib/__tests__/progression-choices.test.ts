import { describe, expect, it } from "vitest";
import { nextLoad, progressionOptionGroups, weightIncrement } from "../progression-choices";
import { computeNextWeight, liveEasyBump } from "../progression-service";
import { DEFAULT_EQUIPMENT_CONFIG } from "../equipment-calculator";
import type { CompletedSet, ResolvedExercise, UserEquipmentConfig } from "../types";

// Progression rules that add weight are offered from what the exercise's equipment can make: a
// one-sided FitArc steps by a single plate (0.5 lb), a barbell by a pair (1 lb).

const config: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  fixedDumbbells: [10, 15, 20],
  powerBlock: { owned: false, minLbs: 5, maxLbs: 50 },
  items: [
    { id: "fitarc", name: "FitArc", kind: "plate_loaded", baseWeight: 5, sides: 1 },
    { id: "balls", name: "Medicine balls", kind: "fixed", weights: [2, 6, 9] },
  ],
};

type Eq = Parameters<typeof progressionOptionGroups>[0];
const fitarc: Eq = { name: "FitArc Row", equipmentType: "machine", equipmentItemId: "fitarc", weightOptions: null };
const squat: Eq = { name: "Back Squat", equipmentType: "barbell_45", equipmentItemId: null, weightOptions: null };
const curl: Eq = { name: "Curl", equipmentType: "dumbbell", equipmentItemId: null, weightOptions: null };
const plank: Eq = { name: "Plank", equipmentType: "bodyweight", equipmentItemId: null, weightOptions: null };

const values = (groups: ReturnType<typeof progressionOptionGroups>, label: string) => groups.find((g) => g.label === label)?.options.map((o) => o.value) ?? [];
const labels = (groups: ReturnType<typeof progressionOptionGroups>) => groups.flatMap((g) => g.options.map((o) => o.label));

describe("weightIncrement", () => {
  it("reads any add_<n>lb rule", () => {
    expect(weightIncrement("add_5lb")).toBe(5);
    expect(weightIncrement("add_2.5lb")).toBe(2.5);
    expect(weightIncrement("add_0.5lb")).toBe(0.5);
    expect(weightIncrement("add_reps")).toBeNull();
    expect(weightIncrement("Blue")).toBeNull();
  });
});

describe("progressionOptionGroups", () => {
  it("offers single-plate steps on a one-sided plate-loaded item", () => {
    const groups = progressionOptionGroups(fitarc, config, "none");
    expect(values(groups, "Add weight")).toEqual(["add_weight", "add_0.5lb", "add_0.75lb", "add_1lb", "add_2.5lb", "add_5lb", "add_10lb"]);
    expect(labels(groups)).toContain("Add 0.5 lb");
  });

  it("offers pairs of plates on a barbell", () => {
    expect(values(progressionOptionGroups(squat, config, "none"), "Add weight")).toEqual(["add_weight", "add_1lb", "add_1.5lb", "add_2lb", "add_5lb", "add_10lb", "add_20lb"]);
  });

  it("offers only the next weight step for fixed weights", () => {
    expect(values(progressionOptionGroups(curl, config, "none"), "Add weight")).toEqual(["add_weight"]);
  });

  it("offers no weight rules for bodyweight, but the other rules stay", () => {
    const groups = progressionOptionGroups(plank, config, "none");
    expect(values(groups, "Add weight")).toEqual([]);
    expect(values(groups, "Other")).toEqual(expect.arrayContaining(["none", "add_reps", "add_time", "maintain"]));
  });

  it("keeps the current rule selectable when this equipment can't do it", () => {
    const groups = progressionOptionGroups(fitarc, config, "add_2lb");
    expect(groups[0]).toEqual({ label: "Current (not possible with this equipment)", options: [{ value: "add_2lb", label: "Add 2 lb" }] });
    expect(progressionOptionGroups(plank, config, "Blue")[0].options).toEqual([{ value: "Blue", label: "Blue" }]);
  });
});

describe("nextLoad", () => {
  it("finds the next load the equipment can make", () => {
    expect(nextLoad(fitarc, 20, config)).toBe(20.5);
    expect(nextLoad(curl, 15, config)).toBe(20);
    expect(nextLoad(plank, 0, config)).toBeNull();
  });
});

describe("progression with equipment steps", () => {
  const set = (rating: CompletedSet["rating"]): CompletedSet => ({
    setNumber: 3, targetReps: 8, actualReps: 8, actualWeight: 20, rating, completed: true,
  } as CompletedSet);
  const exercise = (rule: string, eq: Eq, weight: number): ResolvedExercise => ({
    id: "e", definitionId: "d", order: 1, phase: "main", sets: 3, repMin: 8, repMax: { type: "count", value: 8 }, restSeconds: 90, notes: null,
    muscleGroups: [], equipmentDetail: null, isUnilateral: false, isTimeBased: false, hardStreak: 0,
    ...eq, progressionRule: rule, currentWeight: weight,
  } as ResolvedExercise);

  it("adds half a pound to a FitArc exercise on add_0.5lb", () => {
    expect(computeNextWeight(exercise("add_0.5lb", fitarc, 20), set("normal"), config).currentWeight).toBe(20.5);
  });

  it("moves a FitArc exercise to the next load on add_weight", () => {
    expect(computeNextWeight(exercise("add_weight", fitarc, 20), set("normal"), config).currentWeight).toBe(20.5);
  });

  it("moves a dumbbell exercise to the next dumbbell on add_weight, and back after three hard", () => {
    expect(computeNextWeight(exercise("add_weight", curl, 15), set("normal"), config).currentWeight).toBe(20);
    expect(computeNextWeight({ ...exercise("add_weight", curl, 15), hardStreak: 2 }, set("hard"), config).currentWeight).toBe(10);
  });

  it("bumps the next set by the equipment's step when a set is easy", () => {
    expect(liveEasyBump(20, exercise("add_0.5lb", fitarc, 20), config)).toBe(20.5);
    expect(liveEasyBump(15, exercise("add_weight", curl, 15), config)).toBe(20);
  });
});
