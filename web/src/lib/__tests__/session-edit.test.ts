import { describe, expect, it } from "vitest";
import type { CompletedSet } from "../types";
import { applyDrafts, countChanges, draftError, toDraft } from "../session-edit";

function set(overrides: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: "s1", exerciseName: "Back Squat", definitionId: "squat", exerciseOrder: 1, setNumber: 1,
    targetWeight: 225, actualWeight: 225, targetReps: 5, actualReps: 5, completed: true,
    timestamp: new Date(), notes: null, phase: "main", rating: "normal", ...overrides,
  };
}

describe("toDraft", () => {
  it("turns a logged set into editable text fields", () => {
    expect(toDraft(set())).toEqual({ id: "s1", weight: "225", reps: "5", rating: "normal", status: "done", notes: "" });
    expect(toDraft(set({ completed: false }))).toMatchObject({ status: "failed" });
    expect(toDraft(set({ completed: false, skipped: true, rating: undefined }))).toMatchObject({ status: "skipped", rating: "" });
  });
});

describe("draftError", () => {
  it("accepts a weight of 0 or more and whole reps", () => {
    expect(draftError(toDraft(set()))).toBeNull();
    expect(draftError({ ...toDraft(set()), weight: "0" })).toBeNull();
    expect(draftError({ ...toDraft(set()), weight: "abc" })).toBe("Weight must be a number of 0 or more");
    expect(draftError({ ...toDraft(set()), weight: "-5" })).toBe("Weight must be a number of 0 or more");
    expect(draftError({ ...toDraft(set()), reps: "5.5" })).toBe("Reps must be a whole number of 0 or more");
    expect(draftError({ ...toDraft(set()), reps: "" })).toBe("Reps must be a whole number of 0 or more");
  });
});

describe("applyDrafts", () => {
  it("writes edited values back onto the sets and drops removed ones", () => {
    const original = [set(), set({ id: "s2", setNumber: 2 }), set({ id: "s3", setNumber: 3 })];
    const drafts = original.map(toDraft);
    drafts[0] = { ...drafts[0], weight: "230", reps: "6", rating: "hard", notes: "Belt" };
    drafts[1] = { ...drafts[1], status: "skipped" };
    const result = applyDrafts(original, drafts, new Set(["s3"]));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ actualWeight: 230, actualReps: 6, rating: "hard", notes: "Belt", completed: true });
    expect(result[1]).toMatchObject({ completed: false, skipped: true });
  });

  it("clears a rating and empty notes instead of saving blanks", () => {
    const [result] = applyDrafts([set({ notes: "x" })], [{ ...toDraft(set({ notes: "x" })), rating: "", notes: "  " }], new Set());
    expect(result.rating).toBeUndefined();
    expect(result.notes).toBeNull();
  });

  it("refuses to apply an invalid draft", () => {
    expect(() => applyDrafts([set()], [{ ...toDraft(set()), weight: "abc" }], new Set())).toThrow(/Back Squat set 1: Weight must be/);
  });
});

describe("countChanges", () => {
  it("counts edited sets, removed sets and a changed duration", () => {
    const original = [set(), set({ id: "s2", setNumber: 2 })];
    const drafts = original.map(toDraft);
    expect(countChanges(original, drafts, new Set(), 50, 50)).toBe(0);
    drafts[0] = { ...drafts[0], weight: "230" };
    expect(countChanges(original, drafts, new Set(["s2"]), 50, 55)).toBe(3);
  });
});
