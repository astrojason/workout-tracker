import { describe, expect, it } from "vitest";
import type { CompletedSet, WorkoutSessionDoc } from "../types";
import { buildExerciseReport, exerciseLogCsv } from "../exercise-report";

const NOW = new Date("2026-11-24T18:00:00");

function set(overrides: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: Math.random().toString(36).slice(2),
    exerciseName: "Back Squat", definitionId: "squat", exerciseOrder: 1, setNumber: 1,
    targetWeight: 200, actualWeight: 200, targetReps: 5, actualReps: 5, completed: true,
    timestamp: new Date(), notes: null, phase: "main", equipmentType: "barbell_45",
    ...overrides,
  };
}

function session(id: string, date: string, sets: CompletedSet[], overrides: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc {
  return {
    id, programId: "p1", programName: "Block B", week: 2, dayOfWeek: "Monday",
    date: new Date(`${date}T12:00:00`), completed: true, durationSeconds: 3000, sets, ...overrides,
  };
}

const target = { definitionId: "squat", name: "Back Squat" };

describe("buildExerciseReport", () => {
  it("keeps only this exercise's sets, matched by definition id, or by name for older sets", () => {
    const r = buildExerciseReport([
      session("a", "2026-11-23", [
        set(),
        set({ exerciseName: "Bench Press", definitionId: "bench" }),
        set({ definitionId: undefined, setNumber: 2 }),                            // legacy: matched by name
        set({ exerciseName: "Back Squat", definitionId: "other", setNumber: 3 }), // same name, different exercise
      ]),
    ], { ...target, weeks: 12, now: NOW });
    expect(r.log.map((l) => l.setNumber)).toEqual([1, 2]);
  });

  it("charts each session's best set with its estimated 1RM, top weight and volume, oldest first", () => {
    const r = buildExerciseReport([
      session("new", "2026-11-23", [set({ actualWeight: 225, actualReps: 5 }), set({ actualWeight: 225, actualReps: 6, setNumber: 2 })]),
      session("old", "2026-11-09", [set({ actualWeight: 205, actualReps: 8 })]),
    ], { ...target, weeks: 12, now: NOW });
    expect(r.measure).toBe("weight");
    expect(r.points.map((p) => p.sessionId)).toEqual(["old", "new"]);
    expect(r.points[1]).toMatchObject({ best: 225, reps: 6, volume: 225 * 11 });
    expect(r.points[1].e1rm).toBeCloseTo(225 * (1 + 6 / 30));
  });

  it("marks a session as a PR when it beats every earlier session in the range", () => {
    const r = buildExerciseReport([
      session("c", "2026-11-23", [set({ actualWeight: 230 })]),
      session("b", "2026-11-16", [set({ actualWeight: 210 })]),
      session("a", "2026-11-09", [set({ actualWeight: 220 })]),
    ], { ...target, weeks: 12, now: NOW });
    expect(r.points.map((p) => p.isPR)).toEqual([false, false, true]);
  });

  it("summarises the range: heaviest set, best e1RM, volume, working sets, sessions and change", () => {
    const r = buildExerciseReport([
      session("new", "2026-11-23", [set({ actualWeight: 225, actualReps: 5 }), set({ actualWeight: 100, phase: "warmup" })]),
      session("old", "2026-11-09", [set({ actualWeight: 215, actualReps: 8 })]),
    ], { ...target, weeks: 12, now: NOW });
    expect(r.stats.heaviest).toMatchObject({ value: 225, reps: 5 });
    expect(r.stats.bestE1RM!.value).toBeCloseTo(215 * (1 + 8 / 30));
    expect(r.stats.volume).toBe(225 * 5 + 215 * 8);
    expect(r.stats.workingSets).toBe(2);
    expect(r.stats.sessions).toBe(2);
    expect(r.stats.change).toBe(10);
  });

  it("lists the best weight at each rep count", () => {
    const r = buildExerciseReport([
      session("a", "2026-11-23", [set({ actualWeight: 225, actualReps: 5 }), set({ actualWeight: 205, actualReps: 8, setNumber: 2 })]),
      session("b", "2026-11-09", [set({ actualWeight: 230, actualReps: 5 })]),
    ], { ...target, weeks: 12, now: NOW });
    expect(r.repRecords.map((x) => [x.reps, x.weight, x.sessionId])).toEqual([[5, 230, "b"], [8, 205, "a"]]);
  });

  it("counts the final-set rating of each session", () => {
    const r = buildExerciseReport([
      session("a", "2026-11-23", [set({ rating: "easy" }), set({ setNumber: 2, rating: "hard" })]),
      session("b", "2026-11-16", [set({ rating: "normal" })]),
      session("c", "2026-11-09", [set()]),
    ], { ...target, weeks: 12, now: NOW });
    expect(r.ratings).toEqual({ easy: 0, normal: 1, hard: 1, unrated: 1 });
  });

  it("logs every set newest first, with warm-ups, failed and skipped sets marked", () => {
    const r = buildExerciseReport([
      session("a", "2026-11-23", [
        set({ phase: "warmup", actualWeight: 135 }),
        set({ setNumber: 2 }),
        set({ setNumber: 3, completed: false, actualReps: 3 }),
        set({ setNumber: 4, completed: false, skipped: true, actualReps: 0 }),
      ]),
      session("b", "2026-11-09", [set()]),
    ], { ...target, weeks: 12, now: NOW });
    expect(r.log.map((l) => [l.sessionId, l.status])).toEqual([
      ["a", "warmup"], ["a", "done"], ["a", "failed"], ["a", "skipped"], ["b", "done"],
    ]);
  });

  it("measures assisted pull-ups in bands, fewer being better", () => {
    const pull = (bands: number) => set({ exerciseName: "Assisted Pull-up", definitionId: "pull", equipmentType: "assisted_pullup", actualWeight: bands });
    const r = buildExerciseReport([
      session("new", "2026-11-23", [pull(1)]),
      session("old", "2026-11-09", [pull(3)]),
    ], { definitionId: "pull", name: "Assisted Pull-up", weeks: 12, now: NOW });
    expect(r.measure).toBe("bands");
    expect(r.points.map((p) => p.best)).toEqual([3, 1]);
    expect(r.points[1].isPR).toBe(true);
    expect(r.stats.change).toBe(-2);
    expect(r.repRecords).toEqual([]);
    expect(r.stats.volume).toBe(0);
  });

  it("measures timed exercises by the longest hold", () => {
    const plank = (s: number) => set({ exerciseName: "Plank", definitionId: "plank", isTimeBased: true, actualWeight: 0, actualReps: s });
    const r = buildExerciseReport([session("a", "2026-11-23", [plank(60), plank(90)])], { definitionId: "plank", name: "Plank", weeks: 12, now: NOW });
    expect(r.measure).toBe("time");
    expect(r.points[0].best).toBe(90);
    expect(r.stats.heaviest).toMatchObject({ value: 90 });
  });

  it("filters by program and range", () => {
    const r = buildExerciseReport([
      session("in", "2026-11-23", [set()]),
      session("otherProgram", "2026-11-22", [set()], { programId: "p2" }),
      session("tooOld", "2026-06-01", [set()]),
    ], { ...target, weeks: 12, now: NOW, programId: "p1" });
    expect(r.points.map((p) => p.sessionId)).toEqual(["in"]);
  });
});

describe("exerciseLogCsv", () => {
  it("writes the log as CSV, quoting fields that need it", () => {
    const r = buildExerciseReport([
      session("a", "2026-11-23", [set({ notes: 'Belt, "grindy"', rating: "hard" })]),
    ], { ...target, weeks: 12, now: NOW });
    const csv = exerciseLogCsv(r.log);
    const [header, row] = csv.trim().split("\n");
    expect(header).toBe("Date,Program,Day,Week,Set,Phase,Status,Target weight,Target reps,Weight,Reps,Rating,Notes");
    expect(row).toBe('2026-11-23,Block B,Monday,2,1,main,done,200,5,200,5,hard,"Belt, ""grindy"""');
  });
});
