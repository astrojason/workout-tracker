import { describe, expect, it } from "vitest";
import { moveExercise } from "@/lib/reorder-exercises";
import type { Exercise } from "@/lib/types";

const ex = (id: string, order: number): Exercise => ({
  id, definitionId: id, order, phase: "main", sets: 3, repMin: 8,
  repMax: { type: "count", value: 10 }, restSeconds: 60, notes: null,
});

const ids = (list: Exercise[]) => list.map((e) => e.id);

describe("moveExercise", () => {
  it("moves an exercise up one place and renumbers from 1", () => {
    const result = moveExercise([ex("a", 1), ex("b", 2), ex("c", 3)], "c", "up");
    expect(ids(result)).toEqual(["a", "c", "b"]);
    expect(result.map((e) => e.order)).toEqual([1, 2, 3]);
  });

  it("moves an exercise down one place", () => {
    const result = moveExercise([ex("a", 1), ex("b", 2), ex("c", 3)], "a", "down");
    expect(ids(result)).toEqual(["b", "a", "c"]);
  });

  it("works from the stored order, not the array order, and closes gaps", () => {
    const result = moveExercise([ex("c", 9), ex("a", 2), ex("b", 5)], "b", "up");
    expect(ids(result)).toEqual(["b", "a", "c"]);
    expect(result.map((e) => e.order)).toEqual([1, 2, 3]);
  });

  it("throws when the move would go past either end", () => {
    expect(() => moveExercise([ex("a", 1), ex("b", 2)], "a", "up")).toThrow(/already first/);
    expect(() => moveExercise([ex("a", 1), ex("b", 2)], "b", "down")).toThrow(/already last/);
  });

  it("throws for an unknown exercise", () => {
    expect(() => moveExercise([ex("a", 1)], "zzz", "up")).toThrow(/not found/);
  });

  it("does not mutate the input", () => {
    const input = [ex("a", 1), ex("b", 2)];
    moveExercise(input, "b", "up");
    expect(input.map((e) => [e.id, e.order])).toEqual([["a", 1], ["b", 2]]);
  });
});
