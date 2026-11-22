import { describe, expect, it } from "vitest";
import { buildHomeSummary } from "../home-summary";

const today = new Date(2026, 10, 22, 9, 30); // Sunday 22 Nov 2026, local

describe("buildHomeSummary", () => {
  it("lists each program's workout for today and whether it is done", () => {
    const summary = buildHomeSummary(
      [
        { programName: "Reacher Build", workout: { dayOfWeek: "Sunday", exerciseCount: 6 }, done: false },
        { programName: "Mobility", workout: { dayOfWeek: "Daily", exerciseCount: 4 }, done: true },
      ],
      { completedThisWeek: 3, plannedThisWeek: 5 },
      today,
    );
    expect(summary).toEqual({
      date: "2026-11-22",
      programs: [
        { programName: "Reacher Build", dayLabel: "Sunday", exerciseCount: 6, done: false },
        { programName: "Mobility", dayLabel: "Daily", exerciseCount: 4, done: true },
      ],
      completedThisWeek: 3,
      plannedThisWeek: 5,
    });
  });

  it("marks a program with nothing scheduled today as a rest day", () => {
    const summary = buildHomeSummary([{ programName: "Reacher Build", workout: null, done: false }], { completedThisWeek: 0, plannedThisWeek: 3 }, today);
    expect(summary.programs[0]).toEqual({ programName: "Reacher Build", dayLabel: null, exerciseCount: 0, done: false });
  });

  it("keeps at most three programs", () => {
    const programs = ["a", "b", "c", "d"].map((programName) => ({ programName, workout: null, done: false }));
    expect(buildHomeSummary(programs, { completedThisWeek: 0, plannedThisWeek: 0 }, today).programs).toHaveLength(3);
  });
});
