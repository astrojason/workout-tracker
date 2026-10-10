import { describe, it, expect } from "vitest";
import { rampWarmups } from "../warmup-ramp";
import type { ResolvedExercise } from "../types";

function ex(overrides: Partial<ResolvedExercise>): ResolvedExercise {
  return {
    id: "e",
    definitionId: "bench",
    order: 1,
    name: "Bench Press",
    phase: "main",
    equipmentType: "barbell_45",
    equipmentDetail: null,
    muscleGroups: [],
    sets: 3,
    repMin: 6,
    repMax: { type: "count", value: 8 },
    restSeconds: 120,
    progressionRule: "add_5lb",
    isUnilateral: false,
    isTimeBased: false,
    notes: null,
    currentWeight: 200,
    hardStreak: 0,
    ...overrides,
  };
}

const sheetWarmup = (o: Partial<ResolvedExercise> = {}) =>
  ex({ id: "wu", order: 1, phase: "warmup", sets: 2, repMin: 10, repMax: { type: "count", value: 10 }, restSeconds: 45, restAfter: false, currentWeight: 45, weight: 45, progressionRule: "none", ...o });
const work = (o: Partial<ResolvedExercise> = {}) => ex({ id: "main", order: 2, ...o });

describe("rampWarmups", () => {
  it("replaces a lift's warm-up with a ramp of lighter sets built from the work weight", () => {
    const result = rampWarmups([sheetWarmup(), work()]);
    const ramp = result.filter((e) => e.phase === "warmup");
    // empty bar, then 40% / 60% / 80% of 200 — all exactly loadable
    expect(ramp.map((e) => e.currentWeight)).toEqual([45, 80, 120, 160]);
    expect(ramp.map((e) => e.sets)).toEqual([1, 1, 1, 1]);
    expect(ramp.map((e) => e.repMin)).toEqual([8, 5, 3, 2]);
    expect(result[result.length - 1].id).toBe("main");
    expect(result[result.length - 1].currentWeight).toBe(200);
  });

  it("never loads a warm-up at or above the work weight, or above 85% of it, whatever the work weight", () => {
    for (const w of [50, 65, 95, 105, 135, 155, 185, 225, 315, 405]) {
      const ramp = rampWarmups([sheetWarmup(), work({ currentWeight: w })]).filter((e) => e.phase === "warmup");
      for (const step of ramp) {
        expect(step.currentWeight).toBeLessThan(w);
        expect(step.currentWeight).toBeLessThanOrEqual(w * 0.85 + 1e-9);
      }
    }
  });

  it("ramps strictly upward with no duplicate weights", () => {
    for (const w of [65, 95, 105, 135, 185, 225]) {
      const weights = rampWarmups([sheetWarmup(), work({ currentWeight: w })])
        .filter((e) => e.phase === "warmup").map((e) => e.currentWeight);
      expect(weights).toEqual([...new Set(weights)].sort((a, b) => a - b));
    }
  });

  it("drops the warm-up entirely when the work weight is about the bar", () => {
    const result = rampWarmups([sheetWarmup(), work({ currentWeight: 45 })]);
    expect(result.map((e) => e.id)).toEqual(["main"]);
  });

  it("gives ramp steps no progression, so a warm-up can never change a weight", () => {
    const ramp = rampWarmups([sheetWarmup({ progressionRule: "add_5lb" }), work()]).filter((e) => e.phase === "warmup");
    expect(ramp.every((e) => e.progressionRule === "none")).toBe(true);
    expect(ramp.every((e) => e.lastSetAmrap !== true)).toBe(true);
  });

  it("rests between ramp steps, then keeps the sheet's transition into the work set", () => {
    const ramp = rampWarmups([sheetWarmup(), work()]).filter((e) => e.phase === "warmup");
    expect(ramp.slice(0, -1).every((e) => e.restAfter === 60)).toBe(true);
    expect(ramp[ramp.length - 1].restAfter).toBe(false);
  });

  it("re-indexes order 1..N with unique ids", () => {
    const other = ex({ id: "row", order: 3, definitionId: "row", name: "Row" });
    const result = rampWarmups([sheetWarmup(), work(), other]);
    expect(result.map((e) => e.order)).toEqual(result.map((_, i) => i + 1));
    expect(new Set(result.map((e) => e.id)).size).toBe(result.length);
  });

  it("collapses several warm-up rows for the same lift into one ramp", () => {
    const result = rampWarmups([sheetWarmup({ id: "wu1" }), sheetWarmup({ id: "wu2", order: 2, currentWeight: 95, weight: 95 }), work({ order: 3 })]);
    expect(result.filter((e) => e.phase === "warmup").map((e) => e.currentWeight)).toEqual([45, 80, 120, 160]);
  });

  it("ramps PowerBlock warm-ups, rounded down to its 2.5 lb steps", () => {
    const ramp = rampWarmups([
      sheetWarmup({ equipmentType: "powerblock", currentWeight: 10, weight: 10 }),
      work({ equipmentType: "powerblock", currentWeight: 45 }),
    ]).filter((e) => e.phase === "warmup");
    expect(ramp.length).toBeGreaterThan(0);
    for (const step of ramp) {
      expect(step.currentWeight % 2.5).toBe(0);
      expect(step.currentWeight).toBeLessThan(45);
    }
  });

  it("leaves a warm-up with no matching work set alone", () => {
    const solo = ex({ id: "wu", definitionId: "ext-rot", name: "External Rotations", phase: "warmup", equipmentType: "band", currentWeight: 0 });
    expect(rampWarmups([solo, work({ order: 2 })]).map((e) => e.id)).toEqual(["wu", "main"]);
  });

  it("caps a non-ramped warm-up (e.g. kettlebell) so it never exceeds the work weight", () => {
    const result = rampWarmups([
      sheetWarmup({ equipmentType: "kettlebell", currentWeight: 45, weight: 45 }),
      work({ equipmentType: "kettlebell", currentWeight: 25 }),
    ]);
    expect(result.find((e) => e.id === "wu")!.currentWeight).toBe(25);
  });

  it("keeps the sheet warm-up as is when the work weight isn't set yet", () => {
    const result = rampWarmups([sheetWarmup(), work({ currentWeight: 0 })]);
    expect(result.find((e) => e.id === "wu")!.currentWeight).toBe(45);
  });
});
