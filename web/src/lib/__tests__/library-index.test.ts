import { describe, expect, it } from "vitest";
import type { CompletedSet, ExerciseDefinition, Program, Workout, WorkoutSessionDoc } from "../types";
import { exerciseRows, programRows } from "../library-index";

const now = new Date();
const def = (id: string, name: string, extra: Partial<ExerciseDefinition> = {}): ExerciseDefinition => ({
  id, name, muscleGroups: ["Quads"], equipmentType: "barbell_45", equipmentDetail: null, progressionRule: "add_5lb",
  isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now, ...extra,
});
const program = (id: string, name: string, weights: string[], archived = false): Program => ({
  id, name, totalWeeks: 12, createdAt: now, archived,
  weights: Object.fromEntries(weights.map((w) => [w, { currentWeight: 100, hardStreak: 0 }])),
});
const workout = (programId: string, week: number, dayOfWeek: string, defs: string[]): Workout => ({
  id: `${programId}-${week}-${dayOfWeek}`, programId, programName: "", week, dayOfWeek,
  exercises: defs.map((d, i) => ({ id: `${d}${i}`, definitionId: d, order: i + 1, phase: "main", sets: 3, repMin: 5, repMax: { type: "count", value: 8 }, restSeconds: 90, notes: null })),
});
const set = (name: string, definitionId?: string): CompletedSet => ({
  id: Math.random().toString(36), exerciseName: name, definitionId, exerciseOrder: 1, setNumber: 1, targetWeight: 100,
  actualWeight: 100, targetReps: 5, actualReps: 5, completed: true, timestamp: now, notes: null,
});
const session = (id: string, programId: string, date: string, sets: CompletedSet[]): WorkoutSessionDoc => ({
  id, programId, programName: "", week: 1, dayOfWeek: "Monday", date: new Date(`${date}T12:00:00`), completed: true, durationSeconds: 60, sets,
});

const programs = [program("p1", "Block B", ["squat", "bench"]), program("old", "Block A", ["squat"], true), program("p2", "Mobility", [])];
const workouts = [
  workout("p1", 1, "Thursday", ["squat", "bench"]), workout("p1", 1, "Monday", ["squat"]), workout("p1", 2, "Monday", ["squat", "row"]),
  workout("p2", 1, "Daily", ["stretch"]),
];
const sessions = [
  session("s3", "p1", "2026-11-23", [set("Back Squat", "squat")]),
  session("s2", "p1", "2026-11-20", [set("Bench Press", "bench")]),
  session("s1", "old", "2026-08-01", [set("Back Squat")]),
];

describe("programRows", () => {
  it("summarises each program: weeks, training days, exercises, sessions and last trained; active first", () => {
    expect(programRows(programs, workouts, sessions, { p1: 7 })).toEqual([
      { id: "p1", name: "Block B", archived: false, totalWeeks: 12, currentWeek: 7, days: ["Monday", "Thursday"], exercises: 3, sessions: 2, lastTrained: new Date("2026-11-23T12:00:00") },
      { id: "p2", name: "Mobility", archived: false, totalWeeks: 12, currentWeek: 1, days: ["Daily"], exercises: 1, sessions: 0, lastTrained: null },
      { id: "old", name: "Block A", archived: true, totalWeeks: 12, currentWeek: 1, days: [], exercises: 0, sessions: 1, lastTrained: new Date("2026-08-01T12:00:00") },
    ]);
  });
});

describe("exerciseRows", () => {
  it("lists the library with the active programs using each exercise and when it was last done, most recent first", () => {
    const definitions = { squat: def("squat", "Back Squat"), bench: def("bench", "Bench Press"), curl: def("curl", "Curl", { equipmentType: "dumbbell" }) };
    const rows = exerciseRows(definitions, programs, sessions);
    expect(rows.map((r) => [r.name, r.programs, r.sessions, r.lastDone])).toEqual([
      ["Back Squat", ["Block B"], 2, new Date("2026-11-23T12:00:00")],
      ["Bench Press", ["Block B"], 1, new Date("2026-11-20T12:00:00")],
      ["Curl", [], 0, null],
    ]);
  });
});
