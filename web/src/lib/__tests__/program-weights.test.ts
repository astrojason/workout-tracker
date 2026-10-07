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
