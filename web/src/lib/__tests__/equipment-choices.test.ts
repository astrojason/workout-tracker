import { describe, expect, it } from "vitest";
import { applyEquipmentChoice, equipmentChoiceValue, equipmentOptionGroups } from "../equipment-choices";
import { DEFAULT_EQUIPMENT_CONFIG } from "../equipment-calculator";
import type { EquipmentItem, GymMachine, UserEquipmentConfig } from "../types";

// The exercise editor's one Equipment dropdown lists what you own (Equipment settings, your own
// items and gym machines) rather than a fixed list of every kind of equipment.

const fitarc: EquipmentItem = { id: "fitarc", name: "FitArc", kind: "plate_loaded", baseWeight: 5, sides: 1 };
const balls: EquipmentItem = { id: "balls", name: "Medicine balls", kind: "fixed", weights: [2, 6, 9] };
const ball: EquipmentItem = { id: "ball", name: "Stability ball", kind: "none" };
const press: GymMachine = { id: "m1", name: "Chest press", plates: [50, 75, 100] } as GymMachine;

const mine: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  barbells: { has45lb: true, has35lb: false, hasEZBar: false },
  powerBlock: { owned: false, minLbs: 5, maxLbs: 50 },
  fixedDumbbells: [],
  kettlebells: [35],
  bands: ["Red", "Blue"],
  loopBands: [],
  assistedPullupBands: 3,
  grippers: [],
  items: [fitarc, balls, ball],
};

const labels = (groups: ReturnType<typeof equipmentOptionGroups>) => groups.flatMap((g) => g.options.map((o) => o.label));

describe("equipmentOptionGroups", () => {
  it("lists only the equipment you own, then your items, machines and bodyweight", () => {
    const groups = equipmentOptionGroups(mine, [press], "type:bodyweight");
    expect(groups.map((g) => g.label)).toEqual(["Your equipment", "Gym machines", "No equipment"]);
    expect(labels(groups)).toEqual([
      "Olympic bar (45 lb)", "Kettlebells (35 lb)", "Serious Steel bands (Red, Blue)", "Pull-up assist (3 bands)",
      "FitArc", "Medicine balls", "Stability ball",
      "Chest press", "Other machine (enter its weights)",
      "Bodyweight",
    ]);
  });

  it("keeps the exercise's current equipment selectable when you no longer own it", () => {
    const groups = equipmentOptionGroups(mine, [], "type:pulley");
    expect(groups[0].label).toBe("Current (not in your equipment)");
    expect(groups[0].options).toEqual([{ value: "type:pulley", label: "Pulley (Spud system)" }]);
    expect(labels(equipmentOptionGroups(mine, [], "type:barbell_45"))).not.toContain("Pulley (Spud system)");
  });

  it("works with an older config that has no items", () => {
    const { items: _items, ...old } = mine;
    expect(labels(equipmentOptionGroups(old, [], "type:bodyweight"))).not.toContain("FitArc");
  });
});

describe("choice values", () => {
  it("reads an exercise's equipment as one value", () => {
    expect(equipmentChoiceValue({ equipmentType: "barbell_45", equipmentItemId: null, machineId: null }, mine)).toBe("type:barbell_45");
    expect(equipmentChoiceValue({ equipmentType: "machine", equipmentItemId: "fitarc", machineId: null }, mine)).toBe("item:fitarc");
    expect(equipmentChoiceValue({ equipmentType: "machine", equipmentItemId: null, machineId: "m1" }, mine)).toBe("machine:m1");
    expect(equipmentChoiceValue({ equipmentType: "machine", equipmentItemId: null, machineId: null }, mine)).toBe("machine:");
    // An item that has since been removed falls back to the exercise's own type.
    expect(equipmentChoiceValue({ equipmentType: "dumbbell", equipmentItemId: "gone", machineId: null }, mine)).toBe("type:dumbbell");
  });

  it("turns a choice back into the exercise's equipment fields", () => {
    expect(applyEquipmentChoice("type:kettlebell", mine)).toEqual({ equipmentType: "kettlebell", equipmentItemId: null, machineId: null });
    expect(applyEquipmentChoice("machine:m1", mine)).toEqual({ equipmentType: "machine", equipmentItemId: null, machineId: "m1" });
    expect(applyEquipmentChoice("machine:", mine)).toEqual({ equipmentType: "machine", equipmentItemId: null, machineId: null });
    // Items get the closest built-in type, so screens that don't know about items still behave.
    expect(applyEquipmentChoice("item:fitarc", mine)).toEqual({ equipmentType: "machine", equipmentItemId: "fitarc", machineId: null });
    expect(applyEquipmentChoice("item:balls", mine)).toEqual({ equipmentType: "kettlebell", equipmentItemId: "balls", machineId: null });
    expect(applyEquipmentChoice("item:ball", mine)).toEqual({ equipmentType: "bodyweight", equipmentItemId: "ball", machineId: null });
  });
});
