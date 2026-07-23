import { describe, it, expect } from "vitest";
import {
  calculateBarbell,
  calculateLandmine,
  nearestPowerBlock,
  getEquipmentDisplay,
  DEFAULT_PLATES,
  DEFAULT_EQUIPMENT_CONFIG,
  FIXED_DUMBBELLS,
  KETTLEBELL_WEIGHTS,
} from "../equipment-calculator";
import { ALL_BAND_COLORS, ALL_LOOP_BAND_SIZES, ALL_COC_LEVELS } from "../types";
import type { ResolvedExercise, UserEquipmentConfig } from "../types";

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

// ── DEFAULT_PLATES ──

describe("DEFAULT_PLATES", () => {
  it("is exported", () => {
    expect(DEFAULT_PLATES).toBeDefined();
    expect(DEFAULT_PLATES.length).toBeGreaterThan(0);
  });

  it("uses totalOwned field (not maxPerSide)", () => {
    DEFAULT_PLATES.forEach((p) => {
      expect(p).toHaveProperty("totalOwned");
      expect(p).not.toHaveProperty("maxPerSide");
    });
  });

  it("is ordered largest to smallest", () => {
    for (let i = 1; i < DEFAULT_PLATES.length; i++) {
      expect(DEFAULT_PLATES[i].weight).toBeLessThan(DEFAULT_PLATES[i - 1].weight);
    }
  });
});

// ── DEFAULT_EQUIPMENT_CONFIG ──

describe("DEFAULT_EQUIPMENT_CONFIG", () => {
  it("plates deep-equal DEFAULT_PLATES", () => {
    expect(DEFAULT_EQUIPMENT_CONFIG.plates).toEqual(DEFAULT_PLATES);
  });

  it("fixedDumbbells equals FIXED_DUMBBELLS", () => {
    expect(DEFAULT_EQUIPMENT_CONFIG.fixedDumbbells).toEqual(FIXED_DUMBBELLS);
  });

  it("kettlebells equals KETTLEBELL_WEIGHTS", () => {
    expect(DEFAULT_EQUIPMENT_CONFIG.kettlebells).toEqual(KETTLEBELL_WEIGHTS);
  });

  it("bands contains all 6 Serious Steel colors", () => {
    expect(DEFAULT_EQUIPMENT_CONFIG.bands).toEqual(ALL_BAND_COLORS);
  });

  it("loopBands contains all 6 loop band sizes", () => {
    expect(DEFAULT_EQUIPMENT_CONFIG.loopBands).toEqual(ALL_LOOP_BAND_SIZES);
  });

  it("grippers contains all CoC levels", () => {
    expect(DEFAULT_EQUIPMENT_CONFIG.grippers).toEqual(ALL_COC_LEVELS);
  });

  it("powerBlock defaults to 5-50 lbs owned", () => {
    expect(DEFAULT_EQUIPMENT_CONFIG.powerBlock).toEqual({ owned: true, minLbs: 5, maxLbs: 50 });
  });

  it("all barbells owned by default", () => {
    expect(DEFAULT_EQUIPMENT_CONFIG.barbells).toEqual({ has45lb: true, has35lb: true, hasEZBar: true });
  });
});

// ── calculateBarbell with custom config ──

describe("calculateBarbell with UserEquipmentConfig", () => {
  it("without config behaves identically to defaults for 135 lbs", () => {
    const result = calculateBarbell(135, 45);
    expect(result.achievedWeight).toBe(135);
    expect(result.perSide).toContainEqual({ plate: 45, count: 1 });
  });

  it("respects totalOwned limit (2 × 25lb owned = max 1 per side for barbell)", () => {
    // Config: only 2 × 25lb plates total → floor(2/2) = 1 per side max
    // Target 95 = 45 bar + 25/side → achievable with 1×25 per side ✓
    // Target 120 = 45 bar + 37.5/side → needs >1×25 per side, impossible → rounds down to 95
    const config: UserEquipmentConfig = {
      ...DEFAULT_EQUIPMENT_CONFIG,
      plates: [{ weight: 25, totalOwned: 2 }],
    };
    const result = calculateBarbell(120, 45, config);
    // Can only use 1×25 per side (only 2 plates total) → 45+50 = 95
    expect(result.achievedWeight).toBe(95);
    expect(result.perSide).toEqual([{ plate: 25, count: 1 }]);
  });

  it("uses more plates per side when more owned", () => {
    // 4 × 25lb plates → floor(4/2) = 2 per side available
    const config: UserEquipmentConfig = {
      ...DEFAULT_EQUIPMENT_CONFIG,
      plates: [{ weight: 25, totalOwned: 4 }],
    };
    const result = calculateBarbell(145, 45, config);
    // 45 + 2×25 per side = 145
    expect(result.achievedWeight).toBe(145);
    expect(result.perSide).toEqual([{ plate: 25, count: 2 }]);
  });

  it("with limited mixed plates rounds down for unachievable target", () => {
    // 25×4 total → 2/side, 10×4 total → 2/side; max/side = 70; max total = 45+140 = 185
    const config: UserEquipmentConfig = {
      ...DEFAULT_EQUIPMENT_CONFIG,
      plates: [
        { weight: 25, totalOwned: 4 },
        { weight: 10, totalOwned: 4 },
      ],
    };
    const result = calculateBarbell(200, 45, config);
    expect(result.achievedWeight).toBe(185);
  });
});

// ── calculateLandmine with config — bug fix verification ──

describe("calculateLandmine with UserEquipmentConfig", () => {
  it("landmine uses full totalOwned (not half) for one-sided loading", () => {
    // 2 × 45lb plates owned → totalOwned: 2
    // Barbell (symmetric): max per side = floor(2/2) = 1 plate per side
    // Landmine (one-sided): can use ALL 2 plates on the single loaded end
    const configWith2x45: UserEquipmentConfig = {
      ...DEFAULT_EQUIPMENT_CONFIG,
      plates: [{ weight: 45, totalOwned: 2 }],
    };
    // Landmine target 135 = 45 bar + 90 one-sided = 2×45 plates. Should work.
    const result = calculateLandmine(135, 45, configWith2x45);
    expect(result.achievedWeight).toBe(135);
    expect(result.perSide).toEqual([{ plate: 45, count: 2 }]);
  });

  it("without config uses DEFAULT_PLATES", () => {
    // Default has 45: totalOwned 2 → landmine can use 2 plates on one side
    const result = calculateLandmine(135, 45);
    expect(result.achievedWeight).toBe(135);
    expect(result.perSide).toContainEqual({ plate: 45, count: 2 });
  });
});

// ── nearestPowerBlock with config ──

describe("nearestPowerBlock with UserEquipmentConfig", () => {
  it("without config: clamps to 5-50 range", () => {
    expect(nearestPowerBlock(60)).toBe(50);
    expect(nearestPowerBlock(3)).toBe(5);
  });

  it("with custom maxLbs: 25 → value 30 clamps to 25", () => {
    const config: UserEquipmentConfig = {
      ...DEFAULT_EQUIPMENT_CONFIG,
      powerBlock: { owned: true, minLbs: 5, maxLbs: 25 },
    };
    expect(nearestPowerBlock(30, config)).toBe(25);
  });

  it("with custom minLbs: 10 → value 5 clamps to 10", () => {
    const config: UserEquipmentConfig = {
      ...DEFAULT_EQUIPMENT_CONFIG,
      powerBlock: { owned: true, minLbs: 10, maxLbs: 50 },
    };
    expect(nearestPowerBlock(5, config)).toBe(10);
  });
});

// ── getEquipmentDisplay with config ──

describe("getEquipmentDisplay with UserEquipmentConfig", () => {
  it("powerBlock not owned → dumbbell fallback", () => {
    const config: UserEquipmentConfig = {
      ...DEFAULT_EQUIPMENT_CONFIG,
      powerBlock: { owned: false, minLbs: 5, maxLbs: 50 },
    };
    const exercise = makeExercise({ equipmentType: "powerblock" });
    const result = getEquipmentDisplay(exercise, 30, config);
    expect(result.type).toBe("dumbbell");
  });

  it("powerBlock owned → powerblock type", () => {
    const exercise = makeExercise({ equipmentType: "powerblock" });
    const result = getEquipmentDisplay(exercise, 30, DEFAULT_EQUIPMENT_CONFIG);
    expect(result.type).toBe("powerblock");
  });
});
