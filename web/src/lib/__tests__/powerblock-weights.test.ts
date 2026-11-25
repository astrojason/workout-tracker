import { describe, expect, it } from "vitest";
import { DEFAULT_EQUIPMENT_CONFIG, nearestPowerBlock, powerBlockWeights, stepPowerBlock } from "../equipment-calculator";
import { equipmentReach } from "../equipment-reach";
import { equipmentLoads } from "../progression-choices";
import { parsePowerBlockWeights } from "../powerblock";
import type { UserEquipmentConfig } from "../types";

// Adjustable dumbbells can be set to exactly the weights you enter (like a machine's stack), not
// only every 2.5 lb between a min and a max.

const custom: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  fixedDumbbells: [],
  powerBlock: { owned: true, minLbs: 5, maxLbs: 22.5, weights: [15, 5, 10, 22.5, 10] },
};
const legacy: UserEquipmentConfig = { ...DEFAULT_EQUIPMENT_CONFIG, fixedDumbbells: [], powerBlock: { owned: true, minLbs: 5, maxLbs: 15 } };

describe("powerBlockWeights", () => {
  it("uses the weights you entered, sorted and without repeats", () => {
    expect(powerBlockWeights(custom)).toEqual([5, 10, 15, 22.5]);
  });
  it("falls back to every 2.5 lb between min and max", () => {
    expect(powerBlockWeights(legacy)).toEqual([5, 7.5, 10, 12.5, 15]);
  });
});

describe("nearestPowerBlock with entered weights", () => {
  it("snaps to the nearest weight you entered, or down when asked", () => {
    expect(nearestPowerBlock(18, custom)).toBe(15);
    expect(nearestPowerBlock(19, custom)).toBe(22.5);
    expect(nearestPowerBlock(21, custom, true)).toBe(15);
    expect(nearestPowerBlock(40, custom)).toBe(22.5);
    expect(nearestPowerBlock(2, custom)).toBe(5);
  });
});

describe("stepPowerBlock", () => {
  it("moves to the next or previous weight, even across a big gap", () => {
    expect(stepPowerBlock(15, 1, custom)).toBe(22.5);
    expect(stepPowerBlock(15, -1, custom)).toBe(10);
    expect(stepPowerBlock(22.5, 1, custom)).toBe(22.5);
    expect(stepPowerBlock(5, -1, custom)).toBe(5);
    expect(stepPowerBlock(16, 1, custom)).toBe(22.5); // off-list: from where it would snap
  });
});

describe("the entered weights reach the rest of the app", () => {
  it("are what the Equipment page says it can load", () => {
    expect(equipmentReach(custom).find((r) => r.key === "powerblock")?.loads).toEqual([5, 10, 15, 22.5]);
  });
  it("are the loads progression and warm-ups step through", () => {
    expect(equipmentLoads({ name: "DB Press", equipmentType: "powerblock", equipmentItemId: null, weightOptions: null }, custom)).toEqual([5, 10, 15, 22.5]);
  });
});

describe("parsePowerBlockWeights", () => {
  it("reads a comma or space separated list", () => {
    expect(parsePowerBlockWeights("5, 7.5 10,12.5")).toEqual({ ok: true, weights: [5, 7.5, 10, 12.5] });
  });
  it("rejects an empty list or a bad number", () => {
    expect(parsePowerBlockWeights("")).toEqual({ ok: false, error: "Enter the weights your dumbbells can be set to, e.g. 5, 7.5, 10." });
    expect(parsePowerBlockWeights("5, ten")).toEqual({ ok: false, error: "\"ten\" isn't a weight. Use numbers in lb, separated by commas." });
    expect(parsePowerBlockWeights("0, 5")).toEqual({ ok: false, error: "\"0\" isn't a weight. Use numbers in lb, separated by commas." });
  });
});
