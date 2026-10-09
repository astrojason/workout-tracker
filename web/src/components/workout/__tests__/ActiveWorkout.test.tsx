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
