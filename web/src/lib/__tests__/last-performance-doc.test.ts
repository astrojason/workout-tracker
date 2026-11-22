import { describe, it, expect } from "vitest";
import {
  applySessionToLastPerformance, buildLastPerformance, emptyLastPerformance, lastPerformanceSessions,
} from "../last-performance-doc";
import { buildPreviousPerformanceMap } from "../last-performance";
import { suggestCustomWeight } from "../custom-workout";
import type { CompletedSet, ExerciseDefinition, ResolvedExercise, WorkoutSessionDoc } from "../types";

const day = (n: number) => new Date(2026, 10, n);

function set(name: string, weight: number, reps: number, over: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: `${name}-${weight}-${reps}`, exerciseName: name, exerciseOrder: 1, setNumber: 1, targetWeight: weight,
    actualWeight: weight, targetReps: reps, actualReps: reps, completed: true, timestamp: new Date(0), notes: null,
    ...over,
  };
}

function session(id: string, date: Date, sets: CompletedSet[]): WorkoutSessionDoc {
  return { id, programId: "p", programName: "P", week: 1, dayOfWeek: "Monday", date, completed: true, durationSeconds: 1, sets } as WorkoutSessionDoc;
}

const exercise = (name: string, definitionId = name) =>
  ({ id: name, definitionId, name, equipmentType: "barbell", isTimeBased: false } as unknown as ResolvedExercise);

const sessions = [
  session("s3", day(20), [set("Squat", 225, 5), set("Press", 95, 8)]),
  session("s2", day(13), [set("Bench", 185, 5), set("Squat", 215, 5), set("Squat", 220, 5, { setNumber: 2 }), set("Squat", 100, 5, { completed: false })]),
  session("s1", day(6), [set("Bench", 175, 5), set("Deadlift", 315, 3)]),
];

describe("buildLastPerformance", () => {
  const doc = buildLastPerformance(sessions);

  it("keeps each exercise's completed sets from the newest session that had it", () => {
    expect(Object.keys(doc.entries).sort()).toEqual(["bench", "deadlift", "press", "squat"]);
    expect(doc.entries.squat.sessionId).toBe("s3");
    expect(doc.entries.bench.sessionId).toBe("s2");
    expect(doc.entries.bench.sets).toHaveLength(1);
    expect(doc.entries.deadlift.sessionId).toBe("s1");
  });

  it("drops sets that were not completed", () => {
    const only = buildLastPerformance([sessions[1]]);
    expect(only.entries.squat.sets.map((s) => s.actualWeight)).toEqual([215, 220]);
  });

  it("gives the same last performance as the full history does", () => {
    const exercises = ["Squat", "Bench", "Press", "Deadlift", "Curl"].map((n) => exercise(n));
    expect(buildPreviousPerformanceMap(exercises, lastPerformanceSessions(doc)))
      .toEqual(buildPreviousPerformanceMap(exercises, sessions));
  });

  it("gives the same custom-workout suggestion as the full history does", () => {
    const def = { id: "Bench", name: "Bench", equipmentType: "barbell", isTimeBased: false } as unknown as ExerciseDefinition;
    const now = day(25);
    expect(suggestCustomWeight(def, lastPerformanceSessions(doc), undefined, now))
      .toEqual(suggestCustomWeight(def, sessions, undefined, now));
  });
});

describe("applySessionToLastPerformance", () => {
  it("replaces an exercise's entry with a newer session and leaves others alone", () => {
    const before = buildLastPerformance(sessions);
    const next = applySessionToLastPerformance(before, session("s4", day(27), [set("Bench", 190, 5)]));
    expect(next.entries.bench.sessionId).toBe("s4");
    expect(next.entries.squat.sessionId).toBe("s3");
  });

  it("ignores a session older than what's recorded", () => {
    const before = buildLastPerformance(sessions);
    const next = applySessionToLastPerformance(before, session("old", day(1), [set("Squat", 100, 5)]));
    expect(next.entries.squat.sessionId).toBe("s3");
  });

  it("does nothing for a session with no completed sets", () => {
    expect(applySessionToLastPerformance(emptyLastPerformance(), session("skip", day(5), []))).toEqual(emptyLastPerformance());
  });

  it("removes an exercise from a re-saved session that no longer has it completed", () => {
    const first = applySessionToLastPerformance(emptyLastPerformance(), session("c", day(5), [set("Stretch", 0, 1), set("Plank", 0, 1)]));
    const resaved = applySessionToLastPerformance(first, session("c", day(5), [set("Stretch", 0, 1)]));
    expect(Object.keys(resaved.entries)).toEqual(["stretch"]);
  });

  it("does not store undefined fields (Firestore rejects them)", () => {
    const next = applySessionToLastPerformance(emptyLastPerformance(), session("s", day(5), [set("Row", 100, 8, { rating: undefined })]));
    expect("rating" in next.entries.row.sets[0]).toBe(false);
  });
});
