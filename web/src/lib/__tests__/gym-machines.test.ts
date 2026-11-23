import { describe, it, expect } from "vitest";
import { applyGymMachines, validateGymMachineInput, linkedExerciseCount } from "../gym-machines";
import { computeNextWeight } from "../progression-service";
import { resolveExercise, type CompletedSet, type Exercise, type ExerciseDefinition, type GymMachine } from "../types";

function def(id: string, overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id, name: id, muscleGroups: [], equipmentType: "machine", equipmentDetail: null, progressionRule: "add_weight",
    isUnilateral: false, isTimeBased: false, currentWeight: 40, hardStreak: 0, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}
function machine(id: string, name: string, plates: number[]): GymMachine {
  return { id, name, plates, createdAt: new Date(), updatedAt: new Date() };
}

describe("applyGymMachines", () => {
  const machines = [machine("m1", "Lat Pulldown", [10, 20, 30, 42.5])];

  it("gives a linked exercise its machine's weights, replacing its own", () => {
    const out = applyGymMachines({ a: def("a", { machineId: "m1", weightOptions: [5, 6] }) }, machines);
    expect(out.a.weightOptions).toEqual([10, 20, 30, 42.5]);
  });

  it("leaves unlinked exercises untouched (their own weightOptions are the fallback)", () => {
    const a = def("a", { weightOptions: [5, 6] });
    expect(applyGymMachines({ a }, machines).a).toBe(a);
  });

  it("falls back to the exercise's own weights when the machine no longer exists", () => {
    const a = def("a", { machineId: "gone", weightOptions: [5, 6] });
    expect(applyGymMachines({ a }, machines).a.weightOptions).toEqual([5, 6]);
  });

  it("does not mutate its input", () => {
    const a = def("a", { machineId: "m1" });
    const input = { a };
    applyGymMachines(input, machines);
    expect(input.a.weightOptions).toBeUndefined();
  });
});

describe("validateGymMachineInput", () => {
  const existing = [machine("m1", "Lat Pulldown", [10, 20])];

  it("accepts a name and weights, sorting and de-duplicating them", () => {
    expect(validateGymMachineInput("  Chest Press ", "30, 10 20 20", existing)).toEqual({
      ok: true, name: "Chest Press", plates: [10, 20, 30],
    });
  });

  it("requires a name", () => {
    expect(validateGymMachineInput("  ", "10, 20", existing)).toMatchObject({ ok: false, error: expect.stringMatching(/name/i) });
  });

  it("requires at least two valid weights", () => {
    expect(validateGymMachineInput("X", "10", existing)).toMatchObject({ ok: false, error: expect.stringMatching(/two weights/i) });
    expect(validateGymMachineInput("X", "abc", existing)).toMatchObject({ ok: false });
  });

  it("rejects a duplicate name case-insensitively, but not when editing that same machine", () => {
    expect(validateGymMachineInput("lat pulldown", "10, 20", existing)).toMatchObject({ ok: false, error: expect.stringMatching(/already/i) });
    expect(validateGymMachineInput("lat pulldown", "10, 20", existing, "m1")).toMatchObject({ ok: true });
  });
});

describe("linkedExerciseCount", () => {
  it("counts the library exercises linked to a machine", () => {
    const defs = { a: def("a", { machineId: "m1" }), b: def("b", { machineId: "m1" }), c: def("c", { machineId: "m2" }), d: def("d") };
    expect(linkedExerciseCount("m1", defs)).toBe(2);
    expect(linkedExerciseCount("zzz", defs)).toBe(0);
  });
});

describe("machine weights flow through to progression", () => {
  it("a linked exercise progresses to the next weight on its machine's stack", () => {
    const machines = [machine("m1", "Lat Pulldown", [70, 90, 100, 145])];
    const defs = applyGymMachines({ d: def("d", { machineId: "m1", currentWeight: 90 }) }, machines);
    const occurrence: Exercise = {
      id: "e1", definitionId: "d", order: 1, phase: "main", sets: 3, repMin: 8,
      repMax: { type: "count", value: 12 }, restSeconds: 90, notes: null,
    };
    const resolved = resolveExercise(occurrence, defs);
    const finalSet = {
      id: "s", exerciseName: "d", definitionId: "d", exerciseOrder: 1, setNumber: 3, targetWeight: 90, actualWeight: 90,
      targetReps: 12, actualReps: 12, completed: true, timestamp: new Date(), notes: null, rating: "easy",
    } as unknown as CompletedSet;
    expect(computeNextWeight(resolved, finalSet).currentWeight).toBe(100);
  });
});
