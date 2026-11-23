import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDefs, updateMeta, createDef } = vi.hoisted(() => ({
  getDefs: vi.fn(),
  updateMeta: vi.fn().mockResolvedValue(undefined),
  createDef: vi.fn(),
}));

vi.mock("../firestore", () => ({
  getExerciseDefinitions: getDefs,
  updateExerciseDefinitionMeta: updateMeta,
  createExerciseDefinition: createDef,
}));

import { resolveExerciseDefinitions, ImportCancelledError, type ParsedWorkout, type ParsedExercise } from "../exercise-import";
import type { ExerciseDefinition } from "../types";

function pe(name: string, overrides: Partial<ParsedExercise> = {}): ParsedExercise {
  return {
    order: 1, name, phase: "main", equipmentType: "barbell_45", equipmentDetail: null, sets: 3, repMin: 8,
    repMax: { type: "count", value: 10 }, restSeconds: 90, progressionRule: "add_5lb", isUnilateral: false,
    isTimeBased: false, notes: null, ...overrides,
  };
}
function pw(exercises: ParsedExercise[], day = "Monday"): ParsedWorkout {
  return { id: `p_1_${day}`, programId: "p", programName: "P", week: 1, dayOfWeek: day, exercises };
}
function def(id: string, name: string): ExerciseDefinition {
  return {
    id, name, muscleGroups: [], equipmentType: "powerblock", equipmentDetail: null, progressionRule: "none",
    isUnilateral: false, isTimeBased: false, currentWeight: 20, hardStreak: 0, createdAt: new Date(), updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDefs.mockResolvedValue([def("d-curl", "Dumbbell Curl"), def("d-bench", "Bench Press")]);
  let n = 0;
  createDef.mockImplementation(async () => `new-${++n}`);
});

describe("resolveExerciseDefinitions - unmatched exercises", () => {
  it("asks once per unmatched exercise, in order, and never for matches or repeats", async () => {
    const onUnmatched = vi.fn().mockResolvedValue({ action: "create" });
    await resolveExerciseDefinitions("u", [
      pw([pe("Bench Press"), pe("Hammer Curls", { order: 2 }), pe("Zottman Curls", { order: 3 })]),
      pw([pe("hammer curls")], "Tuesday"),
    ], { onUnmatched });

    expect(onUnmatched).toHaveBeenCalledTimes(2);
    expect(onUnmatched.mock.calls[0][0]).toMatchObject({ exercise: { name: "Hammer Curls" }, index: 1, total: 2 });
    expect(onUnmatched.mock.calls[1][0]).toMatchObject({ exercise: { name: "Zottman Curls" }, index: 2, total: 2 });
    expect(onUnmatched.mock.calls[0][0].candidates.map((c: ExerciseDefinition) => c.id)).toEqual(["d-curl", "d-bench"]);
  });

  it("waits for each answer before asking the next question", async () => {
    const order: string[] = [];
    const onUnmatched = vi.fn(async (req: { exercise: ParsedExercise }) => {
      order.push(`ask ${req.exercise.name}`);
      await Promise.resolve();
      order.push(`answer ${req.exercise.name}`);
      return { action: "create" as const };
    });
    await resolveExerciseDefinitions("u", [pw([pe("A"), pe("B", { order: 2 })])], { onUnmatched });
    expect(order).toEqual(["ask A", "answer A", "ask B", "answer B"]);
  });

  it("links to the chosen library exercise without renaming it or creating a duplicate", async () => {
    const onUnmatched = vi.fn().mockResolvedValue({ action: "use", definitionId: "d-curl" });
    const r = await resolveExerciseDefinitions("u", [pw([pe("Hammer Curls", { seedWeight: 15 })])], { onUnmatched });

    expect(createDef).not.toHaveBeenCalled();
    expect(updateMeta).not.toHaveBeenCalled();
    expect(r.workouts[0].exercises[0].definitionId).toBe("d-curl");
    expect(r.weights["d-curl"]).toMatchObject({ currentWeight: 15 });
  });

  it("creates a new definition when asked to", async () => {
    const onUnmatched = vi.fn().mockResolvedValue({ action: "create" });
    const r = await resolveExerciseDefinitions("u", [pw([pe("Hammer Curls")])], { onUnmatched });
    expect(createDef).toHaveBeenCalledTimes(1);
    expect(r.workouts[0].exercises[0].definitionId).toBe("new-1");
  });

  it("writes nothing and throws ImportCancelledError when the user cancels", async () => {
    const onUnmatched = vi.fn()
      .mockResolvedValueOnce({ action: "create" })
      .mockResolvedValueOnce({ action: "cancel" });
    await expect(
      resolveExerciseDefinitions("u", [pw([pe("A"), pe("B", { order: 2 })])], { onUnmatched }),
    ).rejects.toBeInstanceOf(ImportCancelledError);
    expect(createDef).not.toHaveBeenCalled();
    expect(updateMeta).not.toHaveBeenCalled();
  });

  it("rejects a choice that is not in the library", async () => {
    const onUnmatched = vi.fn().mockResolvedValue({ action: "use", definitionId: "nope" });
    await expect(resolveExerciseDefinitions("u", [pw([pe("A")])], { onUnmatched })).rejects.toThrow(/nope/);
  });

  it("without a callback, unmatched exercises are still created (unchanged behaviour)", async () => {
    await resolveExerciseDefinitions("u", [pw([pe("Hammer Curls")])]);
    expect(createDef).toHaveBeenCalledTimes(1);
  });
});
