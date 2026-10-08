import { describe, expect, it, vi } from "vitest";

vi.mock("../firestore", () => ({}));
import { scopeDefinitions } from "../types";
import { pickSeedWeights } from "../exercise-import";
import type { ExerciseDefinition, Program } from "../types";
import type { ParsedExercise, ParsedWorkout } from "../exercise-import";

const def = (id: string, currentWeight: number, hardStreak = 0): ExerciseDefinition => ({
  id, name: id, muscleGroups: [], equipmentType: "barbell_45", equipmentDetail: null,
  progressionRule: "none", isUnilateral: false, isTimeBased: false, currentWeight, hardStreak,
  createdAt: new Date(), updatedAt: new Date(),
});

describe("scopeDefinitions", () => {
  const defs = { row: def("row", 5, 1), curl: def("curl", 30) };

  it("uses the program's weight and streak where it has them, the library's otherwise", () => {
    const program = { id: "p", weights: { row: { currentWeight: 75, hardStreak: 0 } } } as unknown as Program;
    const scoped = scopeDefinitions(defs, program);
    expect(scoped.row.currentWeight).toBe(75);
    expect(scoped.row.hardStreak).toBe(0);
    expect(scoped.curl.currentWeight).toBe(30);
  });

  it("does not mutate the library or fail without a program", () => {
    const program = { id: "p", weights: { row: { currentWeight: 75, hardStreak: 0 } } } as unknown as Program;
    scopeDefinitions(defs, program);
    expect(defs.row.currentWeight).toBe(5);
    expect(scopeDefinitions(defs, undefined)).toEqual(defs);
  });
});

describe("pickSeedWeights", () => {
  const ex = (name: string, seedWeight: number | undefined, phase: ParsedExercise["phase"] = "main"): ParsedExercise => ({
    order: 1, name, phase, equipmentType: "barbell_45", equipmentDetail: null, sets: 3, repMin: 8,
    repMax: { type: "count", value: 10 }, restSeconds: 90, progressionRule: "none", isUnilateral: false,
    isTimeBased: false, notes: null, ...(seedWeight !== undefined ? { seedWeight } : {}),
  });
  const wk = (week: number, exercises: ParsedExercise[]): ParsedWorkout => ({
    id: `w${week}`, programId: "p", programName: "P", week, dayOfWeek: "Tuesday", exercises,
  });

  it("prefers the working set over a warm-up row of the same exercise", () => {
    const seeds = pickSeedWeights([wk(1, [ex("Flat Bench Press", 45, "warmup"), ex("Flat Bench Press", 135)])]);
    expect(seeds.get("flat bench press")).toBe(135);
  });

  it("uses the earliest week, matching names case-insensitively", () => {
    const seeds = pickSeedWeights([wk(2, [ex("Barbell Row", 80)]), wk(1, [ex("barbell row ", 75)])]);
    expect(seeds.get("barbell row")).toBe(75);
  });

  it("skips exercises with no weight", () => {
    expect(pickSeedWeights([wk(1, [ex("Dips", undefined)])]).size).toBe(0);
  });
});

describe("resolveExerciseDefinitions weights", () => {
  it("returns the sheet's weight per definition id, whether the exercise is new or existing", async () => {
    const { resolveExerciseDefinitions } = await import("../exercise-import");
    const firestore = await import("../firestore") as unknown as Record<string, ReturnType<typeof vi.fn>>;
    firestore.getExerciseDefinitions = vi.fn().mockResolvedValue([def("existing-id", 5)]);
    firestore.updateExerciseDefinitionMeta = vi.fn().mockResolvedValue(undefined);
    firestore.createExerciseDefinition = vi.fn().mockResolvedValue("new-id");

    const mk = (name: string, seedWeight: number): ParsedExercise => ({
      order: 1, name, phase: "main", equipmentType: "barbell_45", equipmentDetail: null, sets: 3, repMin: 8,
      repMax: { type: "count", value: 10 }, restSeconds: 90, progressionRule: "none", isUnilateral: false,
      isTimeBased: false, notes: null, seedWeight,
    });
    const { weights } = await resolveExerciseDefinitions("u", [{
      id: "w", programId: "p", programName: "P", week: 1, dayOfWeek: "Wednesday",
      exercises: [mk("existing-id", 75), mk("Brand New", 40)],
    }]);

    expect(weights).toEqual({
      "existing-id": { currentWeight: 75, hardStreak: 0 },
      "new-id": { currentWeight: 40, hardStreak: 0 },
    });
  });
});

describe("per-row weight and band", () => {
  const mk = (name: string, seedWeight: number | undefined, phase: ParsedExercise["phase"], equipmentDetail: string | null = null): ParsedExercise => ({
    order: 1, name, phase, equipmentType: "barbell_45", equipmentDetail, sets: 3, repMin: 8,
    repMax: { type: "count", value: 10 }, restSeconds: 90, progressionRule: "none", isUnilateral: false,
    isTimeBased: false, notes: null, ...(seedWeight !== undefined ? { seedWeight } : {}),
  });

  it("keeps each sheet row's own weight and band on its occurrence", async () => {
    const { resolveExerciseDefinitions } = await import("../exercise-import");
    const firestore = await import("../firestore") as unknown as Record<string, ReturnType<typeof vi.fn>>;
    firestore.getExerciseDefinitions = vi.fn().mockResolvedValue([]);
    firestore.updateExerciseDefinitionMeta = vi.fn().mockResolvedValue(undefined);
    firestore.createExerciseDefinition = vi.fn().mockResolvedValue("def");

    const wk = (week: number, exercises: ParsedExercise[]): ParsedWorkout => ({
      id: `w${week}`, programId: "p", programName: "P", week, dayOfWeek: "Tuesday", exercises,
    });
    const { workouts } = await resolveExerciseDefinitions("u", [
      wk(1, [mk("Flat Bench Press", 45, "warmup"), mk("Flat Bench Press", 135, "main"), mk("Pull-Aparts", undefined, "main", "Orange")]),
      wk(2, [mk("Flat Bench Press", 140, "main"), mk("Pull-Aparts", undefined, "main", "Purple")]),
    ]);

    expect(workouts[0].exercises.map((e) => e.weight)).toEqual([45, 135, undefined]);
    expect(workouts[1].exercises[0].weight).toBe(140);
    expect(workouts[0].exercises[2].equipmentDetail).toBe("Orange");
    expect(workouts[1].exercises[1].equipmentDetail).toBe("Purple");
    // Firestore rejects undefined fields, so absent overrides must be omitted entirely.
    expect("weight" in workouts[0].exercises[2]).toBe(false);
    expect("equipmentDetail" in workouts[0].exercises[0]).toBe(false);
  });
});

describe("resolveExercise row overrides", () => {
  it("prefers the row's weight and band over the shared definition", async () => {
    const { resolveExercise } = await import("../types");
    const d = { ...def("d", 45), equipmentDetail: "Orange" };
    const base = { id: "e", definitionId: "d", order: 1, phase: "main", sets: 3, repMin: 8, repMax: { type: "count", value: 10 }, restSeconds: 60, notes: null } as const;
    expect(resolveExercise({ ...base, weight: 135, equipmentDetail: "Purple" }, { d })).toMatchObject({ currentWeight: 135, equipmentDetail: "Purple" });
    expect(resolveExercise({ ...base }, { d })).toMatchObject({ currentWeight: 45, equipmentDetail: "Orange" });
  });
});
