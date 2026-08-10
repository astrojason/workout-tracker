import { describe, it, expect } from "vitest";
import {
  calculateBarbell,
  calculateLandmine,
  nearestPowerBlock,
  getPowerBlockInstructions,
  plateDisplayString,
  plateFullDisplayString,
  getEquipmentDisplay,
  equipmentDisplayText,
  equipmentShortText,
  FIXED_DUMBBELLS,
  KETTLEBELL_WEIGHTS,
} from "../equipment-calculator";
import type { ResolvedExercise, PlateConfiguration } from "../types";

// Helper to create a minimal resolved exercise (occurrence + definition merged) for getEquipmentDisplay tests
function makeExercise(overrides: Partial<ResolvedExercise>): ResolvedExercise {
  return {
    id: "test-id",
    definitionId: "def-test-id",
    order: 1,
    name: "Test Exercise",
    phase: "main",
    equipmentType: "barbell_45",
    equipmentDetail: null,
    muscleGroups: [],
    currentWeight: 100,
    hardStreak: 0,
    sets: 3,
    repMin: 8,
    repMax: { type: "count", value: 12 },
    restSeconds: 120,
    progressionRule: "add_5lb",
    isUnilateral: false,
    isTimeBased: false,
    notes: null,
    ...overrides,
  };
}

describe("calculateBarbell", () => {
  it("returns bar only when target equals bar weight", () => {
    const result = calculateBarbell(45, 45);
    expect(result.achievedWeight).toBe(45);
    expect(result.perSide).toEqual([]);
  });

  it("returns bar only when target is less than bar weight", () => {
    const result = calculateBarbell(30, 45);
    expect(result.achievedWeight).toBe(45);
    expect(result.perSide).toEqual([]);
  });

  it("returns bar only when target is zero", () => {
    const result = calculateBarbell(0, 45);
    expect(result.achievedWeight).toBe(45);
    expect(result.perSide).toEqual([]);
  });

  it("returns bar only when target is negative", () => {
    const result = calculateBarbell(-10, 45);
    expect(result.achievedWeight).toBe(45);
    expect(result.perSide).toEqual([]);
  });

  it("calculates 135 on 45lb bar (1x45 per side)", () => {
    const result = calculateBarbell(135, 45);
    expect(result.achievedWeight).toBe(135);
    expect(result.perSide).toEqual([{ plate: 45, count: 1 }]);
  });

  it("calculates 185 on 45lb bar (1x45 + 1x25 per side)", () => {
    // perSide needs 70 lbs = 45 + 25
    const result = calculateBarbell(185, 45);
    expect(result.achievedWeight).toBe(185);
    expect(result.perSide).toContainEqual({ plate: 45, count: 1 });
    expect(result.perSide).toContainEqual({ plate: 25, count: 1 });
  });

  it("calculates 95 on 45lb bar (1x25 per side)", () => {
    const result = calculateBarbell(95, 45);
    expect(result.achievedWeight).toBe(95);
    expect(result.perSide).toEqual([{ plate: 25, count: 1 }]);
  });

  it("calculates 65 on 45lb bar (1x10 per side)", () => {
    const result = calculateBarbell(65, 45);
    expect(result.achievedWeight).toBe(65);
    expect(result.perSide).toEqual([{ plate: 10, count: 1 }]);
  });

  it("calculates 55 on 45lb bar (1x5 per side)", () => {
    const result = calculateBarbell(55, 45);
    expect(result.achievedWeight).toBe(55);
    expect(result.perSide).toEqual([{ plate: 5, count: 1 }]);
  });

  it("handles fractional plates: 46 on 45lb bar (1x0.5 per side)", () => {
    const result = calculateBarbell(46, 45);
    expect(result.achievedWeight).toBe(46);
    expect(result.perSide).toEqual([{ plate: 0.5, count: 1 }]);
  });

  it("handles 0.75 plates: 46.5 on 45lb bar", () => {
    const result = calculateBarbell(46.5, 45);
    expect(result.achievedWeight).toBe(46.5);
    expect(result.perSide).toEqual([{ plate: 0.75, count: 1 }]);
  });

  it("returns exact weight when target is achievable (143 on 45lb bar)", () => {
    // 143 = 45 bar + 49/side = 45+2.5+1+0.5 per side — exact match via greedy
    const result = calculateBarbell(143, 45);
    expect(result.achievedWeight).toBe(143);
    expect(result.perSide.length).toBeGreaterThan(0);
  });

  it("rounds DOWN to nearest achievable weight when exact match not possible (greedy gap)", () => {
    // 47.5 on 45lb bar: per side = 1.25
    // Greedy picks 1lb, leaves 0.25 — no plate exists, so exact fails
    // Nearest achievable DOWN = 47 lbs (per side = 1.0 = 1x1lb plate)
    const result = calculateBarbell(47.5, 45);
    expect(result.achievedWeight).toBe(47);
    expect(result.perSide).toEqual([{ plate: 1, count: 1 }]);
  });

  it("works with 35lb bar", () => {
    const result = calculateBarbell(105, 35);
    expect(result.achievedWeight).toBe(105);
    expect(result.perSide).toContainEqual({ plate: 35, count: 1 });
  });

  it("works with EZ bar (15lb)", () => {
    const result = calculateBarbell(65, 15);
    expect(result.achievedWeight).toBe(65);
    expect(result.perSide).toEqual([{ plate: 25, count: 1 }]);
  });

  it("uses multiple plate denominations for complex weight", () => {
    // 215 on 45lb bar: per side = 85 = 45 + 35 + 5
    const result = calculateBarbell(215, 45);
    expect(result.achievedWeight).toBe(215);
    const total = result.perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
    expect(total).toBe(85);
  });

  it("uses greedy algorithm for 145 on 45lb bar (per side = 50 = 45 + 5)", () => {
    // Greedy picks largest first: 45 + 5 = 50, not 2x25
    const result = calculateBarbell(145, 45);
    expect(result.achievedWeight).toBe(145);
    expect(result.perSide).toContainEqual({ plate: 45, count: 1 });
    expect(result.perSide).toContainEqual({ plate: 5, count: 1 });
  });

  it("uses 2x10 plates when needed", () => {
    // 85 on 45lb bar: per side = 20 = 2x10
    const result = calculateBarbell(85, 45);
    expect(result.achievedWeight).toBe(85);
    expect(result.perSide).toEqual([{ plate: 10, count: 2 }]);
  });

  it("respects max plate count limits", () => {
    // Only 1x45 per side available, so can't do 2x45
    const result = calculateBarbell(225, 45);
    // per side = 90. Can't do 2x45. Should do 45+35+10 = 90
    expect(result.achievedWeight).toBe(225);
    const has45 = result.perSide.find((p) => p.plate === 45);
    expect(has45?.count).toBe(1); // max 1 per side
  });

  it("preserves target weight in result", () => {
    const result = calculateBarbell(185, 45);
    expect(result.targetWeight).toBe(185);
    expect(result.barWeight).toBe(45);
  });
});

describe("calculateLandmine", () => {
  it("sets isLandmine flag to true", () => {
    const result = calculateLandmine(85, 45);
    expect(result.isLandmine).toBe(true);
  });

  it("puts all plate weight on one side (85 lbs = 45 bar + 40 one side)", () => {
    const result = calculateLandmine(85, 45);
    expect(result.achievedWeight).toBe(85);
    const oneSideTotal = result.perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
    expect(oneSideTotal).toBe(40);
  });

  it("returns bar only when target equals bar weight", () => {
    const result = calculateLandmine(45, 45);
    expect(result.achievedWeight).toBe(45);
    expect(result.perSide).toEqual([]);
    expect(result.isLandmine).toBe(true);
  });

  it("calculates one side correctly vs barbell (same target weight needs more plates)", () => {
    // Barbell 135 = 45 bar + 45 per side. Landmine 135 = 45 bar + 90 on one side.
    const barbell = calculateBarbell(135, 45);
    const landmine = calculateLandmine(135, 45);
    const barbellTotal = barbell.perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
    const landmineTotal = landmine.perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
    expect(landmineTotal).toBe(barbellTotal * 2);
  });
});

describe("nearestPowerBlock", () => {
  it("returns exact weight when already a valid increment", () => {
    expect(nearestPowerBlock(25)).toBe(25);
    expect(nearestPowerBlock(5)).toBe(5);
    expect(nearestPowerBlock(50)).toBe(50);
    expect(nearestPowerBlock(27.5)).toBe(27.5);
  });

  it("rounds to nearest 2.5 increment", () => {
    expect(nearestPowerBlock(26)).toBe(25);
    expect(nearestPowerBlock(28)).toBe(27.5);
    expect(nearestPowerBlock(24)).toBe(25);
  });

  it("clamps to minimum of 5", () => {
    expect(nearestPowerBlock(3)).toBe(5);
    expect(nearestPowerBlock(0)).toBe(5);
    expect(nearestPowerBlock(1)).toBe(5);
  });

  it("clamps to maximum of 50", () => {
    expect(nearestPowerBlock(60)).toBe(50);
    expect(nearestPowerBlock(100)).toBe(50);
    expect(nearestPowerBlock(55)).toBe(50);
  });

  it("handles boundary values", () => {
    expect(nearestPowerBlock(5)).toBe(5);
    expect(nearestPowerBlock(50)).toBe(50);
  });

  it("handles negative values by clamping to minimum", () => {
    expect(nearestPowerBlock(-5)).toBe(5);
  });

  describe("roundDown", () => {
    it("floors to the nearest 2.5 increment instead of rounding", () => {
      expect(nearestPowerBlock(28, undefined, true)).toBe(27.5);
      expect(nearestPowerBlock(26, undefined, true)).toBe(25);
      expect(nearestPowerBlock(29.9, undefined, true)).toBe(27.5);
    });

    it("still clamps to the configured min/max", () => {
      expect(nearestPowerBlock(3, undefined, true)).toBe(5);
      expect(nearestPowerBlock(60, undefined, true)).toBe(50);
    });

    it("leaves an exact increment unchanged", () => {
      expect(nearestPowerBlock(25, undefined, true)).toBe(25);
    });
  });
});

describe("getPowerBlockInstructions", () => {
  it("returns valid instructions for every weight from 5 to 50 in 2.5 lb steps", () => {
    for (let w = 5; w <= 50; w += 2.5) {
      const inst = getPowerBlockInstructions(w);
      expect(inst.selector).toBeGreaterThan(0);
      expect(["none", "one", "both"]).toContain(inst.rods);
      expect(inst.label).toMatch(/Selector to \d+/);
    }
  });

  it("returns correct entry for 25 lbs (selector=25, no rods)", () => {
    const inst = getPowerBlockInstructions(25);
    expect(inst.selector).toBe(25);
    expect(inst.rods).toBe("none");
    expect(inst.label).toBe("Selector to 25 · no rods");
  });

  it("returns correct entry for 27.5 lbs (selector=25, add 1 rod)", () => {
    const inst = getPowerBlockInstructions(27.5);
    expect(inst.selector).toBe(25);
    expect(inst.rods).toBe("one");
    expect(inst.label).toBe("Selector to 25 · add 1 rod");
  });

  it("returns correct entry for 30 lbs (selector=25, add both rods)", () => {
    const inst = getPowerBlockInstructions(30);
    expect(inst.selector).toBe(25);
    expect(inst.rods).toBe("both");
    expect(inst.label).toBe("Selector to 25 · add both rods");
  });

  it("returns correct entry for 5 lbs (selector=5, no rods)", () => {
    const inst = getPowerBlockInstructions(5);
    expect(inst.selector).toBe(5);
    expect(inst.rods).toBe("none");
    expect(inst.label).toBe("Selector to 5 · no rods");
  });

  it("returns correct entry for 50 lbs (selector=50, no rods)", () => {
    const inst = getPowerBlockInstructions(50);
    expect(inst.selector).toBe(50);
    expect(inst.rods).toBe("none");
    expect(inst.label).toBe("Selector to 50 · no rods");
  });

  it("returns correct entry for 20 lbs (selector=15, no rods)", () => {
    // 20 lbs uses selector 15, not 20
    const inst = getPowerBlockInstructions(20);
    expect(inst.selector).toBe(15);
    expect(inst.rods).toBe("none");
  });

  it("returns fallback label for out-of-range weight", () => {
    const inst = getPowerBlockInstructions(0);
    expect(inst.label).toBe("—");
  });
});

describe("barbell minimum increment", () => {
  it("0.5 lb minimum increment is achievable (46 lbs on 45lb bar)", () => {
    const result = calculateBarbell(46, 45);
    expect(result.achievedWeight).toBe(46);
    expect(result.perSide).toContainEqual({ plate: 0.5, count: 1 });
  });

  it("45lb bar achieves correct achievedWeight and perSide for 135 lbs", () => {
    const result = calculateBarbell(135, 45);
    expect(result.barWeight).toBe(45);
    expect(result.achievedWeight).toBe(135);
    expect(result.perSide).toEqual([{ plate: 45, count: 1 }]);
  });

  it("35lb bar achieves correct achievedWeight and perSide for 105 lbs", () => {
    const result = calculateBarbell(105, 35);
    expect(result.barWeight).toBe(35);
    expect(result.achievedWeight).toBe(105);
    expect(result.perSide).toContainEqual({ plate: 35, count: 1 });
  });

  it("EZ curl bar (15 lbs) achieves correct achievedWeight and perSide for 55 lbs", () => {
    const result = calculateBarbell(55, 15);
    expect(result.barWeight).toBe(15);
    expect(result.achievedWeight).toBe(55);
    // perSide = 20 = 2x10
    expect(result.perSide).toEqual([{ plate: 10, count: 2 }]);
  });
});

describe("plateDisplayString", () => {
  it("returns 'Bar only' for empty plates", () => {
    const config: PlateConfiguration = {
      targetWeight: 45, barWeight: 45, achievedWeight: 45, perSide: [],
    };
    expect(plateDisplayString(config)).toBe("Bar only (45 lbs)");
  });

  it("displays single plate type", () => {
    const config: PlateConfiguration = {
      targetWeight: 135, barWeight: 45, achievedWeight: 135,
      perSide: [{ plate: 45, count: 1 }],
    };
    expect(plateDisplayString(config)).toBe("1x45");
  });

  it("displays multiple plate types joined with +", () => {
    const config: PlateConfiguration = {
      targetWeight: 185, barWeight: 45, achievedWeight: 185,
      perSide: [{ plate: 45, count: 1 }, { plate: 25, count: 1 }],
    };
    expect(plateDisplayString(config)).toBe("1x45 + 1x25");
  });

  it("displays fractional plate weights cleanly", () => {
    const config: PlateConfiguration = {
      targetWeight: 50, barWeight: 45, achievedWeight: 50,
      perSide: [{ plate: 2.5, count: 1 }],
    };
    expect(plateDisplayString(config)).toBe("1x2.5");
  });
});

describe("plateFullDisplayString", () => {
  it("returns 'Bar only' for empty plates", () => {
    const config: PlateConfiguration = {
      targetWeight: 45, barWeight: 45, achievedWeight: 45, perSide: [],
    };
    expect(plateFullDisplayString(config)).toBe("Bar only (45 lbs)");
  });

  it("shows bar weight and bracketed plates each side with total weight", () => {
    const config: PlateConfiguration = {
      targetWeight: 185, barWeight: 45, achievedWeight: 185,
      perSide: [{ plate: 45, count: 1 }, { plate: 25, count: 1 }],
    };
    expect(plateFullDisplayString(config)).toBe("45lb bar + [1x45, 1x25] each side (185 lbs)");
  });

  it("shows bar weight and bracketed plates one end for landmine", () => {
    const config: PlateConfiguration = {
      targetWeight: 85, barWeight: 45, achievedWeight: 85,
      perSide: [{ plate: 35, count: 1 }, { plate: 5, count: 1 }],
      isLandmine: true,
    };
    expect(plateFullDisplayString(config)).toBe("45lb bar + [1x35, 1x5] one end (85 lbs)");
  });
});

describe("getEquipmentDisplay", () => {
  it("returns barbell display for barbell_45", () => {
    const ex = makeExercise({ equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 135);
    expect(result.type).toBe("barbell");
  });

  it("returns bar only for barbell_45 when weight <= 45", () => {
    const ex = makeExercise({ equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 45);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.perSide).toEqual([]);
      expect(result.config.achievedWeight).toBe(45);
    }
  });

  it("returns barbell display for barbell_35", () => {
    const ex = makeExercise({ equipmentType: "barbell_35" });
    const result = getEquipmentDisplay(ex, 35);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.achievedWeight).toBe(35);
    }
  });

  it("returns barbell display for barbell_ez (15lb bar)", () => {
    const ex = makeExercise({ equipmentType: "barbell_ez" });
    const result = getEquipmentDisplay(ex, 15);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.barWeight).toBe(15);
    }
  });

  it("returns powerblock for standard powerblock exercise", () => {
    const ex = makeExercise({ equipmentType: "powerblock" });
    const result = getEquipmentDisplay(ex, 25);
    expect(result.type).toBe("powerblock");
    if (result.type === "powerblock") {
      expect(result.weight).toBe(25);
      expect(result.instructions.selector).toBe(25);
      expect(result.instructions.rods).toBe("none");
      expect(result.instructions.label).toBe("Selector to 25 · no rods");
    }
  });

  it("returns dumbbell for powerblock with '2lb' detail", () => {
    const ex = makeExercise({ equipmentType: "powerblock", equipmentDetail: "2lb" });
    const result = getEquipmentDisplay(ex, 2);
    expect(result.type).toBe("dumbbell");
    if (result.type === "dumbbell") {
      expect(result.weight).toBe(2);
    }
  });

  it("returns dumbbell for powerblock when weight < 5", () => {
    const ex = makeExercise({ equipmentType: "powerblock" });
    const result = getEquipmentDisplay(ex, 3);
    expect(result.type).toBe("dumbbell");
  });

  it("returns powerblock with zero weight", () => {
    const ex = makeExercise({ equipmentType: "powerblock" });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("powerblock");
    if (result.type === "powerblock") {
      expect(result.weight).toBe(0);
    }
  });

  it("returns band with correct info for all known bands", () => {
    const bands = [
      { name: "Orange", range: "2-12 lbs" },
      { name: "Purple", range: "5-35 lbs" },
      { name: "Red", range: "10-50 lbs" },
      { name: "Blue", range: "20-80 lbs" },
      { name: "Green", range: "50-120 lbs" },
      { name: "Black", range: "60-150 lbs" },
    ];
    for (const band of bands) {
      const ex = makeExercise({ equipmentType: "band", equipmentDetail: band.name });
      const result = getEquipmentDisplay(ex, 0);
      expect(result.type).toBe("band");
      if (result.type === "band") {
        expect(result.name).toBe(band.name);
        expect(result.range).toBe(band.range);
      }
    }
  });

  it("returns band with unknown name when detail not in lookup", () => {
    const ex = makeExercise({ equipmentType: "band", equipmentDetail: "Teal" });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("band");
    if (result.type === "band") {
      expect(result.name).toBe("Teal");
      expect(result.range).toBe("");
    }
  });

  it("returns band with 'Unknown' when no detail", () => {
    const ex = makeExercise({ equipmentType: "band", equipmentDetail: null });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("band");
    if (result.type === "band") {
      expect(result.name).toBe("Unknown");
    }
  });

  it("returns bodyweight with detail", () => {
    const ex = makeExercise({ equipmentType: "bodyweight", equipmentDetail: "Pull-up bar" });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("bodyweight");
    if (result.type === "bodyweight") {
      expect(result.detail).toBe("Pull-up bar");
    }
  });

  it("returns bodyweight with null detail", () => {
    const ex = makeExercise({ equipmentType: "bodyweight", equipmentDetail: null });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("bodyweight");
    if (result.type === "bodyweight") {
      expect(result.detail).toBeNull();
    }
  });

  it("returns assisted with band count as weight", () => {
    const ex = makeExercise({ equipmentType: "assisted_pullup", equipmentDetail: "Purple Band" });
    const result = getEquipmentDisplay(ex, 2);
    expect(result.type).toBe("assisted");
    if (result.type === "assisted") {
      expect(result.weight).toBe(2);
      expect(result.detail).toBe("Purple Band");
    }
  });

  it("assisted pull-up with 2 bands returns display string '2 bands (~160 lbs assistance)'", () => {
    const ex = makeExercise({ equipmentType: "assisted_pullup", equipmentDetail: null });
    const result = getEquipmentDisplay(ex, 2);
    expect(result.type).toBe("assisted");
    expect(equipmentDisplayText(result)).toBe("2 bands (~160 lbs assistance)");
  });

  it("assisted pull-up with 1 band returns singular 'band'", () => {
    const ex = makeExercise({ equipmentType: "assisted_pullup", equipmentDetail: null });
    const result = getEquipmentDisplay(ex, 1);
    expect(equipmentDisplayText(result)).toBe("1 band (~80 lbs assistance)");
  });

  it("returns kettlebell with weight", () => {
    const ex = makeExercise({ equipmentType: "kettlebell" });
    const result = getEquipmentDisplay(ex, 35);
    expect(result.type).toBe("kettlebell");
    if (result.type === "kettlebell") {
      expect(result.weight).toBe(35);
    }
  });

  it("uses landmine calculation for exercises with 'landmine' in name", () => {
    const ex = makeExercise({ name: "Landmine Press", equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 85);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.isLandmine).toBe(true);
      expect(result.config.achievedWeight).toBe(85);
      const oneSideTotal = result.config.perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
      expect(oneSideTotal).toBe(40);
    }
  });

  it("uses standard barbell calculation for non-landmine exercises", () => {
    const ex = makeExercise({ name: "Bench Press", equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 85);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.isLandmine).toBeUndefined();
      const perSideTotal = result.config.perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
      expect(perSideTotal).toBe(20); // (85 - 45) / 2 = 20
    }
  });

  it("is case-insensitive for landmine name detection", () => {
    const ex = makeExercise({ name: "Single-Arm LANDMINE Row", equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 85);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.isLandmine).toBe(true);
    }
  });

  it("uses landmine calculation for Meadows Row (one-sided loading, no 'landmine' in name)", () => {
    const ex = makeExercise({ name: "Meadows Row", equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 85);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.isLandmine).toBe(true);
      expect(result.config.achievedWeight).toBe(85);
      const oneSideTotal = result.config.perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
      expect(oneSideTotal).toBe(40);
    }
  });

  it("returns pulley display with a single-sided plate breakdown and no bar weight", () => {
    const ex = makeExercise({ equipmentType: "pulley" });
    const result = getEquipmentDisplay(ex, 45);
    expect(result.type).toBe("pulley");
    if (result.type === "pulley") {
      expect(result.config.barWeight).toBe(0);
      expect(result.config.achievedWeight).toBe(45);
      // All 45 lbs on one stack, not split — a symmetric barbell would split this as 22.5/side
      expect(result.config.perSide).toEqual([{ plate: 45, count: 1 }]);
    }
  });

  it("returns pulley display with an achievable multi-plate combo", () => {
    const ex = makeExercise({ equipmentType: "pulley" });
    const result = getEquipmentDisplay(ex, 35);
    expect(result.type).toBe("pulley");
    if (result.type === "pulley") {
      expect(result.config.achievedWeight).toBe(35);
      const total = result.config.perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
      expect(total).toBe(35);
    }
  });

  it("returns pulley display with no plates for zero weight", () => {
    const ex = makeExercise({ equipmentType: "pulley" });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("pulley");
    if (result.type === "pulley") {
      expect(result.config.perSide).toEqual([]);
      expect(result.config.achievedWeight).toBe(0);
    }
  });
});

describe("equipmentDisplayText", () => {
  it("displays barbell with bracketed plate info and bar weight", () => {
    const text = equipmentDisplayText({
      type: "barbell",
      config: {
        targetWeight: 185, barWeight: 45, achievedWeight: 185,
        perSide: [{ plate: 45, count: 1 }, { plate: 25, count: 1 }],
      },
    });
    expect(text).toBe("45lb bar + [1x45, 1x25] each side (185 lbs)");
  });

  it("displays bar only for barbell", () => {
    const text = equipmentDisplayText({
      type: "barbell",
      config: { targetWeight: 45, barWeight: 45, achievedWeight: 45, perSide: [] },
    });
    expect(text).toBe("Bar only (45 lbs)");
  });

  it("displays powerblock weight", () => {
    expect(equipmentDisplayText({
      type: "powerblock",
      weight: 25,
      instructions: { selector: 25, rods: "none", label: "Selector to 25 · no rods" },
    })).toBe("PowerBlock: 25 lbs");
  });

  it("displays dumbbell weight", () => {
    expect(equipmentDisplayText({ type: "dumbbell", weight: 2 })).toBe("Dumbbell: 2 lbs");
  });

  it("displays band with range", () => {
    expect(equipmentDisplayText({ type: "band", name: "Orange", range: "2-12 lbs" }))
      .toBe("Orange Band (2-12 lbs)");
  });

  it("displays bodyweight with detail", () => {
    expect(equipmentDisplayText({ type: "bodyweight", detail: "Pull-up bar" })).toBe("Pull-up bar");
  });

  it("displays 'Bodyweight' when no detail", () => {
    expect(equipmentDisplayText({ type: "bodyweight", detail: null })).toBe("Bodyweight");
  });

  it("displays assisted as band count with assistance calculation (2 bands)", () => {
    const text = equipmentDisplayText({ type: "assisted", weight: 2, detail: "Purple Band" });
    expect(text).toBe("2 bands (~160 lbs assistance)");
  });

  it("displays assisted as singular band for 1 band", () => {
    const text = equipmentDisplayText({ type: "assisted", weight: 1, detail: null });
    expect(text).toBe("1 band (~80 lbs assistance)");
  });

  it("displays 'Assisted' when zero weight and no detail", () => {
    expect(equipmentDisplayText({ type: "assisted", weight: 0, detail: null })).toBe("Assisted");
  });

  it("displays detail when zero weight and detail present", () => {
    expect(equipmentDisplayText({ type: "assisted", weight: 0, detail: "Band" })).toBe("Band");
  });

  it("displays kettlebell weight", () => {
    expect(equipmentDisplayText({ type: "kettlebell", weight: 35 })).toBe("Kettlebell: 35 lbs");
  });

  it("displays pulley plate breakdown without any bar wording", () => {
    const text = equipmentDisplayText({
      type: "pulley",
      config: { targetWeight: 45, barWeight: 0, achievedWeight: 45, perSide: [{ plate: 45, count: 1 }], isLandmine: true },
    });
    expect(text).toBe("1x45 (45 lbs)");
    expect(text).not.toMatch(/bar/i);
  });

  it("displays 'No plates' for zero-weight pulley", () => {
    const text = equipmentDisplayText({
      type: "pulley",
      config: { targetWeight: 0, barWeight: 0, achievedWeight: 0, perSide: [], isLandmine: true },
    });
    expect(text).toBe("No plates");
  });
});

describe("equipmentShortText", () => {
  it("shows weight for barbell", () => {
    const text = equipmentShortText({
      type: "barbell",
      config: { targetWeight: 185, barWeight: 45, achievedWeight: 185, perSide: [{ plate: 45, count: 1 }, { plate: 25, count: 1 }] },
    });
    expect(text).toBe("185 lbs");
  });

  it("shows weight for powerblock", () => {
    expect(equipmentShortText({
      type: "powerblock",
      weight: 25,
      instructions: { selector: 25, rods: "none", label: "Selector to 25 · no rods" },
    })).toBe("25 lbs");
  });

  it("shows weight for dumbbell", () => {
    expect(equipmentShortText({ type: "dumbbell", weight: 10 })).toBe("10 lbs");
  });

  it("shows weight for kettlebell", () => {
    expect(equipmentShortText({ type: "kettlebell", weight: 35 })).toBe("35 lbs");
  });

  it("shows band name", () => {
    expect(equipmentShortText({ type: "band", name: "Orange", range: "2-12 lbs" })).toBe("Orange Band");
  });

  it("shows BW for bodyweight", () => {
    expect(equipmentShortText({ type: "bodyweight", detail: null })).toBe("BW");
  });

  it("shows band count for assisted", () => {
    expect(equipmentShortText({ type: "assisted", weight: 2, detail: null })).toBe("2 bands");
  });

  it("shows singular band for 1 band assisted", () => {
    expect(equipmentShortText({ type: "assisted", weight: 1, detail: null })).toBe("1 band");
  });

  it("shows 'Assisted' for zero weight assisted", () => {
    expect(equipmentShortText({ type: "assisted", weight: 0, detail: null })).toBe("Assisted");
  });

  it("shows weight for pulley", () => {
    const text = equipmentShortText({
      type: "pulley",
      config: { targetWeight: 45, barWeight: 0, achievedWeight: 45, perSide: [{ plate: 45, count: 1 }] },
    });
    expect(text).toBe("45 lbs");
  });
});

describe("barbell plate validation (ExerciseEditor spec)", () => {
  it("weight below bar weight: achievedWeight equals bar weight (45lb bar, input 30)", () => {
    const result = calculateBarbell(30, 45);
    expect(result.achievedWeight).toBe(45);
    expect(result.perSide).toEqual([]);
  });

  it("weight below bar weight: achievedWeight equals bar weight (35lb bar, input 20)", () => {
    const result = calculateBarbell(20, 35);
    expect(result.achievedWeight).toBe(35);
    expect(result.perSide).toEqual([]);
  });

  it("weight below bar weight: achievedWeight equals bar weight (EZ bar 15lb, input 10)", () => {
    const result = calculateBarbell(10, 15);
    expect(result.achievedWeight).toBe(15);
    expect(result.perSide).toEqual([]);
  });

  it("EZ bar (15 lb) + 10 lb/side = 35 lbs total, valid exact match", () => {
    const result = calculateBarbell(35, 15);
    expect(result.achievedWeight).toBe(35);
    expect(result.barWeight).toBe(15);
    expect(result.perSide).toEqual([{ plate: 10, count: 1 }]);
  });

  it("all three bar types subtract their own weight before plate calculation", () => {
    // 45lb bar: 135 = 45 + 45/side
    expect(calculateBarbell(135, 45).achievedWeight).toBe(135);
    expect(calculateBarbell(135, 45).barWeight).toBe(45);
    // 35lb bar: 105 = 35 + 35/side
    expect(calculateBarbell(105, 35).achievedWeight).toBe(105);
    expect(calculateBarbell(105, 35).barWeight).toBe(35);
    // EZ bar: 55 = 15 + 20/side (2x10)
    expect(calculateBarbell(55, 15).achievedWeight).toBe(55);
    expect(calculateBarbell(55, 15).barWeight).toBe(15);
  });
});

describe("PowerBlock spec tests", () => {
  it("all 19 weights from 5 to 50 (step 2.5) return correct instructions", () => {
    for (let w = 5; w <= 50; w += 2.5) {
      const inst = getPowerBlockInstructions(w);
      expect(inst.selector).toBeGreaterThan(0);
      expect(["none", "one", "both"]).toContain(inst.rods);
      expect(inst.label).toMatch(/Selector to \d+/);
    }
  });

  it("input outside 5–50 is clamped by nearestPowerBlock", () => {
    expect(nearestPowerBlock(0)).toBe(5);
    expect(nearestPowerBlock(3)).toBe(5);
    expect(nearestPowerBlock(55)).toBe(50);
    expect(nearestPowerBlock(100)).toBe(50);
  });
});

describe("Pull-up assist bands × 80 formula", () => {
  const cases: [number, string][] = [
    [1, "1 band (~80 lbs assistance)"],
    [2, "2 bands (~160 lbs assistance)"],
    [3, "3 bands (~240 lbs assistance)"],
    [4, "4 bands (~320 lbs assistance)"],
    [5, "5 bands (~400 lbs assistance)"],
  ];

  it.each(cases)("%i bands produces correct display string", (bands, expected) => {
    const ex = makeExercise({ equipmentType: "assisted_pullup", equipmentDetail: null });
    const result = getEquipmentDisplay(ex, bands);
    expect(equipmentDisplayText(result)).toBe(expected);
  });
});

describe("FIXED_DUMBBELLS and KETTLEBELL_WEIGHTS inventories", () => {
  it("FIXED_DUMBBELLS is a non-empty array of numbers", () => {
    expect(Array.isArray(FIXED_DUMBBELLS)).toBe(true);
    expect(FIXED_DUMBBELLS.length).toBeGreaterThan(0);
    FIXED_DUMBBELLS.forEach((w) => expect(typeof w).toBe("number"));
  });

  it("KETTLEBELL_WEIGHTS is a non-empty array of numbers", () => {
    expect(Array.isArray(KETTLEBELL_WEIGHTS)).toBe(true);
    expect(KETTLEBELL_WEIGHTS.length).toBeGreaterThan(0);
    KETTLEBELL_WEIGHTS.forEach((w) => expect(typeof w).toBe("number"));
  });

  it("getEquipmentDisplay returns dumbbell type for dumbbell equipment", () => {
    const ex = makeExercise({ equipmentType: "dumbbell" });
    const result = getEquipmentDisplay(ex, 2);
    expect(result.type).toBe("dumbbell");
    if (result.type === "dumbbell") expect(result.weight).toBe(2);
  });
});

// ── equipment-weight-display user story ───────────────────────────────────────

describe("equipment-weight-display user story", () => {
  it("Landmine Press at 55 lbs: achievedWeight=55, 10 lb plate on one side", () => {
    const ex = makeExercise({ name: "Landmine Press", equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 55);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.isLandmine).toBe(true);
      expect(result.config.achievedWeight).toBe(55);
      const oneSide = result.config.perSide.reduce((s, p) => s + p.plate * p.count, 0);
      expect(oneSide).toBe(10);
    }
  });

  it("Landmine Press at 90 lbs: achievedWeight=90, 45 lb plate on one side", () => {
    const ex = makeExercise({ name: "Landmine Press", equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 90);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.isLandmine).toBe(true);
      expect(result.config.achievedWeight).toBe(90);
      const oneSide = result.config.perSide.reduce((s, p) => s + p.plate * p.count, 0);
      expect(oneSide).toBe(45);
    }
  });

  it("Bench Press at 135 lbs: achievedWeight=135, 45 lbs each side", () => {
    const ex = makeExercise({ name: "Bench Press", equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 135);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.isLandmine).toBeUndefined();
      expect(result.config.achievedWeight).toBe(135);
      const perSide = result.config.perSide.reduce((s, p) => s + p.plate * p.count, 0);
      expect(perSide).toBe(45);
    }
  });

  it("Bench Press at 155 lbs: achievedWeight=155, 55 lbs each side", () => {
    const ex = makeExercise({ name: "Bench Press", equipmentType: "barbell_45" });
    const result = getEquipmentDisplay(ex, 155);
    expect(result.type).toBe("barbell");
    if (result.type === "barbell") {
      expect(result.config.achievedWeight).toBe(155);
      const perSide = result.config.perSide.reduce((s, p) => s + p.plate * p.count, 0);
      expect(perSide).toBe(55);
    }
  });

  it("achievedWeight always equals configured weight for exactly loadable barbell weights", () => {
    // All weights achievable by the plate calculator must round-trip exactly.
    const achievable = [45, 55, 65, 75, 85, 95, 105, 115, 135, 145, 155, 185, 225];
    const ex = makeExercise({ name: "Bench Press", equipmentType: "barbell_45" });
    for (const w of achievable) {
      const result = getEquipmentDisplay(ex, w);
      if (result.type === "barbell") {
        expect(result.config.achievedWeight).toBe(w);
      }
    }
  });

  it("PowerBlock at 25 lbs: shows selector and rod configuration, not plates", () => {
    const ex = makeExercise({ equipmentType: "powerblock" });
    const result = getEquipmentDisplay(ex, 25);
    expect(result.type).toBe("powerblock");
    if (result.type === "powerblock") {
      expect(result.weight).toBe(25);
      expect(result.instructions.selector).toBeGreaterThan(0);
    }
  });

  it("powerblock with equipment_detail '2lb' is treated as a regular dumbbell", () => {
    const ex = makeExercise({ equipmentType: "powerblock", equipmentDetail: "2lb" });
    const result = getEquipmentDisplay(ex, 2);
    expect(result.type).toBe("dumbbell");
  });
});

// ── resistance-reduction-progression user story ───────────────────────────────

describe("resistance-reduction-progression user story", () => {
  it("assisted_pullup with detail '3_bands' and weight=0 displays '3 bands' (underscores replaced)", () => {
    const ex = makeExercise({ equipmentType: "assisted_pullup", equipmentDetail: "3_bands" });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("assisted");
    expect(equipmentDisplayText(result)).toBe("3 bands");
  });

  it("assisted_pullup with detail '3 bands' (no underscore) and weight=0 displays '3 bands'", () => {
    const ex = makeExercise({ equipmentType: "assisted_pullup", equipmentDetail: "3 bands" });
    const result = getEquipmentDisplay(ex, 0);
    expect(equipmentDisplayText(result)).toBe("3 bands");
  });

  it("assisted_pullup with weight=3 (band count) displays '3 bands (~240 lbs assistance)'", () => {
    const ex = makeExercise({ equipmentType: "assisted_pullup", equipmentDetail: "3_bands" });
    const result = getEquipmentDisplay(ex, 3);
    expect(equipmentDisplayText(result)).toBe("3 bands (~240 lbs assistance)");
  });

  it("band equipment with Green detail displays name and resistance range", () => {
    const ex = makeExercise({ equipmentType: "band", equipmentDetail: "Green" });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("band");
    expect(equipmentDisplayText(result)).toBe("Green Band (50-120 lbs)");
  });

  it("band equipment with Blue detail displays name and resistance range", () => {
    const ex = makeExercise({ equipmentType: "band", equipmentDetail: "Blue" });
    const result = getEquipmentDisplay(ex, 0);
    expect(result.type).toBe("band");
    expect(equipmentDisplayText(result)).toBe("Blue Band (20-80 lbs)");
  });

  it("assisted_pullup is never treated as a weighted exercise (type is 'assisted', not 'barbell')", () => {
    const ex = makeExercise({ equipmentType: "assisted_pullup", equipmentDetail: "3_bands" });
    const result = getEquipmentDisplay(ex, 3);
    expect(result.type).toBe("assisted");
    expect(result.type).not.toBe("barbell");
    expect(result.type).not.toBe("powerblock");
  });
});
