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
  it("returns the local dates of completed sessions for the program's current week", () => {
    const days = sessionDaysForWeek([
      session("a", "2026-10-08"),
      session("b", "2026-10-01", { week: 1 }),
      session("c", "2026-10-07", { programId: "other" }),
      session("d", "2026-10-06", { completed: false }),
    ], "program-1", 2, "completed");

    expect([...days]).toEqual(["2026-10-08"]);
  });

  it("returns skipped days separately", () => {
    const sessions = [
      session("a", "2026-10-08"),
      session("b", "2026-10-09", { completed: false, skipped: true }),
    ];

    expect([...sessionDaysForWeek(sessions, "program-1", 2, "skipped")]).toEqual(["2026-10-09"]);
  });

  it("ignores sessions from before the program was created", () => {
    const days = sessionDaysForWeek(
      [session("a", "2026-10-01"), session("b", "2026-10-08")],
      "program-1", 2, "completed", new Date("2026-10-05T00:00:00"),
    );

    expect([...days]).toEqual(["2026-10-08"]);
  });
});
