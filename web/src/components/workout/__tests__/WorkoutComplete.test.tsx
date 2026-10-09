import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkoutComplete } from "../WorkoutComplete";
import type { ActiveSession, CompletedSet, ResolvedExercise } from "@/lib/types";

function makeExercise(overrides: Partial<ResolvedExercise>): ResolvedExercise {
  return {
    id: "exercise-1",
    definitionId: "definition-1",
    order: 1,
    name: "Landmine Squat",
    muscleGroups: [],
    phase: "main",
    equipmentType: "barbell_45",
    equipmentDetail: null,
    progressionRule: "add_5lb",
    isUnilateral: false,
    isTimeBased: false,
    currentWeight: 65,
    hardStreak: 0,
    sets: 3,
    repMin: 8,
    repMax: { type: "count", value: 10 },
    restSeconds: 120,
    notes: null,
    ...overrides,
  };
}

let setId = 0;
function makeSet(overrides: Partial<CompletedSet>): CompletedSet {
  return {
    id: `set-${++setId}`,
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

function renderComplete(exercises: ResolvedExercise[], completedSets: CompletedSet[]) {
  const session: ActiveSession = {
    workout: { id: "w", programId: "p", programName: "Program", week: 1, dayOfWeek: "Thursday", exercises },
    resolvedWeights: {},
    currentExerciseIndex: exercises.length - 1,
    currentSetNumber: 1,
    completedSets,
    isResting: false,
    restTimeRemaining: 0,
    startTime: new Date(),
    prsAchieved: [],
  };
  render(<WorkoutComplete session={session} onDone={() => {}} />);
}

function summaryRow(label: string | RegExp) {
  return screen.getByTestId("summary").querySelector(`[data-label="${label}"]`) as HTMLElement;
}

describe("WorkoutComplete summary", () => {
  it("keeps a warmup separate from the working sets of the same lift", () => {
    renderComplete(
      [
        makeExercise({ id: "wu", order: 1, phase: "warmup", currentWeight: 45, sets: 1 }),
        makeExercise({ id: "main", order: 2, phase: "main", sets: 2 }),
      ],
      [
        makeSet({ exerciseOrder: 1, actualWeight: 45, targetWeight: 45 }),
        makeSet({ exerciseOrder: 2, setNumber: 1, actualReps: 10 }),
        makeSet({ exerciseOrder: 2, setNumber: 2, actualReps: 8 }),
      ],
    );

    expect(summaryRow("Landmine Squat (warmup)")).toHaveTextContent("@ 45 lbs");
    expect(summaryRow("Landmine Squat")).toHaveTextContent("2/2 [10, 8] @ 65 lbs");
  });

  it("shows the heaviest working weight when it changed between sets", () => {
    renderComplete(
      [makeExercise({ name: "Pushdowns", equipmentType: "pulley", currentWeight: 45 })],
      [
        makeSet({ exerciseName: "Pushdowns", setNumber: 1, actualWeight: 50 }),
        makeSet({ exerciseName: "Pushdowns", setNumber: 2, actualWeight: 45 }),
        makeSet({ exerciseName: "Pushdowns", setNumber: 3, actualWeight: 45 }),
      ],
    );

    expect(summaryRow("Pushdowns")).toHaveTextContent("@ 50 lbs");
  });

  it("says Skipped instead of a 0-rep set", () => {
    renderComplete(
      [makeExercise({ name: "Dead Bugs", equipmentType: "bodyweight", currentWeight: 0, sets: 1 })],
      [makeSet({ exerciseName: "Dead Bugs", actualWeight: 0, actualReps: 0, completed: false, notes: "Skipped", skipped: true })],
    );

    expect(summaryRow("Dead Bugs")).toHaveTextContent("Skipped");
    expect(summaryRow("Dead Bugs")).not.toHaveTextContent("0/1");
    const details = within(screen.getByTestId("set-details-Dead Bugs"));
    expect(details.getByText("Skipped")).toBeInTheDocument();
    expect(details.queryByText("BW")).toBeNull();
  });
});

describe("WorkoutComplete set details", () => {
  it("shows the band instead of BW", () => {
    renderComplete(
      [makeExercise({ name: "Face Pulls", equipmentType: "band", equipmentDetail: "Red", currentWeight: 0, sets: 1 })],
      [makeSet({ exerciseName: "Face Pulls", actualWeight: 0, equipmentType: "band", equipmentDetail: "Red" })],
    );

    const details = within(screen.getByTestId("set-details-Face Pulls"));
    expect(details.getByText("Red band")).toBeInTheDocument();
    expect(details.queryByText("BW")).toBeNull();
  });

  it("lists a timed hold under Time, not Reps", () => {
    renderComplete(
      [makeExercise({ name: "Plank", equipmentType: "bodyweight", isTimeBased: true, currentWeight: 0, sets: 1, repMin: 30, repMax: { type: "count", value: 75 } })],
      [makeSet({ exerciseName: "Plank", actualWeight: 0, actualReps: 75, isTimeBased: true })],
    );

    const details = within(screen.getByTestId("set-details-Plank"));
    expect(details.getByRole("columnheader", { name: "Time" })).toBeInTheDocument();
    expect(details.queryByRole("columnheader", { name: "Reps" })).toBeNull();
    expect(details.getByText("1:15")).toBeInTheDocument();
  });
});
