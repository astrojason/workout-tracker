import { describe, expect, it } from "vitest";
import { groupSetsByOccurrence } from "../set-groups";
import type { CompletedSet } from "../types";

let id = 0;
function makeSet(overrides: Partial<CompletedSet>): CompletedSet {
  return {
    id: `s-${++id}`,
    exerciseName: "Landmine Squat",
    exerciseOrder: 1,
    setNumber: 1,
    targetWeight: 65,
    actualWeight: 65,
    targetReps: 10,
    actualReps: 10,
    completed: true,
    timestamp: new Date(),
    notes: null,
    ...overrides,
  };
}

describe("groupSetsByOccurrence", () => {
  it("splits a lift's warmup from its working sets using the recorded phase", () => {
    const groups = groupSetsByOccurrence([
      makeSet({ exerciseOrder: 1, phase: "warmup", actualWeight: 45 }),
      makeSet({ exerciseOrder: 2, phase: "main", setNumber: 1 }),
      makeSet({ exerciseOrder: 2, phase: "main", setNumber: 2 }),
    ]);
    expect(groups.map((g) => [g.name, g.sets.length])).toEqual([
      ["Landmine Squat (warmup)", 1],
      ["Landmine Squat", 2],
    ]);
  });

  it("labels the earlier occurrence as the warmup for sessions saved without a phase", () => {
    const groups = groupSetsByOccurrence([
      makeSet({ exerciseOrder: 1 }),
      makeSet({ exerciseOrder: 2 }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Landmine Squat (warmup)", "Landmine Squat"]);
  });

  it("keeps a single occurrence under its plain name, whatever its phase", () => {
    const groups = groupSetsByOccurrence([makeSet({ exerciseOrder: 1, phase: "warmup", exerciseName: "Cat Cow" })]);
    expect(groups.map((g) => g.name)).toEqual(["Cat Cow"]);
  });

  it("keeps the real exercise name for linking", () => {
    const [warmup] = groupSetsByOccurrence([
      makeSet({ exerciseOrder: 1, phase: "warmup" }),
      makeSet({ exerciseOrder: 2, phase: "main" }),
    ]);
    expect(warmup.exerciseName).toBe("Landmine Squat");
  });
});
