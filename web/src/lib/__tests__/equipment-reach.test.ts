import { describe, expect, it } from "vitest";
import type { ExerciseDefinition, Program, UserEquipmentConfig } from "../types";
import { DEFAULT_EQUIPMENT_CONFIG } from "../equipment-calculator";
import { equipmentReach, reachStats, unmakeableWeights } from "../equipment-reach";

const config: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  barbells: { has45lb: true, has35lb: false, hasEZBar: false },
  plates: [
    { weight: 45, totalOwned: 2 }, { weight: 25, totalOwned: 2 }, { weight: 10, totalOwned: 2 },
    { weight: 5, totalOwned: 2 }, { weight: 2.5, totalOwned: 2 },
  ],
  powerBlock: { owned: true, minLbs: 5, maxLbs: 50 },
  fixedDumbbells: [2],
  kettlebells: [26, 18],
  assistedPullupBands: 3,
};

describe("equipmentReach", () => {
  const rows = equipmentReach(config);
  const row = (name: string) => rows.find((r) => r.name === name)!;

  it("lists only what you own", () => {
    expect(rows.map((r) => r.name)).toEqual(["Barbell (45 lb)", "PowerBlock", "Fixed dumbbells", "Kettlebells", "Assisted pull-up"]);
  });

  it("keeps only barbell loads the app's plate calculation can actually make", () => {
    const loads = row("Barbell (45 lb)").loads;
    expect(loads[0]).toBe(45);
    expect(loads).toContain(80);   // 17.5 a side
    expect(loads).not.toContain(85); // 20 a side needs two 5s a side
    expect(loads).toContain(95);
    expect(loads[loads.length - 1]).toBe(220);
  });

  it("covers the PowerBlock range in 2.5 lb steps, sorts kettlebells, and counts bands", () => {
    expect(row("PowerBlock").loads).toEqual([5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50]);
    expect(row("Kettlebells").loads).toEqual([18, 26]);
    expect(row("Assisted pull-up")).toMatchObject({ unit: "bands", loads: [0, 1, 2, 3] });
  });
});

describe("reachStats", () => {
  it("gives the range, the smallest step and the first biggest gap", () => {
    expect(reachStats([18, 26, 35, 44])).toEqual({ min: 18, max: 44, smallestStep: 8, biggestGap: { from: 26, to: 35 } });
    expect(reachStats([3])).toEqual({ min: 3, max: 3, smallestStep: null, biggestGap: null });
  });
  it("finds the barbell's biggest gap", () => {
    const loads = equipmentReach(config).find((r) => r.name === "Barbell (45 lb)")!.loads;
    expect(reachStats(loads).biggestGap).toEqual({ from: 80, to: 95 });
  });
});

describe("unmakeableWeights", () => {
  const now = new Date();
  const def = (id: string, name: string, extra: Partial<ExerciseDefinition>): ExerciseDefinition => ({
    id, name, muscleGroups: [], equipmentType: "barbell_45", equipmentDetail: null, progressionRule: "add_5lb",
    isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now, ...extra,
  });
  const definitions = {
    squat: def("squat", "Back Squat", {}),
    bench: def("bench", "Bench Press", {}),
    goblet: def("goblet", "Goblet Squat", { equipmentType: "kettlebell" }),
    curl: def("curl", "Seated Leg Curl", { equipmentType: "machine", weightOptions: [80, 90, 100] }),
    pull: def("pull", "Assisted Pull-up", { equipmentType: "assisted_pullup" }),
    press: def("press", "Overhead Press", { equipmentType: "barbell_35" }),
    row: def("row", "DB Row", { equipmentType: "powerblock" }),
  };
  const program = (id: string, name: string, weights: Record<string, number>, archived = false): Program => ({
    id, name, totalWeeks: 12, createdAt: now, archived,
    weights: Object.fromEntries(Object.entries(weights).map(([k, w]) => [k, { currentWeight: w, hardStreak: 0 }])),
  });

  it("lists each program's working weights your equipment can't make, with the nearest you can", () => {
    const result = unmakeableWeights(
      [program("p1", "Block B", { squat: 85, bench: 95, goblet: 20, curl: 95, pull: 4, press: 65, row: 52.5 }), program("old", "Old", { squat: 85 }, true)],
      definitions, config,
    );
    expect(result).toEqual([
      { programId: "p1", programName: "Block B", definitionId: "squat", exerciseName: "Back Squat", weight: 85, unit: "lb", reason: "Your plates can't make it", below: 80, above: 95 },
      { programId: "p1", programName: "Block B", definitionId: "goblet", exerciseName: "Goblet Squat", weight: 20, unit: "lb", reason: "No kettlebell that weight", below: 18, above: 26 },
      { programId: "p1", programName: "Block B", definitionId: "curl", exerciseName: "Seated Leg Curl", weight: 95, unit: "lb", reason: "Not a setting on the machine", below: 90, above: 100 },
      { programId: "p1", programName: "Block B", definitionId: "pull", exerciseName: "Assisted Pull-up", weight: 4, unit: "bands", reason: "More bands than you own", below: 3, above: null },
      { programId: "p1", programName: "Block B", definitionId: "press", exerciseName: "Overhead Press", weight: 65, unit: "lb", reason: "You don't have a 35 lb barbell", below: null, above: null },
      { programId: "p1", programName: "Block B", definitionId: "row", exerciseName: "DB Row", weight: 52.5, unit: "lb", reason: "Outside your dumbbells", below: 50, above: null },
    ]);
  });
});
