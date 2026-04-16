import { describe, it, expect } from "vitest";
import {
  barWeight,
  repTargetDisplay,
  isTimeBased,
  cleanWeight,
  formatRestTime,
  formatDuration,
} from "../types";
import type { EquipmentType, RepTarget, Exercise } from "../types";

describe("barWeight", () => {
  it("returns 45 for barbell_45", () => {
    expect(barWeight("barbell_45")).toBe(45);
  });

  it("returns 35 for barbell_35", () => {
    expect(barWeight("barbell_35")).toBe(35);
  });

  it("returns 15 for barbell_ez", () => {
    expect(barWeight("barbell_ez")).toBe(15);
  });

  it.each([
    "powerblock",
    "band",
    "kettlebell",
    "bodyweight",
    "assisted_pullup",
  ] as EquipmentType[])("returns null for %s", (type) => {
    expect(barWeight(type)).toBeNull();
  });
});

describe("repTargetDisplay", () => {
  it("returns 'AMRAP' for failure rep target", () => {
    expect(repTargetDisplay(8, { type: "failure" })).toBe("AMRAP");
  });

  it("returns single rep count when min equals max", () => {
    expect(repTargetDisplay(10, { type: "count", value: 10 })).toBe("10 reps");
  });

  it("returns range when min differs from max", () => {
    expect(repTargetDisplay(8, { type: "count", value: 12 })).toBe("8-12 reps");
  });

  it("handles low rep range", () => {
    expect(repTargetDisplay(1, { type: "count", value: 3 })).toBe("1-3 reps");
  });

  it("returns 'AMRAP' regardless of repMin value", () => {
    expect(repTargetDisplay(1, { type: "failure" })).toBe("AMRAP");
    expect(repTargetDisplay(20, { type: "failure" })).toBe("AMRAP");
  });

  it("shows time for mobility exercises with high reps", () => {
    const mobilityExercise: Exercise = {
      id: "test", order: 1, name: "Sleeper Stretch", phase: "mobility",
      equipmentType: "bodyweight", equipmentDetail: null,
      baseWeight: { type: "fixed", value: 0 }, sets: 1, repMin: 120,
      repMax: { type: "count", value: 120 }, restSeconds: 0,
      progressionRule: "none", isUnilateral: false, isTimeBased: true, notes: null,
    };
    expect(repTargetDisplay(120, { type: "count", value: 120 }, mobilityExercise)).toBe("2 min");
  });

  it("shows time range for mobility exercises with different min/max", () => {
    const exercise: Exercise = {
      id: "test", order: 1, name: "Pec Release", phase: "mobility",
      equipmentType: "bodyweight", equipmentDetail: null,
      baseWeight: { type: "fixed", value: 0 }, sets: 1, repMin: 120,
      repMax: { type: "count", value: 180 }, restSeconds: 0,
      progressionRule: "none", isUnilateral: false, isTimeBased: true, notes: null,
    };
    expect(repTargetDisplay(120, { type: "count", value: 180 }, exercise)).toBe("2 min-3 min");
  });

  it("shows seconds for time-based exercises under 60s", () => {
    const exercise: Exercise = {
      id: "test", order: 1, name: "Short Hold", phase: "mobility",
      equipmentType: "bodyweight", equipmentDetail: null,
      baseWeight: { type: "fixed", value: 0 }, sets: 1, repMin: 30,
      repMax: { type: "count", value: 30 }, restSeconds: 0,
      progressionRule: "add_time", isUnilateral: false, isTimeBased: true, notes: null,
    };
    expect(repTargetDisplay(30, { type: "count", value: 30 }, exercise)).toBe("30s");
  });

  it("shows reps (not time) for non-mobility exercises with normal reps", () => {
    const exercise: Exercise = {
      id: "test", order: 1, name: "Bench Press", phase: "main",
      equipmentType: "barbell_45", equipmentDetail: null,
      baseWeight: { type: "fixed", value: 135 }, sets: 3, repMin: 8,
      repMax: { type: "count", value: 12 }, restSeconds: 120,
      progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, notes: null,
    };
    expect(repTargetDisplay(8, { type: "count", value: 12 }, exercise)).toBe("8-12 reps");
  });

  it("still works without exercise argument (backwards compatible)", () => {
    expect(repTargetDisplay(10, { type: "count", value: 10 })).toBe("10 reps");
  });
});

describe("isTimeBased", () => {
  it("returns true when isTimeBased field is true", () => {
    const exercise: Exercise = {
      id: "test", order: 1, name: "Plank", phase: "main",
      equipmentType: "bodyweight", equipmentDetail: null,
      baseWeight: { type: "fixed", value: 0 }, sets: 3, repMin: 30,
      repMax: { type: "count", value: 30 }, restSeconds: 60,
      progressionRule: "add_time", isUnilateral: false, isTimeBased: true, notes: null,
    };
    expect(isTimeBased(exercise)).toBe(true);
  });

  it("returns false when isTimeBased field is false", () => {
    const exercise: Exercise = {
      id: "test", order: 1, name: "Squat", phase: "main",
      equipmentType: "barbell_45", equipmentDetail: null,
      baseWeight: { type: "fixed", value: 135 }, sets: 3, repMin: 8,
      repMax: { type: "count", value: 12 }, restSeconds: 120,
      progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, notes: null,
    };
    expect(isTimeBased(exercise)).toBe(false);
  });
});

describe("cleanWeight", () => {
  it("returns integer as string without decimals", () => {
    expect(cleanWeight(45)).toBe("45");
  });

  it("preserves meaningful decimals", () => {
    expect(cleanWeight(2.5)).toBe("2.5");
  });

  it("preserves sub-pound decimals", () => {
    expect(cleanWeight(0.75)).toBe("0.75");
  });

  it("strips trailing zeros from whole numbers", () => {
    expect(cleanWeight(45.0)).toBe("45");
  });

  it("returns zero correctly", () => {
    expect(cleanWeight(0)).toBe("0");
  });

  it("handles floating point precision issues", () => {
    const result = cleanWeight(0.1 + 0.2);
    // Should not show 0.30000000000000004
    expect(result).toBe("0.3");
  });

  it("handles large weights", () => {
    expect(cleanWeight(315)).toBe("315");
  });

  it("handles small fractional weights", () => {
    expect(cleanWeight(0.5)).toBe("0.5");
  });
});

describe("formatRestTime", () => {
  it("formats seconds-only values", () => {
    expect(formatRestTime(30)).toBe("30s");
    expect(formatRestTime(45)).toBe("45s");
  });

  it("formats exact minutes", () => {
    expect(formatRestTime(60)).toBe("1m");
    expect(formatRestTime(120)).toBe("2m");
    expect(formatRestTime(180)).toBe("3m");
  });

  it("formats minutes and seconds", () => {
    expect(formatRestTime(90)).toBe("1:30");
    expect(formatRestTime(150)).toBe("2:30");
  });

  it("pads seconds with leading zero", () => {
    expect(formatRestTime(65)).toBe("1:05");
  });

  it("handles boundary at 59 seconds", () => {
    expect(formatRestTime(59)).toBe("59s");
  });
});

describe("formatDuration", () => {
  it("formats minutes under an hour", () => {
    expect(formatDuration(2700)).toBe("45 min");
    expect(formatDuration(300)).toBe("5 min");
  });

  it("formats exactly one hour", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(4500)).toBe("1h 15m");
  });

  it("handles zero seconds", () => {
    expect(formatDuration(0)).toBe("0 min");
  });

  it("handles multi-hour durations", () => {
    expect(formatDuration(7200)).toBe("2h 0m");
    expect(formatDuration(7800)).toBe("2h 10m");
  });

  it("handles seconds that round to less than 1 minute", () => {
    expect(formatDuration(30)).toBe("0 min");
    expect(formatDuration(59)).toBe("0 min");
  });
});
