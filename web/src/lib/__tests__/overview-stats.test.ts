import { describe, expect, it } from "vitest";
import type { BodyMeasurementDoc, CompletedSet, WorkoutSessionDoc } from "../types";
import { bodyweightTrend, buildOverview, dailyStatus } from "../overview-stats";

const NOW = new Date("2026-11-24T18:00:00"); // a Tuesday

function set(overrides: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: Math.random().toString(36).slice(2),
    exerciseName: "Back Squat",
    definitionId: "squat",
    exerciseOrder: 1,
    setNumber: 1,
    targetWeight: 200,
    actualWeight: 200,
    targetReps: 5,
    actualReps: 5,
    completed: true,
    timestamp: new Date(),
    notes: null,
    phase: "main",
    ...overrides,
  };
}

function session(id: string, date: string, sets: CompletedSet[], overrides: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc {
  return {
    id,
    programId: "p1",
    programName: "Block B",
    week: 1,
    dayOfWeek: "Monday",
    date: new Date(`${date}T12:00:00`),
    completed: true,
    durationSeconds: 3000,
    sets,
    ...overrides,
  };
}

describe("buildOverview", () => {
  it("counts volume from completed working sets only", () => {
    const s = session("a", "2026-11-23", [
      set({ actualWeight: 200, actualReps: 5 }),                        // 1000
      set({ actualWeight: 100, actualReps: 5, phase: "warmup" }),      // warm-up: ignored
      set({ actualWeight: 200, actualReps: 0, completed: false }),     // failed: ignored
      set({ actualWeight: 200, actualReps: 5, skipped: true }),        // skipped: ignored
      set({ actualWeight: 0, actualReps: 10, equipmentType: "bodyweight" }), // no load: ignored
      set({ actualWeight: 30, actualReps: 60, isTimeBased: true }),    // time-based: ignored
    ]);
    const o = buildOverview([s], { weeks: 4, now: NOW });
    expect(o.volume.current).toBe(1000);
    expect(o.workingSets.current).toBe(1);
  });

  it("splits the range from the equal period before it", () => {
    const sessions = [
      session("now1", "2026-11-23", [set()]),
      session("now2", "2026-11-10", [set()]),
      session("prior", "2026-10-20", [set({ actualWeight: 100 })]),
      session("tooOld", "2026-09-01", [set()]),
    ];
    const o = buildOverview(sessions, { weeks: 4, now: NOW });
    expect(o.sessions).toEqual({ current: 2, prior: 1 });
    expect(o.volume).toEqual({ current: 2000, prior: 500 });
  });

  it("leaves skipped and unfinished sessions out of the session count and average duration", () => {
    const o = buildOverview([
      session("done", "2026-11-23", [set()], { durationSeconds: 3600 }),
      session("partial", "2026-11-21", [set()], { completed: false, durationSeconds: 600 }),
      session("skip", "2026-11-19", [], { completed: false, skipped: true, durationSeconds: 0 }),
    ], { weeks: 4, now: NOW });
    expect(o.sessions.current).toBe(1);
    expect(o.avgDurationSeconds.current).toBe(3600);
    // A partial session's sets still count toward volume: they were lifted.
    expect(o.volume.current).toBe(2000);
  });

  it("reports no average duration for a period without sessions", () => {
    const o = buildOverview([], { weeks: 4, now: NOW });
    expect(o.avgDurationSeconds).toEqual({ current: null, prior: null });
  });

  it("buckets volume into Monday-start weeks, oldest first, ending with this week", () => {
    const o = buildOverview([
      session("thisWeek", "2026-11-23", [set()]),     // Monday of this week
      session("lastSunday", "2026-11-22", [set()]),   // previous week
      session("lastMonday", "2026-11-16", [set()]),
    ], { weeks: 4, now: NOW });
    expect(o.weeklyVolume).toHaveLength(4);
    expect(o.weeklyVolume[3].weekStart).toEqual(new Date(2026, 10, 23));
    expect(o.weeklyVolume.map((w) => w.volume)).toEqual([0, 0, 2000, 1000]);
  });

  it("summarises each lift: top set per session, change, best estimated 1RM", () => {
    const o = buildOverview([
      session("s2", "2026-11-23", [set({ actualWeight: 225, actualReps: 5 }), set({ actualWeight: 225, actualReps: 6, setNumber: 2 })]),
      session("s1", "2026-11-09", [set({ actualWeight: 205, actualReps: 8 })]),
    ], { weeks: 4, now: NOW });
    expect(o.lifts).toHaveLength(1);
    const squat = o.lifts[0];
    expect(squat.name).toBe("Back Squat");
    expect(squat.definitionId).toBe("squat");
    expect(squat.topWeights).toEqual([205, 225]);
    expect(squat.latestTop).toEqual({ weight: 225, reps: 6 });
    expect(squat.change).toBe(20);
    expect(squat.bestE1RM).toBeCloseTo(225 * (1 + 6 / 30));
    expect(squat.sessions).toBe(2);
  });

  it("filters to one program when asked", () => {
    const o = buildOverview([
      session("a", "2026-11-23", [set()]),
      session("b", "2026-11-22", [set({ exerciseName: "Curl", definitionId: "curl" })], { programId: "p2" }),
    ], { weeks: 4, now: NOW, programId: "p2" });
    expect(o.sessions.current).toBe(1);
    expect(o.lifts.map((l) => l.name)).toEqual(["Curl"]);
  });

  it("lists progression changes in the range, newest first", () => {
    const change = { definitionId: "squat", before: { currentWeight: 200, hardStreak: 2 }, after: { currentWeight: 205, hardStreak: 0 } };
    const o = buildOverview([
      session("new", "2026-11-23", [set()], { progressionChanges: [change] }),
      session("old", "2026-11-09", [set()], { progressionChanges: [{ ...change, before: { currentWeight: 195, hardStreak: 2 }, after: { currentWeight: 200, hardStreak: 0 } }] }),
    ], { weeks: 4, now: NOW });
    expect(o.changes.map((c) => c.sessionId)).toEqual(["new", "old"]);
    expect(o.changes[0]).toMatchObject({ definitionId: "squat", before: 200, after: 205 });
  });
});

describe("dailyStatus", () => {
  it("marks each day of the last N weeks, oldest first, with future days upcoming", () => {
    const days = dailyStatus([
      session("done", "2026-11-23", [set()]),
      session("skip", "2026-11-17", [], { completed: false, skipped: true }),
      session("partial", "2026-11-18", [set()], { completed: false }),
    ], 2, NOW);
    expect(days).toHaveLength(14);
    expect(days[0].date).toEqual(new Date(2026, 10, 16));
    const byDay = Object.fromEntries(days.map((d) => [d.date.getDate(), d.status]));
    expect(byDay[23]).toBe("completed");
    expect(byDay[17]).toBe("skipped");
    expect(byDay[18]).toBe("partial");
    expect(byDay[20]).toBe("rest");
    expect(byDay[25]).toBe("upcoming");
  });

  it("a completed session wins over a skipped one on the same day", () => {
    const days = dailyStatus([
      session("skip", "2026-11-23", [], { completed: false, skipped: true }),
      session("done", "2026-11-23", [set()]),
    ], 1, NOW);
    expect(days.find((d) => d.date.getDate() === 23)!.status).toBe("completed");
  });
});

describe("bodyweightTrend", () => {
  const m = (id: string, date: string, weight?: number): BodyMeasurementDoc => ({ id, date: new Date(`${date}T08:00:00`), weight });

  it("gives the latest weight and the change since the first weigh-in in the range", () => {
    const t = bodyweightTrend([m("a", "2026-09-01", 190), m("b", "2026-11-01", 187), m("c", "2026-11-20", 184.5), m("d", "2026-11-22")], new Date(2026, 9, 28));
    expect(t).toEqual({ latest: 184.5, change: -2.5, points: [187, 184.5] });
  });

  it("is null without a weigh-in", () => {
    expect(bodyweightTrend([m("a", "2026-11-20")], new Date(2026, 9, 28))).toBeNull();
  });
});
