import { describe, expect, it } from "vitest";
import { rampWarmups } from "../warmup-ramp";
import { DEFAULT_WARMUP_RULES, normalizeWarmupRules, warmupGroup, type WarmupRules } from "../warmup-rules";
import { DEFAULT_EQUIPMENT_CONFIG } from "../equipment-calculator";
import type { ResolvedExercise, UserEquipmentConfig } from "../types";

// Warm-ups follow the user's saved rules: one rule per equipment group (ramp, one lighter set,
// fewer reps, or none), shared limits, and an exercise can opt out of warm-ups entirely.

const config: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  kettlebells: [15, 25, 35],
  items: [
    { id: "fitarc", name: "FitArc", kind: "plate_loaded", baseWeight: 5, sides: 1 },
    { id: "ball", name: "Stability ball", kind: "none" },
  ],
};

function ex(o: Partial<ResolvedExercise>): ResolvedExercise {
  return {
    id: "main", definitionId: "lift", order: 1, name: "Bench Press", phase: "main", equipmentType: "barbell_45",
    equipmentDetail: null, muscleGroups: [], sets: 3, repMin: 6, repMax: { type: "count", value: 8 }, restSeconds: 120,
    progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, notes: null, currentWeight: 200, hardStreak: 0, ...o,
  };
}
const warmups = (list: ResolvedExercise[]) => list.filter((e) => e.phase === "warmup");
const rules = (edit: (r: WarmupRules) => void): WarmupRules => { const r = structuredClone(DEFAULT_WARMUP_RULES); edit(r); return r; };

describe("warmupGroup", () => {
  it("puts each exercise in its equipment's group", () => {
    expect(warmupGroup(ex({}), config)).toBe("plates");
    expect(warmupGroup(ex({ equipmentType: "machine", equipmentItemId: "fitarc" }), config)).toBe("plates");
    expect(warmupGroup(ex({ equipmentType: "powerblock" }), config)).toBe("powerblock");
    expect(warmupGroup(ex({ equipmentType: "kettlebell" }), config)).toBe("fixed");
    expect(warmupGroup(ex({ equipmentType: "machine", weightOptions: [50, 100] }), config)).toBe("fixed");
    expect(warmupGroup(ex({ equipmentType: "bodyweight", equipmentItemId: "ball", currentWeight: 0 }), config)).toBe("unloaded");
    expect(warmupGroup(ex({ isTimeBased: true }), config)).toBe("unloaded");
  });
});

describe("normalizeWarmupRules", () => {
  it("fills anything missing from the defaults", () => {
    const r = normalizeWarmupRules({ maxPct: 80, groups: { fixed: { mode: "none" } } } as never);
    expect(r.maxPct).toBe(80);
    expect(r.groups.fixed.mode).toBe("none");
    expect(r.groups.fixed.singlePct).toBe(DEFAULT_WARMUP_RULES.groups.fixed.singlePct);
    expect(r.groups.plates).toEqual(DEFAULT_WARMUP_RULES.groups.plates);
    expect(normalizeWarmupRules(undefined)).toEqual(DEFAULT_WARMUP_RULES);
  });
});

describe("rampWarmups with rules", () => {
  it("uses your own ramp steps", () => {
    const r = rules((x) => { x.groups.plates.steps = [{ pct: 50, reps: 5 }, { pct: 75, reps: 2 }]; x.groups.plates.emptyBar = false; });
    expect(warmups(rampWarmups([ex({})], config, r)).map((e) => [e.currentWeight, e.repMin])).toEqual([[100, 5], [150, 2]]);
  });

  it("ramps a plate-loaded item from its empty weight", () => {
    const fitarc = ex({ name: "FitArc Row", equipmentType: "machine", equipmentItemId: "fitarc", currentWeight: 25 });
    expect(warmups(rampWarmups([fitarc], config)).map((e) => e.currentWeight)).toEqual([5, 10, 15, 20]);
  });

  it("skips warm-ups for a group set to None", () => {
    const r = rules((x) => { x.groups.fixed.mode = "none"; });
    expect(warmups(rampWarmups([ex({ equipmentType: "kettlebell", currentWeight: 35 })], config, r))).toEqual([]);
  });

  it("uses your share of the reps for Fewer reps", () => {
    const r = rules((x) => { x.groups.unloaded.mode = "fewer"; x.groups.unloaded.fewerPct = 30; });
    const pushup = ex({ equipmentType: "bodyweight", currentWeight: 0, repMin: 10 });
    expect(warmups(rampWarmups([pushup], config, r)).map((e) => e.repMin)).toEqual([3]);
  });

  it("uses your percentage for One lighter set, on a bell you own", () => {
    const r = rules((x) => { x.groups.fixed.singlePct = 70; });
    expect(warmups(rampWarmups([ex({ equipmentType: "kettlebell", currentWeight: 35 })], config, r)).map((e) => e.currentWeight)).toEqual([15]);
    // 70% of 35 is 24.5: no 25 under it, so the 15.
  });

  it("drops ramp steps over your limit", () => {
    const r = rules((x) => { x.maxPct = 70; });
    expect(warmups(rampWarmups([ex({})], config, r)).map((e) => e.currentWeight)).toEqual([45, 80, 120]);
  });

  it("rests your chosen time after each warm-up set", () => {
    const r = rules((x) => { x.restSeconds = 45; });
    expect(warmups(rampWarmups([ex({})], config, r)).map((e) => e.restAfter)).toEqual([45, 45, 45, 45]);
  });

  it("warms up a lift again later in the workout when once-per-workout is off", () => {
    const list = [ex({ id: "a" }), ex({ id: "b", definitionId: "other", name: "Row" }), ex({ id: "c" })];
    expect(warmups(rampWarmups(list, config)).filter((e) => e.definitionId === "lift").length).toBe(4);
    const r = rules((x) => { x.oncePerWorkout = false; });
    expect(warmups(rampWarmups(list, config, r)).filter((e) => e.definitionId === "lift").length).toBe(8);
  });

  it("gives no warm-up to an exercise set to None", () => {
    expect(warmups(rampWarmups([ex({ warmup: "none" })], config))).toEqual([]);
  });
});
