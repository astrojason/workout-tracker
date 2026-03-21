import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseXLSX } from "../xlsx-parser";
import { readFileSync } from "fs";
import { resolve } from "path";

// Mock crypto.randomUUID
beforeEach(() => {
  let counter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `uuid-${++counter}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

const VALID_PHASES = new Set(["warmup", "main", "finisher", "cooldown", "mobility"]);
const VALID_EQUIPMENT = new Set([
  "barbell_45", "barbell_35", "barbell_ez", "powerblock",
  "band", "kettlebell", "bodyweight", "assisted_pullup",
]);

describe("XLSX integration - reacher_build_cycle2.xlsx", () => {
  const xlsxPath = resolve(__dirname, "../../../../reacher_build_cycle2.xlsx");
  let xlsxData: Buffer | null = null;

  try {
    xlsxData = readFileSync(xlsxPath);
  } catch {
    xlsxData = null;
  }

  it("parses without errors", () => {
    if (!xlsxData) return; // skip if file not found
    expect(() => parseXLSX(xlsxData!)).not.toThrow();
  });

  it("has the Reacher Build program with 4 weeks", () => {
    if (!xlsxData) return;
    const result = parseXLSX(xlsxData, "Reacher Build");
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0].name).toBe("Reacher Build");
    expect(result.programs[0].totalWeeks).toBe(4);
  });

  it("has workouts for all 7 days of the week", () => {
    if (!xlsxData) return;
    const result = parseXLSX(xlsxData, "Reacher Build");
    const days = new Set(result.workouts.map((w) => w.dayOfWeek));
    expect(days.size).toBe(7);
  });

  it("all exercises have valid phase and equipment type", () => {
    if (!xlsxData) return;
    const result = parseXLSX(xlsxData, "Reacher Build");
    for (const workout of result.workouts) {
      for (const exercise of workout.exercises) {
        expect(VALID_PHASES.has(exercise.phase), `Invalid phase '${exercise.phase}' on '${exercise.name}'`).toBe(true);
        expect(VALID_EQUIPMENT.has(exercise.equipmentType), `Invalid equipment '${exercise.equipmentType}' on '${exercise.name}'`).toBe(true);
      }
    }
  });

  it("all exercise IDs are unique", () => {
    if (!xlsxData) return;
    const result = parseXLSX(xlsxData, "Reacher Build");
    const allIds = result.workouts.flatMap((w) => w.exercises.map((e) => e.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("exercises within each workout are sorted warmup→main→finisher then by order", () => {
    if (!xlsxData) return;
    const phaseRank: Record<string, number> = {
      warmup: 0, main: 1, finisher: 2, cooldown: 3, mobility: 4,
    };
    const result = parseXLSX(xlsxData, "Reacher Build");
    for (const workout of result.workouts) {
      for (let i = 1; i < workout.exercises.length; i++) {
        const prev = workout.exercises[i - 1];
        const curr = workout.exercises[i];
        const pDiff = phaseRank[curr.phase] - phaseRank[prev.phase];
        if (pDiff < 0) {
          throw new Error(
            `Phase out of order in ${workout.id}: '${prev.phase}' before '${curr.phase}' (${prev.name} → ${curr.name})`
          );
        }
        if (pDiff === 0) {
          expect(curr.order).toBeGreaterThanOrEqual(prev.order);
        }
      }
    }
  });

  it("warmup exercises have restAfter set to false", () => {
    if (!xlsxData) return;
    const result = parseXLSX(xlsxData, "Reacher Build");
    for (const workout of result.workouts) {
      for (const exercise of workout.exercises) {
        if (exercise.phase === "warmup") {
          expect(exercise.restAfter, `Warmup '${exercise.name}' should have restAfter=false`).toBe(false);
        }
      }
    }
  });

  it("progression_rule is always a non-empty string", () => {
    if (!xlsxData) return;
    const result = parseXLSX(xlsxData, "Reacher Build");
    for (const workout of result.workouts) {
      for (const exercise of workout.exercises) {
        expect(typeof exercise.progressionRule).toBe("string");
        expect(exercise.progressionRule.length).toBeGreaterThan(0);
      }
    }
  });

  it("Monday primary lift has at least one exercise with lastSetAmrap=true", () => {
    if (!xlsxData) return;
    const result = parseXLSX(xlsxData, "Reacher Build");
    const mondayWorkouts = result.workouts.filter((w) => w.dayOfWeek === "Monday");
    const allMonday = mondayWorkouts.flatMap((w) => w.exercises);
    // The primary Landmine Press working set should be flagged AMRAP
    const hasAmrap = allMonday.some(
      (e) => e.name.toLowerCase().includes("landmine press") && e.phase === "main" && e.lastSetAmrap === true
    );
    expect(hasAmrap).toBe(true);
  });
});
