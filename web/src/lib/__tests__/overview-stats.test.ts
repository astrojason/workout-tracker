import { describe, expect, it } from "vitest";
import type { BodyMeasurementDoc, CompletedSet, WorkoutSessionDoc } from "../types";
import { bodyweightTrend, buildOverview, dailyStatus, formatChange, formatMeasure } from "../overview-stats";

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
    expect(squat.measure).toBe("weight");
    expect(squat.values).toEqual([205, 225]);
    expect(squat.latest).toEqual({ value: 225, reps: 6 });
    expect(squat.change).toBe(20);
    expect(squat.bestE1RM).toBeCloseTo(225 * (1 + 6 / 30));
    expect(squat.sessions).toBe(2);
  });

  it("measures assisted pull-ups in bands, where fewer is progress, and leaves them out of volume", () => {
    const pull = (bands: number, reps: number) => set({ exerciseName: "Assisted Pull-up", definitionId: "pull", equipmentType: "assisted_pullup", actualWeight: bands, actualReps: reps });
    const o = buildOverview([
      session("new", "2026-11-23", [pull(2, 5), pull(2, 6)]),
      session("old", "2026-11-09", [pull(3, 5)]),
    ], { weeks: 4, now: NOW });
    const lift = o.lifts[0];
    expect(lift.measure).toBe("bands");
    expect(lift.values).toEqual([3, 2]);
    expect(lift.latest).toEqual({ value: 2, reps: 6 });
    expect(lift.change).toBe(-1);
    expect(lift.progress).toBeCloseTo(1 / 3);
    expect(lift.bestE1RM).toBeNull();
    expect(o.volume.current).toBe(0);
  });

  it("measures timed exercises by their longest hold", () => {
    const plank = (seconds: number) => set({ exerciseName: "Plank", definitionId: "plank", isTimeBased: true, actualWeight: 0, actualReps: seconds, equipmentType: "bodyweight" });
    const o = buildOverview([
      session("new", "2026-11-23", [plank(60), plank(90)]),
      session("old", "2026-11-09", [plank(45)]),
    ], { weeks: 4, now: NOW });
    expect(o.lifts[0]).toMatchObject({ measure: "time", values: [45, 90], latest: { value: 90 }, change: 45, bestE1RM: null });
  });

  it("measures unweighted exercises by reps", () => {
    const dips = (reps: number) => set({ exerciseName: "Dips", definitionId: "dips", equipmentType: "bodyweight", actualWeight: 0, actualReps: reps });
    const o = buildOverview([session("new", "2026-11-23", [dips(12)]), session("old", "2026-11-09", [dips(10)])], { weeks: 4, now: NOW });
    expect(o.lifts[0]).toMatchObject({ measure: "reps", values: [10, 12], change: 2 });
  });

  it("sorts lifts by how much they improved, most first", () => {
    const o = buildOverview([
      session("new", "2026-11-23", [
        set({ actualWeight: 210 }),                                                                       // squat +5%
        set({ exerciseName: "Assisted Pull-up", definitionId: "pull", equipmentType: "assisted_pullup", actualWeight: 2 }), // 3 → 2: +33%
        set({ exerciseName: "Curl", definitionId: "curl", actualWeight: 25 }),                            // 30 → 25: −17%
      ]),
      session("old", "2026-11-09", [
        set({ actualWeight: 200 }),
        set({ exerciseName: "Assisted Pull-up", definitionId: "pull", equipmentType: "assisted_pullup", actualWeight: 3 }),
        set({ exerciseName: "Curl", definitionId: "curl", actualWeight: 30 }),
      ]),
    ], { weeks: 4, now: NOW });
    expect(o.lifts.map((l) => l.name)).toEqual(["Assisted Pull-up", "Back Squat", "Curl"]);
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

describe("formatMeasure / formatChange", () => {
  it("labels each kind in its own unit", () => {
    expect(formatMeasure("weight", 225, 6)).toBe("225 lb × 6");
    expect(formatMeasure("bands", 3, 5)).toBe("3 bands × 5");
    expect(formatMeasure("bands", 1, 5)).toBe("1 band × 5");
    expect(formatMeasure("bands", 0, 8)).toBe("No assist × 8");
    expect(formatMeasure("time", 90)).toBe("1:30");
    expect(formatMeasure("reps", 12)).toBe("12 reps");
  });

  it("labels a change in the lift's unit with its sign", () => {
    expect(formatChange("weight", 10)).toBe("+10 lb");
    expect(formatChange("weight", -2.5)).toBe("−2.5 lb");
    expect(formatChange("bands", -1)).toBe("−1 band");
    expect(formatChange("bands", -2)).toBe("−2 bands");
    expect(formatChange("time", 30)).toBe("+30s");
    expect(formatChange("time", 60)).toBe("+1 min");
    expect(formatChange("reps", 2)).toBe("+2 reps");
    expect(formatChange("reps", 0)).toBe("No change");
  });
});
