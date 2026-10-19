import { describe, it, expect } from "vitest";
import { formatWeekAsText, formatSessionsWeekAsText, formatSessionAsMarkdown } from "../week-export";
import type { ResolvedWorkout, ResolvedExercise, WorkoutSessionDoc, CompletedSet } from "../types";

const makeExercise = (overrides: Partial<ResolvedExercise>): ResolvedExercise => ({
  id: "ex-1",
  definitionId: "def-1",
  order: 1,
  name: "Test Exercise",
  phase: "main",
  equipmentType: "barbell_45",
  equipmentDetail: null,
  muscleGroups: [],
  currentWeight: 0,
  hardStreak: 0,
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
    const monday: ResolvedWorkout = {
      id: "w1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      exercises: [makeExercise({ id: "e1", order: 1, name: "Landmine Press", sets: 3, currentWeight: 90 })],
    };
    const friday: ResolvedWorkout = {
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
    const workout: ResolvedWorkout = {
      id: "w1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      exercises: [
        makeExercise({
          id: "e1", order: 1, name: "Landmine Press", sets: 3, repMin: 8,
          repMax: { type: "count", value: 10 }, restSeconds: 120,
          currentWeight: 90,
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
    const workout: ResolvedWorkout = {
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

const makeCompletedSet = (overrides: Partial<CompletedSet>): CompletedSet => ({
  id: "set-1",
  exerciseName: "Landmine Press",
  exerciseOrder: 1,
  setNumber: 1,
  targetWeight: 90,
  actualWeight: 90,
  targetReps: 8,
  actualReps: 9,
  completed: true,
  timestamp: new Date(),
  notes: null,
  ...overrides,
});

describe("formatSessionsWeekAsText", () => {
  it("includes the program name and week number as a header", () => {
    const text = formatSessionsWeekAsText("Reacher Build", 1, []);
    expect(text).toContain("Reacher Build");
    expect(text).toContain("Week 1");
  });

  it("lists each session under its day of week, in DAY_ORDER", () => {
    const monday: WorkoutSessionDoc = {
      id: "s1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      date: new Date(), completed: true, durationSeconds: 1800,
      sets: [makeCompletedSet({ id: "cs1" })],
    };
    const friday: WorkoutSessionDoc = {
      id: "s2", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Friday",
      date: new Date(), completed: true, durationSeconds: 900,
      sets: [makeCompletedSet({ id: "cs2", exerciseName: "Scapular Hangs" })],
    };

    // Pass Friday before Monday to prove the formatter re-sorts, not just echoes input order.
    const text = formatSessionsWeekAsText("Reacher Build", 1, [friday, monday]);

    const mondayIndex = text.indexOf("MONDAY");
    const fridayIndex = text.indexOf("FRIDAY");
    expect(mondayIndex).toBeGreaterThanOrEqual(0);
    expect(fridayIndex).toBeGreaterThan(mondayIndex);
  });

  it("formats each exercise with the actual weight and reps logged per completed set", () => {
    const session: WorkoutSessionDoc = {
      id: "s1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      date: new Date(), completed: true, durationSeconds: 1800,
      sets: [
        makeCompletedSet({ id: "cs1", setNumber: 1, actualWeight: 90, actualReps: 9 }),
        makeCompletedSet({ id: "cs2", setNumber: 2, actualWeight: 90, actualReps: 8 }),
      ],
    };

    const text = formatSessionsWeekAsText("Reacher Build", 1, [session]);

    expect(text).toContain("Landmine Press");
    expect(text).toContain("9");
    expect(text).toContain("90 lb");
    expect(text).toContain("8");
  });

  it("excludes sets that were not completed", () => {
    const session: WorkoutSessionDoc = {
      id: "s1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      date: new Date(), completed: false, durationSeconds: 600,
      sets: [
        makeCompletedSet({ id: "cs1", setNumber: 1, actualWeight: 90, actualReps: 9, completed: true }),
        makeCompletedSet({ id: "cs2", setNumber: 2, actualWeight: 999, actualReps: 999, completed: false }),
      ],
    };

    const text = formatSessionsWeekAsText("Reacher Build", 1, [session]);
    expect(text).not.toContain("999");
  });

  it("formats time-based exercises using time display, not raw seconds", () => {
    const session: WorkoutSessionDoc = {
      id: "s1", programId: "p1", programName: "Reacher Build", week: 1, dayOfWeek: "Monday",
      date: new Date(), completed: true, durationSeconds: 600,
      sets: [
        makeCompletedSet({
          id: "cs1", exerciseName: "Scapular Hangs", setNumber: 1,
          actualWeight: 0, actualReps: 30, isTimeBased: true,
        }),
      ],
    };

    const text = formatSessionsWeekAsText("Reacher Build", 1, [session]);
    expect(text).toContain("Scapular Hangs");
    expect(text).toContain("30s");
  });
});

describe("formatSessionAsMarkdown", () => {
  const session: WorkoutSessionDoc = {
    id: "s1", programId: "p1", programName: "Reacher Build", week: 2, dayOfWeek: "Monday",
    date: new Date(2026, 9, 12, 8, 0), completed: true, durationSeconds: 3000,
    sets: [
      makeCompletedSet({ id: "a", exerciseName: "Bench Press", exerciseOrder: 1, phase: "warmup", setNumber: 1, actualWeight: 95, actualReps: 8 }),
      makeCompletedSet({ id: "b", exerciseName: "Bench Press", exerciseOrder: 2, phase: "main", setNumber: 1, actualWeight: 135, actualReps: 8, rating: "easy" }),
      makeCompletedSet({ id: "c", exerciseName: "Bench Press", exerciseOrder: 2, phase: "main", setNumber: 2, actualWeight: 135, actualReps: 6, rating: "hard", notes: "left shoulder pinched" }),
      makeCompletedSet({ id: "d", exerciseName: "Plank", exerciseOrder: 3, isTimeBased: true, setNumber: 1, actualWeight: 0, actualReps: 60 }),
      makeCompletedSet({ id: "e", exerciseName: "Curl", exerciseOrder: 4, setNumber: 1, completed: false, skipped: true, actualReps: 0, actualWeight: 0 }),
    ],
  };

  it("starts with a title, date and duration", () => {
    const md = formatSessionAsMarkdown(session);
    expect(md.split("\n")[0]).toBe("# Reacher Build — Monday, Week 2");
    expect(md).toContain("October 12, 2026");
    expect(md).toContain("50 min");
  });

  it("gives each exercise occurrence its own heading, labelling warm-ups", () => {
    const md = formatSessionAsMarkdown(session);
    expect(md).toContain("## Bench Press (warmup)");
    expect(md).toContain("## Bench Press\n");
    expect(md).toContain("## Plank");
  });

  it("lists every set with weight, reps, rating and notes", () => {
    const md = formatSessionAsMarkdown(session);
    expect(md).toContain("1. 8 reps @ 95 lb");
    expect(md).toContain("1. 8 reps @ 135 lb — easy");
    expect(md).toContain("2. 6 reps @ 135 lb — hard — left shoulder pinched");
  });

  it("formats time-based sets as durations and marks skipped sets", () => {
    const md = formatSessionAsMarkdown(session);
    expect(md).toContain("1. 1 min");
    expect(md).toContain("1. skipped");
  });

  it("says when the whole day was skipped", () => {
    const md = formatSessionAsMarkdown({ ...session, sets: [], completed: false, skipped: true });
    expect(md).toContain("Skipped");
  });
});
