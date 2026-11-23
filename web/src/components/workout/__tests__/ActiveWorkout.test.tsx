import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveWorkout } from "../ActiveWorkout";
import type { ActiveSession, ResolvedExercise } from "@/lib/types";

vi.mock("@/hooks/useSound", () => ({
  useSound: () => ({ playTimerComplete: vi.fn(), playSetComplete: vi.fn(), initAudio: vi.fn() }),
}));

const plank: ResolvedExercise = {
  id: "plank",
  definitionId: "def-plank",
  order: 1,
  name: "Plank",
  muscleGroups: [],
  phase: "main",
  equipmentType: "bodyweight",
  equipmentDetail: null,
  progressionRule: "add_time",
  isUnilateral: false,
  isTimeBased: true,
  currentWeight: 0,
  hardStreak: 0,
  sets: 1,
  repMin: 30,
  repMax: { type: "count", value: 75 },
  restSeconds: 60,
  notes: null,
};

function renderWorkout(onCompleteSet = vi.fn()) {
  const session: ActiveSession = {
    workout: { id: "w", programId: "p", programName: "Program", week: 1, dayOfWeek: "Thursday", exercises: [plank] },
    resolvedWeights: { plank: 0 },
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    completedSets: [],
    isResting: false,
    restTimeRemaining: 0,
    startTime: new Date(),
    prsAchieved: [],
  };
  render(
    <ActiveWorkout
      session={session}
      onCompleteSet={onCompleteSet}
      onSkipSet={vi.fn()}
      onSkipRest={vi.fn()}
      onEndWorkout={vi.fn()}
      onUpdateWeight={vi.fn()}
      onUpdateSets={vi.fn()}
      onInsertSet={vi.fn()}
      onDismiss={vi.fn()}
      onPause={vi.fn()}
    />,
  );
  return onCompleteSet;
}

function durationInput() {
  return screen.getByLabelText("Duration Completed") as HTMLInputElement;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("ActiveWorkout exercise timer", () => {
  // Regression: stopping a plank at ~5s filled in the 75s maximum.
  it("Done Early fills in the time actually held", () => {
    const onCompleteSet = renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: "Start Timer" }));
    for (let i = 0; i < 5; i++) act(() => { vi.advanceTimersByTime(1000); });

    fireEvent.click(screen.getByRole("button", { name: "Done Early" }));

    expect(durationInput().value).toBe("5");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onCompleteSet).toHaveBeenCalledWith(5, 0, false, "normal", undefined);
  });

  it("a timer that runs out fills in the time it ran for", () => {
    renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: "Start Timer" }));
    for (let i = 0; i < 30; i++) act(() => { vi.advanceTimersByTime(1000); });

    expect(durationInput().value).toBe("30");
  });
});

describe("adding a custom set mid-exercise", () => {
  const bench: ResolvedExercise = {
    ...plank, id: "bench", definitionId: "def-bench", name: "Bench Press", equipmentType: "barbell_45",
    progressionRule: "add_5lb", isTimeBased: false, currentWeight: 135, sets: 3, repMin: 8, repMax: { type: "count", value: 10 },
  };
  function session(overrides: Partial<ActiveSession> = {}): ActiveSession {
    return {
      workout: { id: "w", programId: "p", programName: "Program", week: 1, dayOfWeek: "Thursday", exercises: [bench] },
      resolvedWeights: { bench: 135 },
      currentExerciseIndex: 0, currentSetNumber: 2, completedSets: [], isResting: false, restTimeRemaining: 0,
      startTime: new Date(), prsAchieved: [], ...overrides,
    };
  }
  function renderBench(s: ActiveSession, onInsertSet = vi.fn(), onSkipSet = vi.fn()) {
    render(
      <ActiveWorkout session={s} onCompleteSet={vi.fn()} onSkipSet={onSkipSet} onSkipRest={vi.fn()} onEndWorkout={vi.fn()}
        onUpdateWeight={vi.fn()} onUpdateSets={vi.fn()} onInsertSet={onInsertSet} onDismiss={vi.fn()} onPause={vi.fn()} />,
    );
    return { onInsertSet, onSkipSet };
  }

  it("Add Set opens a dialog prefilled with the current set's reps and weight, and inserts what you enter", () => {
    const { onInsertSet } = renderBench(session());
    fireEvent.click(screen.getByRole("button", { name: "+ Add Set" }));
    const reps = screen.getByLabelText("Reps") as HTMLInputElement;
    const weight = screen.getByLabelText("Weight") as HTMLInputElement;
    expect(reps.value).toBe("10");
    expect(weight.value).toBe("135");
    fireEvent.change(reps, { target: { value: "5" } });
    fireEvent.change(weight, { target: { value: "115" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Set" }));
    expect(onInsertSet).toHaveBeenCalledWith(5, 115);
  });

  it("shows the custom set's own targets, labels it, and offers Remove instead of Skip", () => {
    const s = session({
      workout: { id: "w", programId: "p", programName: "Program", week: 1, dayOfWeek: "Thursday", exercises: [{ ...bench, sets: 4 }] },
      insertedSet: { exerciseId: "bench", reps: 5, weight: 115 },
    });
    const { onSkipSet } = renderBench(s);
    expect(screen.getByText("Custom set")).toBeInTheDocument();
    expect(screen.getByText(/Set 2 of 4/)).toBeInTheDocument();
    expect(document.body.textContent).toContain("115");
    expect(document.body.textContent).not.toContain("135");
    expect(screen.queryByRole("button", { name: "+ Add Set" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onSkipSet).toHaveBeenCalled();
  });
});
