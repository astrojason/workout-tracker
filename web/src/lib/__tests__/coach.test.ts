import { describe, it, expect } from "vitest";
import {
  buildCoachPrompt,
  validateCoachResponse,
  applyStructureAdjustment,
  type CoachInput,
} from "../coach";
import type { Workout } from "../types";

const input: CoachInput = {
  programName: "Strength",
  week: 2,
  dayOfWeek: "Monday",
  durationSeconds: 3000,
  sets: [
    { exerciseName: "Squat", setNumber: 1, targetWeight: 135, actualWeight: 135, targetReps: 8, actualReps: 8, completed: true, rating: "easy" },
  ],
  prs: [],
  recentSessions: [],
  upcoming: [{ week: 2, dayOfWeek: "Wednesday", exercises: [{ name: "Squat", sets: 3, repMin: 8, repMax: "8", weight: 135 }] }],
};

describe("buildCoachPrompt", () => {
  it("includes session results and upcoming workouts", () => {
    const p = buildCoachPrompt(input);
    expect(p).toContain("Squat");
    expect(p).toContain("Wednesday");
    expect(p).toContain("easy");
  });
});

describe("validateCoachResponse", () => {
  const known = ["Squat", "Bench"];
  it("keeps valid adjustments", () => {
    const r = validateCoachResponse(
      { feedback: "Nice", adjustments: [{ exerciseName: "Squat", field: "weight", to: 145, reason: "easy" }] },
      known,
    );
    expect(r.feedback).toBe("Nice");
    expect(r.adjustments).toHaveLength(1);
  });
  it("drops unknown exercises, bad fields and out-of-range values", () => {
    const r = validateCoachResponse(
      {
        feedback: "x",
        adjustments: [
          { exerciseName: "Nope", field: "weight", to: 10, reason: "" },
          { exerciseName: "Squat", field: "color", to: 10, reason: "" },
          { exerciseName: "Squat", field: "sets", to: 99, reason: "" },
          { exerciseName: "Squat", field: "weight", to: -5, reason: "" },
          { exerciseName: "Squat", field: "weight", to: "heavy", reason: "" },
        ],
      },
      known,
    );
    expect(r.adjustments).toHaveLength(0);
  });
  it("throws on a malformed response", () => {
    expect(() => validateCoachResponse("nope", known)).toThrow(/coach/i);
  });
});

describe("applyStructureAdjustment", () => {
  const w = (week: number, day: string): Workout => ({
    id: `${week}-${day}`, programId: "p", programName: "Strength", week, dayOfWeek: day,
    exercises: [
      { id: "e1", definitionId: "d1", order: 1, phase: "main", sets: 3, repMin: 8, repMax: { type: "count", value: 8 }, restSeconds: 90, notes: null },
      { id: "e2", definitionId: "d2", order: 2, phase: "main", sets: 3, repMin: 8, repMax: { type: "count", value: 8 }, restSeconds: 90, notes: null },
    ],
  });
  const workouts = [w(1, "Monday"), w(2, "Monday"), w(3, "Monday")];

  it("changes sets only for the current week onward, only for that exercise", () => {
    const changed = applyStructureAdjustment(workouts, "d1", "sets", 4, 2);
    expect(changed.map((c) => c.week)).toEqual([2, 3]);
    expect(changed[0].exercises[0].sets).toBe(4);
    expect(changed[0].exercises[1].sets).toBe(3);
  });
  it("raises repMax so it never sits below repMin", () => {
    const changed = applyStructureAdjustment(workouts, "d1", "repMin", 10, 3);
    expect(changed[0].exercises[0].repMin).toBe(10);
    expect(changed[0].exercises[0].repMax).toEqual({ type: "count", value: 10 });
  });
  it("does not mutate its input", () => {
    applyStructureAdjustment(workouts, "d1", "sets", 5, 1);
    expect(workouts[0].exercises[0].sets).toBe(3);
  });
});

import { pickRecentSessions } from "../coach";
import type { WorkoutSessionDoc } from "../types";

describe("pickRecentSessions", () => {
  const mk = (id: string, date: string, over: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc => ({
    id, programId: "p", programName: "S", week: 1, dayOfWeek: "Monday",
    date: new Date(date), completed: true, durationSeconds: 1, sets: [], ...over,
  });
  it("keeps same-program completed sessions before the cutoff, newest first", () => {
    const out = pickRecentSessions(
      [
        mk("a", "2026-10-01"),
        mk("b", "2026-10-03"),
        mk("c", "2026-10-05"),
        mk("d", "2026-10-02", { programId: "other" }),
        mk("e", "2026-10-02", { skipped: true, completed: false }),
      ],
      "p",
      new Date("2026-10-04"),
    );
    expect(out.map((s) => s.date)).toEqual(["2026-10-03", "2026-10-01"]);
  });
});
