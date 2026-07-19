import { describe, it, expect } from "vitest";
import { formatWeekAsText } from "../week-export";
import type { Workout, Exercise } from "../types";

const makeExercise = (overrides: Partial<Exercise>): Exercise => ({
  id: "ex-1",
  order: 1,
  name: "Test Exercise",
  phase: "main",
  equipmentType: "barbell_45",
  equipmentDetail: null,
  baseWeight: { type: "fixed", value: 0 },
  sets: 3,
  repMin: 8,
  repMax: { type: "count", value: 10 },
  restSeconds: 120,
  progressionRule: "add_5lb",
  isUnilateral: false,
  isTimeBased: false,
  notes: null,
  ...overrides,
});

describe("formatWeekAsText", () => {
  it("includes the program name and week number as a header", () => {
    const text = formatWeekAsText("Reacher Build", 1, []);
    expect(text).toContain("Reacher Build");
    expect(text).toContain("Week 1");
  });

  it("lists each workout under its day of week, in DAY_ORDER", () => {
    const monday: Workout = {
      id: "w1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      exercises: [makeExercise({ id: "e1", order: 1, name: "Landmine Press", sets: 3, baseWeight: { type: "fixed", value: 90 } })],
    };
    const friday: Workout = {
      id: "w2", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Friday",
      exercises: [makeExercise({ id: "e2", order: 1, name: "Scapular Hangs" })],
    };

    // Pass Friday before Monday to prove the formatter re-sorts, not just echoes input order.
    const text = formatWeekAsText("Reacher Build", 1, [friday, monday]);

    const mondayIndex = text.indexOf("MONDAY");
    const fridayIndex = text.indexOf("FRIDAY");
    expect(mondayIndex).toBeGreaterThanOrEqual(0);
    expect(fridayIndex).toBeGreaterThan(mondayIndex);
  });

  it("formats each exercise with sets, reps, weight, and rest", () => {
    const workout: Workout = {
      id: "w1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      exercises: [
        makeExercise({
          id: "e1", order: 1, name: "Landmine Press", sets: 3, repMin: 8,
          repMax: { type: "count", value: 10 }, restSeconds: 120,
          baseWeight: { type: "fixed", value: 90 },
        }),
      ],
    };

    const text = formatWeekAsText("Reacher Build", 1, [workout]);

    expect(text).toContain("Landmine Press");
    expect(text).toContain("3 x");
    expect(text).toContain("90 lbs");
    expect(text).toContain("2m");
  });

  it("orders exercises within a day by their order field", () => {
    const workout: Workout = {
      id: "w1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      exercises: [
        makeExercise({ id: "e2", order: 2, name: "Second Exercise" }),
        makeExercise({ id: "e1", order: 1, name: "First Exercise" }),
      ],
    };

    const text = formatWeekAsText("Reacher Build", 1, [workout]);
    expect(text.indexOf("First Exercise")).toBeLessThan(text.indexOf("Second Exercise"));
  });
});
