import { describe, expect, it } from "vitest";
import { warmupPreviewLifts } from "../warmup-preview";
import { DEFAULT_EQUIPMENT_CONFIG } from "../equipment-calculator";
import type { Exercise, ExerciseDefinition, Program, Workout } from "../types";

// The Warm-ups preview shows real lifts: from active programs, at the program's weight, with the
// day's reps, a couple per equipment group.

const now = new Date();
const def = (id: string, o: Partial<ExerciseDefinition> = {}): ExerciseDefinition => ({
  id, name: id, muscleGroups: [], equipmentType: "barbell_45", equipmentDetail: null, progressionRule: "none",
  isUnilateral: false, isTimeBased: false, currentWeight: 100, hardStreak: 0, createdAt: now, updatedAt: now, ...o,
});
const occ = (definitionId: string, o: Partial<Exercise> = {}): Exercise => ({
  id: definitionId, definitionId, order: 1, phase: "main", sets: 3, repMin: 5, repMax: { type: "count", value: 5 }, restSeconds: 90, notes: null, ...o,
});
const program = (id: string, o: Partial<Program> = {}): Program => ({ id, name: id, totalWeeks: 4, ...o } as Program);
const workout = (programId: string, exercises: Exercise[], week = 1): Workout => ({ id: `${programId}-${week}`, programId, programName: programId, week, dayOfWeek: "Monday", exercises });

const definitions = { squat: def("squat"), bench: def("bench"), dead: def("dead"), kb: def("kb", { equipmentType: "kettlebell" }), old: def("old") };

describe("warmupPreviewLifts", () => {
  it("uses the program's weight and the day's reps, skipping warm-up rows and archived programs", () => {
    const lifts = warmupPreviewLifts(
      [program("a", { weights: { squat: { currentWeight: 185, hardStreak: 0 } } }), program("z", { archived: true })],
      [workout("a", [occ("squat", { phase: "warmup" }), occ("squat", { repMin: 8 }), occ("kb", { repMin: 15 })]), workout("z", [occ("old")])],
      definitions, DEFAULT_EQUIPMENT_CONFIG, [],
    );
    expect(lifts.map((l) => [l.exercise.name, l.exercise.currentWeight, l.exercise.repMin])).toEqual([["squat", 185, 8], ["kb", 100, 15]]);
    expect(lifts[0].equipment).toBe("Olympic bar (45 lb)");
  });

  it("shows at most two lifts per equipment group", () => {
    const lifts = warmupPreviewLifts([program("a")], [workout("a", [occ("squat"), occ("bench"), occ("dead")])], definitions, DEFAULT_EQUIPMENT_CONFIG, []);
    expect(lifts.map((l) => l.exercise.name)).toEqual(["squat", "bench"]);
  });
});
