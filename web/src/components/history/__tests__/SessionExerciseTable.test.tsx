import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionExerciseTable } from "../SessionExerciseTable";
import type { CompletedSet } from "@/lib/types";

let id = 0;
function makeSet(overrides: Partial<CompletedSet>): CompletedSet {
  return {
    id: `set-${++id}`,
    exerciseName: "Landmine Squat",
    exerciseOrder: 1,
    setNumber: 1,
    targetWeight: 65,
    actualWeight: 65,
    targetReps: 10,
    actualReps: 10,
    completed: true,
    ...overrides,
  } as CompletedSet;
}

describe("SessionExerciseTable failed sets", () => {
  it("labels a failed set 'Failed', but not a completed or skipped one", () => {
    render(
      <SessionExerciseTable
        name="Landmine Squat"
        hasRatings={false}
        sets={[
          makeSet({ setNumber: 1 }),
          makeSet({ setNumber: 2, completed: false, actualReps: 4 }),
          makeSet({ setNumber: 3, completed: false, skipped: true, notes: "Skipped" }),
        ]}
      />,
    );
    expect(screen.getAllByText("Failed")).toHaveLength(1);
  });
});
