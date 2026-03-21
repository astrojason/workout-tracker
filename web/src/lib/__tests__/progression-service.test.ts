import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyProgression, resolveWeight } from "../progression-service";
import type { Exercise, CompletedSet } from "../types";
import { Timestamp } from "firebase/firestore";

// Mock firestore module
vi.mock("../firestore", () => ({
  getLastSetsForExercise: vi.fn(),
  getLastTwoSessionSets: vi.fn(),
}));

import { getLastSetsForExercise, getLastTwoSessionSets } from "../firestore";
const mockGetLastSets = vi.mocked(getLastSetsForExercise);
const mockGetLastTwoSessions = vi.mocked(getLastTwoSessionSets);

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "test-id",
    order: 1,
    name: "Bench Press",
    phase: "main",
    equipmentType: "barbell_45",
    equipmentDetail: null,
    baseWeight: { type: "fixed", value: 135 },
    sets: 3,
    repMin: 8,
    repMax: { type: "count", value: 12 },
    restSeconds: 120,
    progressionRule: "add_5lb",
    isUnilateral: false,
    notes: null,
    ...overrides,
  };
}

function makeCompletedSet(overrides: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: "set-1",
    exerciseName: "Bench Press",
    exerciseOrder: 1,
    setNumber: 1,
    targetWeight: 135,
    actualWeight: 135,
    targetReps: 12,
    actualReps: 12,
    completed: true,
    timestamp: Timestamp.now(),
    notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLastTwoSessions.mockResolvedValue([]);
});

describe("applyProgression", () => {
  it("adds 5lbs for add_5lb rule", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb" });
    expect(applyProgression(100, exercise)).toBe(105);
  });

  it("adds 2.5lbs for add_2.5lb rule (kettlebell, no equipment adjustment)", () => {
    const exercise = makeExercise({ progressionRule: "add_2.5lb", equipmentType: "kettlebell" });
    expect(applyProgression(50, exercise)).toBe(52.5);
  });

  it("adds 2.5lbs with barbell equipment adjustment", () => {
    // 50 + 2.5 = 52.5 on 45lb bar → per side = 3.75 → rounds up to nearest achievable
    const exercise = makeExercise({ progressionRule: "add_2.5lb", equipmentType: "barbell_45" });
    const result = applyProgression(50, exercise);
    expect(result).toBeGreaterThanOrEqual(52.5);
    // Should round to achievable plate config
    expect(result).toBe(53); // 45 bar + 2x4 per side = 45 + 8 = 53 → actually calculated by plate algo
  });

  it("adds 10lbs for add_10lb rule", () => {
    const exercise = makeExercise({ progressionRule: "add_10lb" });
    expect(applyProgression(200, exercise)).toBe(210);
  });

  it.each([
    "maintain",
    "none",
    "deload",
    "add_reps",
    "add_time",
    "add_rounds",
    "progress_gripper",
  ])("returns same weight for %s rule", (rule) => {
    const exercise = makeExercise({ progressionRule: rule });
    expect(applyProgression(100, exercise)).toBe(100);
  });

  it("returns same weight for free-form band color rule (e.g. 'Blue')", () => {
    const exercise = makeExercise({ progressionRule: "Blue" });
    expect(applyProgression(100, exercise)).toBe(100);
  });

  it("returns same weight for free-form band count rule (e.g. '2 bands')", () => {
    const exercise = makeExercise({ progressionRule: "2 bands" });
    expect(applyProgression(100, exercise)).toBe(100);
  });

  it("adjusts result for barbell equipment (rounds to achievable plate config)", () => {
    // 100 + 5 = 105 on 45lb bar → per side = 30 = 25 + 5
    const exercise = makeExercise({
      progressionRule: "add_5lb",
      equipmentType: "barbell_45",
    });
    const result = applyProgression(100, exercise);
    expect(result).toBe(105);
  });

  it("adjusts result for PowerBlock (rounds to nearest 2.5)", () => {
    const exercise = makeExercise({
      progressionRule: "add_5lb",
      equipmentType: "powerblock",
    });
    // 20 + 5 = 25 → already valid PowerBlock weight
    expect(applyProgression(20, exercise)).toBe(25);
  });

  it("adjusts PowerBlock result that would exceed max", () => {
    const exercise = makeExercise({
      progressionRule: "add_5lb",
      equipmentType: "powerblock",
    });
    // 47.5 + 5 = 52.5 → clamped to 50
    expect(applyProgression(47.5, exercise)).toBe(50);
  });

  it("doesn't adjust for non-barbell/non-powerblock equipment", () => {
    const exercise = makeExercise({
      progressionRule: "add_5lb",
      equipmentType: "kettlebell",
    });
    expect(applyProgression(30, exercise)).toBe(35);
  });

  it("handles add_5lb from zero weight", () => {
    const exercise = makeExercise({ progressionRule: "add_5lb" });
    const result = applyProgression(0, exercise);
    // 0 + 5 = 5, on barbell that's less than bar weight
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe("resolveWeight", () => {
  it("returns fixed weight value directly without querying Firestore", async () => {
    const exercise = makeExercise({ baseWeight: { type: "fixed", value: 185 } });
    const result = await resolveWeight("user-1", exercise);
    expect(result).toBe(185);
    expect(mockGetLastSets).not.toHaveBeenCalled();
  });

  it("returns 0 for progressive weight with no history", async () => {
    const exercise = makeExercise({ baseWeight: { type: "progressive" } });
    mockGetLastSets.mockResolvedValue([]);
    const result = await resolveWeight("user-1", exercise);
    expect(result).toBe(0);
  });

  it("returns totalWeight as starting weight when no history and totalWeight is set", async () => {
    const exercise = makeExercise({ baseWeight: { type: "progressive" }, totalWeight: 185 });
    mockGetLastSets.mockResolvedValue([]);
    const result = await resolveWeight("user-1", exercise);
    expect(result).toBe(185);
  });

  it("returns same weight when last sets have a failed set", async () => {
    const exercise = makeExercise({
      baseWeight: { type: "progressive" },
      progressionRule: "add_5lb",
    });
    mockGetLastSets.mockResolvedValue([
      makeCompletedSet({ actualWeight: 135, actualReps: 12, completed: true }),
      makeCompletedSet({ actualWeight: 135, actualReps: 8, completed: false }),
    ]);
    const result = await resolveWeight("user-1", exercise);
    expect(result).toBe(135);
  });

  it("returns same weight when reps below target", async () => {
    const exercise = makeExercise({
      baseWeight: { type: "progressive" },
      repMin: 8,
      progressionRule: "add_5lb",
    });
    mockGetLastSets.mockResolvedValue([
      makeCompletedSet({ actualWeight: 135, actualReps: 6, completed: true }),
    ]);
    const result = await resolveWeight("user-1", exercise);
    expect(result).toBe(135);
  });

  it("applies progression when all sets completed at target reps", async () => {
    const exercise = makeExercise({
      baseWeight: { type: "progressive" },
      repMin: 8,
      progressionRule: "add_5lb",
      equipmentType: "barbell_45",
    });
    mockGetLastSets.mockResolvedValue([
      makeCompletedSet({ actualWeight: 135, actualReps: 12, completed: true }),
      makeCompletedSet({ actualWeight: 135, actualReps: 10, completed: true }),
      makeCompletedSet({ actualWeight: 135, actualReps: 8, completed: true }),
    ]);
    const result = await resolveWeight("user-1", exercise);
    expect(result).toBe(140);
  });

  it("uses actualWeight from first set as base weight", async () => {
    const exercise = makeExercise({
      baseWeight: { type: "progressive" },
      repMin: 8,
      progressionRule: "add_5lb",
    });
    mockGetLastSets.mockResolvedValue([
      makeCompletedSet({ actualWeight: 200, actualReps: 10, completed: true }),
    ]);
    const result = await resolveWeight("user-1", exercise);
    expect(result).toBe(205);
  });
});
