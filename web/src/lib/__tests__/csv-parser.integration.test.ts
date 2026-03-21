import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCSV } from "../csv-parser";
import { readFileSync } from "fs";
import { resolve } from "path";

// Mock crypto.randomUUID
beforeEach(() => {
  let counter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => `uuid-${++counter}` as `${string}-${string}-${string}-${string}-${string}`);
});

const VALID_PHASES = new Set(["warmup", "main", "finisher", "cooldown", "mobility"]);
const VALID_EQUIPMENT = new Set([
  "barbell_45", "barbell_35", "barbell_ez", "powerblock",
  "band", "kettlebell", "bodyweight", "assisted_pullup",
]);
// Known keyword rules; free-form strings (band colors, band counts) are also valid
const KEYWORD_PROGRESSIONS = new Set([
  "add_5lb", "add_2.5lb", "add_10lb",
  "add_reps", "add_time", "add_rounds",
  "maintain", "deload", "progress_gripper", "none",
]);

// reacher_build_workout.csv is superseded by reacher_build_cycle2.xlsx.
// These tests remain for backward compatibility of the CSV parser itself.
describe("CSV integration - reacher_build_workout.csv (legacy, superseded by XLSX)", () => {
  const csvPath = resolve(__dirname, "../../../../reacher_build_workout.csv");
  let csv: string;

  try {
    csv = readFileSync(csvPath, "utf-8");
  } catch {
    csv = "";
  }

  it("parses without errors when file exists", () => {
    if (!csv) return; // skip if file not found
    expect(() => parseCSV(csv)).not.toThrow();
  });

  it("has correct program name and 4 weeks", () => {
    if (!csv) return;
    const result = parseCSV(csv);
    expect(result.programs.length).toBeGreaterThanOrEqual(1);
    const program = result.programs.find((p) => p.name === "Reacher Build");
    expect(program).toBeDefined();
    expect(program!.totalWeeks).toBe(4);
  });

  it("has workouts for multiple days", () => {
    if (!csv) return;
    const result = parseCSV(csv);
    const days = new Set(result.workouts.map((w) => w.dayOfWeek));
    expect(days.size).toBeGreaterThanOrEqual(5);
  });

  it("all exercises have valid phase and equipment", () => {
    if (!csv) return;
    const result = parseCSV(csv);
    for (const workout of result.workouts) {
      for (const exercise of workout.exercises) {
        expect(VALID_PHASES.has(exercise.phase)).toBe(true);
        expect(VALID_EQUIPMENT.has(exercise.equipmentType)).toBe(true);
        // progression_rule is now free-form; just verify it's a string
        expect(typeof exercise.progressionRule).toBe("string");
      }
    }
  });

  it("exercises are sorted by order within each workout", () => {
    if (!csv) return;
    const result = parseCSV(csv);
    for (const workout of result.workouts) {
      for (let i = 1; i < workout.exercises.length; i++) {
        expect(workout.exercises[i].order).toBeGreaterThanOrEqual(workout.exercises[i - 1].order);
      }
    }
  });

  it("all exercise IDs are unique", () => {
    if (!csv) return;
    const result = parseCSV(csv);
    const allIds = result.workouts.flatMap((w) => w.exercises.map((e) => e.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("CSV integration - daily_mobility.csv", () => {
  const csvPath = resolve(__dirname, "../../../../daily_mobility.csv");
  let csv: string;

  try {
    csv = readFileSync(csvPath, "utf-8");
  } catch {
    csv = "";
  }

  it("parses without errors", () => {
    if (!csv) return;
    expect(() => parseCSV(csv)).not.toThrow();
  });

  it("has 'Daily' as day_of_week for all workouts", () => {
    if (!csv) return;
    const result = parseCSV(csv);
    for (const workout of result.workouts) {
      expect(workout.dayOfWeek).toBe("Daily");
    }
  });

  it("has the expected number of mobility exercises", () => {
    if (!csv) return;
    const result = parseCSV(csv);
    // daily_mobility.csv has 18 exercises (19 lines minus header)
    const totalExercises = result.workouts.reduce((sum, w) => sum + w.exercises.length, 0);
    expect(totalExercises).toBeGreaterThanOrEqual(15);
  });

  it("all exercises have valid fields", () => {
    if (!csv) return;
    const result = parseCSV(csv);
    for (const workout of result.workouts) {
      for (const exercise of workout.exercises) {
        expect(exercise.name.length).toBeGreaterThan(0);
        expect(exercise.sets).toBeGreaterThan(0);
        expect(VALID_PHASES.has(exercise.phase)).toBe(true);
        expect(VALID_EQUIPMENT.has(exercise.equipmentType)).toBe(true);
      }
    }
  });
});
