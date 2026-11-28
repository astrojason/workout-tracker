import { describe, expect, it } from "vitest";
import { nextBand, progressionOptionGroups, ruleLabel } from "../progression-choices";
import { computeNextWeight } from "../progression-service";
import { DEFAULT_EQUIPMENT_CONFIG } from "../equipment-calculator";
import { resolveExercise, scopeDefinitions } from "../types";
import type { CompletedSet, Exercise, ExerciseDefinition, ResolvedExercise, UserEquipmentConfig } from "../types";

// Banded exercises progress by moving to the next band you own, not by adding pounds.

const config: UserEquipmentConfig = { ...DEFAULT_EQUIPMENT_CONFIG, bands: ["Orange", "Red", "Blue"], loopBands: ["Light", "Heavy"] };

const band = (overrides: Partial<ResolvedExercise> = {}): ResolvedExercise => ({
  id: "e", definitionId: "d", order: 1, name: "Band Pull-Apart", phase: "main", sets: 3, repMin: 10,
  repMax: { type: "count", value: 15 }, restSeconds: 60, notes: null, muscleGroups: [], isUnilateral: false,
  isTimeBased: false, hardStreak: 0, currentWeight: 0, equipmentType: "band", equipmentDetail: "Red",
  progressionRule: "next_band", ...overrides,
} as ResolvedExercise);

const set = (overrides: Partial<CompletedSet> = {}): CompletedSet => ({
  setNumber: 3, targetReps: 10, actualReps: 15, actualWeight: 0, rating: "easy", completed: true, ...overrides,
} as CompletedSet);

describe("Next band rule", () => {
  it("is offered for Serious Steel bands and loop bands, but not weights", () => {
    const eq = (equipmentType: ExerciseDefinition["equipmentType"]) => ({ name: "x", equipmentType, equipmentItemId: null, weightOptions: null });
    const has = (t: ExerciseDefinition["equipmentType"]) =>
      progressionOptionGroups(eq(t), config, "none").some((g) => g.options.some((o) => o.value === "next_band"));
    expect(has("band")).toBe(true);
    expect(has("loop_band")).toBe(true);
    expect(has("barbell_45")).toBe(false);
    expect(ruleLabel("next_band")).toBe("Next band");
  });

  it("steps to the next band you own, in order of resistance", () => {
    expect(nextBand("band", "Red", config)).toBe("Blue");
    expect(nextBand("band", "Orange", config)).toBe("Red"); // Purple isn't owned
    expect(nextBand("band", "Blue", config)).toBeNull();
    expect(nextBand("loop_band", "Light", config)).toBe("Heavy");
  });

  it("moves up a band when the last set hits the top of the rep range and is Easy", () => {
    expect(computeNextWeight(band(), set(), config)).toEqual({ currentWeight: 0, hardStreak: 0, equipmentDetail: "Blue" });
  });

  it("moves up a band after an AMRAP last set of at least twice the target", () => {
    const amrap = band({ repMax: { type: "failure" } });
    expect(computeNextWeight(amrap, set({ actualReps: 20, rating: "hard" }), config).equipmentDetail).toBe("Blue");
    expect(computeNextWeight(amrap, set({ actualReps: 19, rating: "hard" }), config).equipmentDetail).toBeUndefined();
  });

  it("holds the band when the set was Normal, short of the top, skipped, or already on the heaviest band", () => {
    expect(computeNextWeight(band(), set({ rating: "normal" }), config).equipmentDetail).toBeUndefined();
    expect(computeNextWeight(band(), set({ actualReps: 14 }), config).equipmentDetail).toBeUndefined();
    expect(computeNextWeight(band(), set({ completed: false }), config).equipmentDetail).toBeUndefined();
    expect(computeNextWeight(band({ equipmentDetail: "Blue" }), set(), config).equipmentDetail).toBeUndefined();
  });

  it("doesn't move up after time away", () => {
    expect(computeNextWeight(band(), set(), config, 20).equipmentDetail).toBeUndefined();
  });
});

describe("a program's progressed band", () => {
  const now = new Date();
  const def: ExerciseDefinition = {
    id: "d", name: "Band Pull-Apart", muscleGroups: [], equipmentType: "band", equipmentDetail: "Orange",
    progressionRule: "next_band", isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now,
  };
  const row = (overrides: Partial<Exercise> = {}): Exercise => ({
    id: "e", definitionId: "d", order: 1, phase: "main", sets: 3, repMin: 10, repMax: { type: "count", value: 15 },
    restSeconds: 60, notes: null, equipmentDetail: "Red", ...overrides,
  });
  const scoped = scopeDefinitions({ d: def }, { weights: { d: { currentWeight: 0, hardStreak: 0, equipmentDetail: "Blue" } } });

  it("replaces the spreadsheet row's band on working sets", () => {
    expect(resolveExercise(row(), scoped).equipmentDetail).toBe("Blue");
  });

  it("leaves a warm-up row's own lighter band alone", () => {
    expect(resolveExercise(row({ phase: "warmup" }), scoped).equipmentDetail).toBe("Red");
  });

  it("falls back to the row's band when the program has none", () => {
    const plain = scopeDefinitions({ d: def }, { weights: { d: { currentWeight: 0, hardStreak: 0 } } });
    expect(resolveExercise(row(), plain).equipmentDetail).toBe("Red");
  });
});
