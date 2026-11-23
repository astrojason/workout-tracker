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
      // With no lighter load to use, the only warm-up is one half-reps set at the work weight.
      if (ramp.length === 1 && ramp[0].currentWeight === w) {
        expect(ramp[0].repMin).toBeLessThan(6);
        continue;
      }
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

  it("keeps one light set when the work weight is about the bar (no lighter load to ramp)", () => {
    const result = rampWarmups([sheetWarmup(), work({ currentWeight: 45 })]);
    const warmups = result.filter((e) => e.phase === "warmup");
    expect(warmups).toHaveLength(1);
    expect(warmups[0].currentWeight).toBe(45);
    expect(warmups[0].sets).toBe(1);
    expect(warmups[0].repMin).toBeLessThan(6);
    expect(result[result.length - 1].id).toBe("main");
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
    const result = rampWarmups([solo, work({ order: 2 })]);
    expect(result[0]).toMatchObject({ id: "wu", currentWeight: 0, sets: 3 });
    expect(result[result.length - 1].id).toBe("main");
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

  describe("auto-generated warm-ups (no warm-up row in the program)", () => {
    const warmupsBefore = (result: ResolvedExercise[], id: string) => {
      const i = result.findIndex((e) => e.id === id);
      const out: ResolvedExercise[] = [];
      for (let j = i - 1; j >= 0 && result[j].phase === "warmup"; j--) out.unshift(result[j]);
      return out;
    };

    it("adds a full ramp right before a barbell lift that has no warm-up row", () => {
      const other = ex({ id: "curl", definitionId: "curl", name: "Curl", equipmentType: "dumbbell", currentWeight: 30 });
      const result = rampWarmups([other, work()]);
      expect(warmupsBefore(result, "main").map((e) => e.currentWeight)).toEqual([45, 80, 120, 160]);
      expect(result[result.length - 1].id).toBe("main");
    });

    it("gives every non-warm-up exercise at least one warm-up set, whatever the equipment", () => {
      const exercises = [
        ex({ id: "db", definitionId: "db", name: "DB Press", equipmentType: "dumbbell", currentWeight: 50 }),
        ex({ id: "kb", definitionId: "kb", name: "KB Swing", equipmentType: "kettlebell", currentWeight: 35 }),
        ex({ id: "bw", definitionId: "bw", name: "Push-up", equipmentType: "bodyweight", currentWeight: 0, repMin: 10 }),
        ex({ id: "band", definitionId: "band", name: "Band Pull-apart", equipmentType: "band", currentWeight: 0, equipmentDetail: "Red" }),
        ex({ id: "plank", definitionId: "plank", name: "Plank", equipmentType: "bodyweight", isTimeBased: true, currentWeight: 0, repMin: 60, repMax: { type: "count", value: 60 } }),
        ex({ id: "mach", definitionId: "mach", name: "Leg Press", equipmentType: "machine", currentWeight: 150, weightOptions: [50, 70, 90, 110, 130, 150] }),
        ex({ id: "fin", definitionId: "fin", name: "Finisher", phase: "finisher", equipmentType: "bodyweight", currentWeight: 0 }),
        work(),
      ];
      const result = rampWarmups(exercises);
      for (const e of exercises) {
        const wu = warmupsBefore(result, e.id);
        expect(wu.length, e.name).toBeGreaterThanOrEqual(1);
        for (const step of wu) {
          expect(step.definitionId).toBe(e.definitionId);
          expect(step.progressionRule).toBe("none");
          expect(step.sets).toBe(1);
          if (e.currentWeight > 0) expect(step.currentWeight).toBeLessThanOrEqual(e.currentWeight);
        }
      }
    });

    it("loads a dumbbell/kettlebell warm-up at about half, rounded down to 5 lb", () => {
      const result = rampWarmups([ex({ id: "db", definitionId: "db", equipmentType: "dumbbell", currentWeight: 55 })]);
      expect(warmupsBefore(result, "db").map((e) => e.currentWeight)).toEqual([25]);
    });

    it("loads a machine warm-up at a weight the machine has, at or under half", () => {
      const result = rampWarmups([ex({ id: "m", definitionId: "m", equipmentType: "machine", currentWeight: 150, weightOptions: [50, 70, 90, 110, 130, 150] })]);
      expect(warmupsBefore(result, "m").map((e) => e.currentWeight)).toEqual([70]);
    });

    it("does an unloaded or time-based exercise at the same setup with about half the reps/time", () => {
      const result = rampWarmups([
        ex({ id: "bw", definitionId: "bw", equipmentType: "bodyweight", currentWeight: 0, repMin: 10 }),
        ex({ id: "plank", definitionId: "plank", equipmentType: "bodyweight", isTimeBased: true, currentWeight: 0, repMin: 60, repMax: { type: "count", value: 60 } }),
      ]);
      expect(warmupsBefore(result, "bw")[0].repMin).toBe(5);
      expect(warmupsBefore(result, "plank")[0].repMin).toBe(30);
    });

    it("never makes a warm-up AMRAP or to failure", () => {
      const result = rampWarmups([ex({ id: "bw", definitionId: "bw", equipmentType: "bodyweight", currentWeight: 0, repMax: { type: "failure" }, lastSetAmrap: true })]);
      const wu = warmupsBefore(result, "bw")[0];
      expect(wu.repMax.type).toBe("count");
      expect(wu.lastSetAmrap).toBeUndefined();
    });

    it("skips an exercise marked skipWarmup", () => {
      const result = rampWarmups([work({ skipWarmup: true })]);
      expect(result.map((e) => e.id)).toEqual(["main"]);
    });

    it("doesn't add warm-ups to a lift already warmed up earlier in the workout", () => {
      const result = rampWarmups([work(), ex({ id: "main2", definitionId: "bench", order: 3, sets: 2 })]);
      expect(warmupsBefore(result, "main2")).toEqual([]);
    });

    it("doesn't add a second warm-up when the program already has a warm-up row for the lift", () => {
      const result = rampWarmups([sheetWarmup(), work()]);
      expect(result.filter((e) => e.phase === "warmup").map((e) => e.currentWeight)).toEqual([45, 80, 120, 160]);
    });

    it("leaves warm-up-phase exercises alone (no warm-up for a warm-up)", () => {
      const solo = ex({ id: "wu", definitionId: "ext-rot", phase: "warmup", equipmentType: "band", currentWeight: 0 });
      expect(rampWarmups([solo]).map((e) => e.id)).toEqual(["wu"]);
    });

    it("rests a minute between auto warm-up steps and into the work set", () => {
      const ramp = rampWarmups([work()]).filter((e) => e.phase === "warmup");
      expect(ramp.every((e) => e.restAfter === 60)).toBe(true);
    });
  });
});
