import { describe, it, expect, vi, beforeEach } from "vitest";

const { getExerciseDefinitionsMock, updateExerciseDefinitionMetaMock, createExerciseDefinitionMock } = vi.hoisted(() => ({
  getExerciseDefinitionsMock: vi.fn(),
  updateExerciseDefinitionMetaMock: vi.fn().mockResolvedValue(undefined),
  createExerciseDefinitionMock: vi.fn(),
}));

vi.mock("../firestore", () => ({
  getExerciseDefinitions: getExerciseDefinitionsMock,
  updateExerciseDefinitionMeta: updateExerciseDefinitionMetaMock,
  createExerciseDefinition: createExerciseDefinitionMock,
}));

import { resolveExerciseDefinitions, type ParsedWorkout, type ParsedExercise } from "../xlsx-parser";
import type { ExerciseDefinition } from "../types";

function makeParsedExercise(overrides: Partial<ParsedExercise> = {}): ParsedExercise {
  return {
    order: 1,
    name: "Bench Press",
    phase: "main",
    equipmentType: "barbell_45",
    equipmentDetail: null,
    sets: 3,
    repMin: 8,
    repMax: { type: "count", value: 12 },
    restSeconds: 120,
    progressionRule: "add_5lb",
    isUnilateral: false,
    isTimeBased: false,
    notes: null,
    ...overrides,
  };
}

function makeParsedWorkout(exercises: ParsedExercise[], overrides: Partial<ParsedWorkout> = {}): ParsedWorkout {
  return {
    id: "prog_1_monday",
    programId: "prog",
    programName: "Test Program",
    week: 1,
    dayOfWeek: "Monday",
    exercises,
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id: "def-existing",
    name: "Bench Press",
    muscleGroups: ["chest"],
    equipmentType: "barbell_45",
    equipmentDetail: null,
    progressionRule: "add_5lb",
    isUnilateral: false,
    isTimeBased: false,
    currentWeight: 175,
    hardStreak: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveExerciseDefinitions — new exercise", () => {
  it("creates a definition seeded from Total Weight when no existing match", async () => {
    getExerciseDefinitionsMock.mockResolvedValue([]);
    createExerciseDefinitionMock.mockResolvedValue("new-def-id");

    const workouts = await resolveExerciseDefinitions("user-1", [
      makeParsedWorkout([makeParsedExercise({ name: "Squat", seedWeight: 225 })]),
    ]);

    expect(createExerciseDefinitionMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "Squat", currentWeight: 225, hardStreak: 0 })
    );
    expect(workouts[0].exercises[0].definitionId).toBe("new-def-id");
  });

  it("seeds currentWeight at 0 when no Total Weight is present", async () => {
    getExerciseDefinitionsMock.mockResolvedValue([]);
    createExerciseDefinitionMock.mockResolvedValue("new-def-id");

    await resolveExerciseDefinitions("user-1", [makeParsedWorkout([makeParsedExercise({ name: "Plank" })])]);

    expect(createExerciseDefinitionMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ currentWeight: 0 })
    );
  });

  it("the occurrence carries no name/equipment/progression fields of its own", async () => {
    getExerciseDefinitionsMock.mockResolvedValue([]);
    createExerciseDefinitionMock.mockResolvedValue("new-def-id");

    const workouts = await resolveExerciseDefinitions("user-1", [
      makeParsedWorkout([makeParsedExercise({ name: "Squat" })]),
    ]);

    expect(workouts[0].exercises[0]).not.toHaveProperty("name");
    expect(workouts[0].exercises[0]).not.toHaveProperty("equipmentType");
    expect(workouts[0].exercises[0]).not.toHaveProperty("progressionRule");
  });
});

describe("resolveExerciseDefinitions — existing exercise match", () => {
  it("matches case-insensitively/trimmed and reuses the existing definition id", async () => {
    getExerciseDefinitionsMock.mockResolvedValue([makeDefinition({ id: "def-existing", name: "Bench Press" })]);

    const workouts = await resolveExerciseDefinitions("user-1", [
      makeParsedWorkout([makeParsedExercise({ name: "  bench press  " })]),
    ]);

    expect(createExerciseDefinitionMock).not.toHaveBeenCalled();
    expect(workouts[0].exercises[0].definitionId).toBe("def-existing");
  });

  it("updates metadata on match but never touches currentWeight/hardStreak", async () => {
    getExerciseDefinitionsMock.mockResolvedValue([makeDefinition({ id: "def-existing", currentWeight: 175, hardStreak: 2 })]);

    await resolveExerciseDefinitions("user-1", [
      makeParsedWorkout([makeParsedExercise({ name: "Bench Press", equipmentType: "barbell_35", seedWeight: 100 })]),
    ]);

    expect(updateExerciseDefinitionMetaMock).toHaveBeenCalledWith(
      "user-1",
      "def-existing",
      expect.objectContaining({ equipmentType: "barbell_35" })
    );
    const metaArg = updateExerciseDefinitionMetaMock.mock.calls[0][2];
    expect(metaArg).not.toHaveProperty("currentWeight");
    expect(metaArg).not.toHaveProperty("hardStreak");
  });

  it("re-importing the same program twice never creates a duplicate definition", async () => {
    getExerciseDefinitionsMock.mockResolvedValue([makeDefinition({ id: "def-existing", name: "Bench Press" })]);

    await resolveExerciseDefinitions("user-1", [makeParsedWorkout([makeParsedExercise({ name: "Bench Press" })])]);
    await resolveExerciseDefinitions("user-1", [makeParsedWorkout([makeParsedExercise({ name: "Bench Press" })])]);

    expect(createExerciseDefinitionMock).not.toHaveBeenCalled();
  });
});

describe("resolveExerciseDefinitions — same-name exercise across multiple days", () => {
  it("resolves to the SAME definitionId for every occurrence within one import (the Monday/Thursday sync fix)", async () => {
    getExerciseDefinitionsMock.mockResolvedValue([]);
    createExerciseDefinitionMock.mockResolvedValue("shared-def-id");

    const workouts = await resolveExerciseDefinitions("user-1", [
      makeParsedWorkout([makeParsedExercise({ name: "Bench Press" })], { dayOfWeek: "Monday", id: "w-mon" }),
      makeParsedWorkout([makeParsedExercise({ name: "Bench Press" })], { dayOfWeek: "Thursday", id: "w-thu" }),
    ]);

    expect(createExerciseDefinitionMock).toHaveBeenCalledTimes(1); // not once per occurrence
    expect(workouts[0].exercises[0].definitionId).toBe("shared-def-id");
    expect(workouts[1].exercises[0].definitionId).toBe("shared-def-id");
  });
});
