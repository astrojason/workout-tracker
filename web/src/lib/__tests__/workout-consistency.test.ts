import { describe, expect, it } from "vitest";
import type { WorkoutSessionDoc } from "../types";
import { calculateWorkoutConsistency, sessionDaysForWeek } from "../workout-consistency";

function session(
  id: string,
  date: string,
  overrides: Partial<WorkoutSessionDoc> = {},
): WorkoutSessionDoc {
  return {
    id,
    programId: "program-1",
    programName: "Program One",
    week: 2,
    dayOfWeek: "Monday",
    date: new Date(`${date}T12:00:00`),
    completed: true,
    durationSeconds: 1800,
    sets: [],
    ...overrides,
  };
}

const schedule = [{
  programId: "program-1",
  week: 2,
  days: ["Monday", "Wednesday", "Friday", "Sunday"],
}];

describe("calculateWorkoutConsistency", () => {
  it("shows a streak through today and this week's scheduled completion count", () => {
    const result = calculateWorkoutConsistency(
      [
        session("sun", "2026-08-30", { dayOfWeek: "Sunday" }),
        session("mon", "2026-08-31"),
        session("wed", "2026-09-02", { dayOfWeek: "Wednesday" }),
        session("thu", "2026-09-03", { dayOfWeek: "Thursday" }),
        session("fri", "2026-09-04", { dayOfWeek: "Friday" }),
      ],
      schedule,
      new Date("2026-09-04T18:00:00"),
    );

    expect(result).toEqual({ currentStreak: 3, completedThisWeek: 3, plannedThisWeek: 4 });
  });

  it("keeps a streak alive when the most recent workout was yesterday", () => {
    const result = calculateWorkoutConsistency(
      [session("mon", "2026-08-31"), session("tue", "2026-09-01", { dayOfWeek: "Tuesday" })],
      schedule,
      new Date("2026-09-02T08:00:00"),
    );

    expect(result.currentStreak).toBe(2);
  });

  it("ignores incomplete, duplicate, unscheduled, and inactive-program sessions for adherence", () => {
    const result = calculateWorkoutConsistency(
      [
        session("mon", "2026-08-31"),
        session("mon-duplicate", "2026-08-31"),
        session("wed-incomplete", "2026-09-02", { dayOfWeek: "Wednesday", completed: false }),
        session("tue-unscheduled", "2026-09-01", { dayOfWeek: "Tuesday" }),
        session("other-program", "2026-09-04", { programId: "archived", dayOfWeek: "Friday" }),
      ],
      schedule,
      new Date("2026-09-04T18:00:00"),
    );

    expect(result.completedThisWeek).toBe(1);
  });

  it("expands a Daily workout into one planned slot per day", () => {
    const result = calculateWorkoutConsistency(
      [
        session("daily-mon", "2026-08-31", { dayOfWeek: "Daily" }),
        session("daily-tue", "2026-09-01", { dayOfWeek: "Daily" }),
        session("daily-tue-duplicate", "2026-09-01", { dayOfWeek: "Daily" }),
      ],
      [{ programId: "program-1", week: 2, days: ["Daily"] }],
      new Date("2026-09-02T08:00:00"),
    );

    expect(result).toMatchObject({ completedThisWeek: 2, plannedThisWeek: 7 });
  });
});

describe("sessionDaysForWeek", () => {
  // The Home week grid and today button read these from the live session list, the
  // same source as the streak, so finishing a workout updates all three together.
  // 2026-10-08 is a Thursday, 2026-10-09 a Friday, 2026-10-10 a Saturday.
  const thu = { dayOfWeek: "Thursday" };

  it("returns the local dates of completed sessions for the program's current week", () => {
    const days = sessionDaysForWeek([
      session("a", "2026-10-08", thu),
      session("b", "2026-10-01", { ...thu, week: 1 }),
      session("c", "2026-10-07", { ...thu, programId: "other" }),
      session("d", "2026-10-06", { ...thu, completed: false }),
    ], "program-1", 2, "completed");

    expect([...days]).toEqual(["2026-10-08"]);
  });

  it("returns skipped days separately", () => {
    const sessions = [
      session("a", "2026-10-08", thu),
      session("b", "2026-10-09", { dayOfWeek: "Friday", completed: false, skipped: true }),
    ];

    expect([...sessionDaysForWeek(sessions, "program-1", 2, "skipped")]).toEqual(["2026-10-09"]);
  });

  it("ignores sessions from before the program was created", () => {
    const days = sessionDaysForWeek(
      [session("a", "2026-10-01", thu), session("b", "2026-10-08", thu)],
      "program-1", 2, "completed", new Date("2026-10-05T00:00:00"),
    );

    expect([...days]).toEqual(["2026-10-08"]);
  });

  // "Choose different day": Thursday's workout done on Saturday is Thursday's, not Saturday's.
  it("marks the day a workout was scheduled for, not the day it was done", () => {
    const days = sessionDaysForWeek([session("a", "2026-10-10", thu)], "program-1", 2, "completed");
    expect([...days]).toEqual(["2026-10-08"]);
  });

  it("marks a later scheduled day when a workout is done early", () => {
    const days = sessionDaysForWeek([session("a", "2026-10-08", { dayOfWeek: "Saturday" })], "program-1", 2, "completed");
    expect([...days]).toEqual(["2026-10-10"]);
  });

  it("places a Sunday session in the Monday-to-Sunday week it was done in", () => {
    // Sunday 2026-10-11 belongs to the week of Monday 2026-10-05, so Thursday is 2026-10-08.
    const days = sessionDaysForWeek([session("a", "2026-10-11", thu)], "program-1", 2, "completed");
    expect([...days]).toEqual(["2026-10-08"]);
  });

  it("marks a skipped day by its scheduled day too", () => {
    const days = sessionDaysForWeek(
      [session("a", "2026-10-10", { ...thu, completed: false, skipped: true })], "program-1", 2, "skipped",
    );
    expect([...days]).toEqual(["2026-10-08"]);
  });

  it("falls back to the date done for a Daily workout", () => {
    const days = sessionDaysForWeek([session("a", "2026-10-10", { dayOfWeek: "Daily" })], "program-1", 2, "completed");
    expect([...days]).toEqual(["2026-10-10"]);
  });
});
