import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ProgramCard } from "../ProgramCard";
import type { Exercise, Program, Workout } from "@/lib/types";

const exercise: Exercise = {
  id: "ex-1",
  definitionId: "def-1",
  order: 1,
  phase: "main",
  sets: 3,
  repMin: 8,
  repMax: { type: "count", value: 12 },
  restSeconds: 90,
  notes: null,
};

const program: Program = {
  id: "program-1",
  name: "Test Program",
  totalWeeks: 4,
  createdAt: new Date(),
};

const todaysWorkout: Workout = {
  id: "workout-1",
  programId: "program-1",
  programName: "Test Program",
  week: 1,
  dayOfWeek: "Monday",
  exercises: [exercise],
};

function renderCard(overrides: {
  onStartWorkout?: (w: Workout) => boolean;
  onSelectDay?: (day: string) => boolean;
} = {}) {
  const onStartWorkout = overrides.onStartWorkout ?? vi.fn().mockReturnValue(true);
  const onSelectDay = overrides.onSelectDay ?? vi.fn().mockReturnValue(true);
  render(
    <ProgramCard
      program={program}
      week={1}
      todaysWorkout={todaysWorkout}
      availableDays={["Monday", "Wednesday"]}
      completedDays={new Set()}
      onStartWorkout={onStartWorkout}
      onSelectDay={onSelectDay}
    />
  );
  return { onStartWorkout, onSelectDay };
}

describe("ProgramCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("calls onStartWorkout only once when the Start button is double-clicked", () => {
    const { onStartWorkout } = renderCard();

    const button = screen.getByRole("button", { name: /start monday/i });
    fireEvent.click(button);
    fireEvent.click(button);

    act(() => {
      vi.runAllTimers();
    });

    expect(onStartWorkout).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state on the button immediately after clicking Start", () => {
    const { onStartWorkout } = renderCard();

    const button = screen.getByRole("button", { name: /start monday/i });
    fireEvent.click(button);

    // Loading state must be visible before the (possibly synchronous)
    // onStartWorkout call fires, otherwise the button never visibly reacted.
    expect(onStartWorkout).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("re-enables the button if starting the workout fails", () => {
    renderCard({ onStartWorkout: vi.fn().mockReturnValue(false) });

    const button = screen.getByRole("button", { name: /start monday/i });
    fireEvent.click(button);
    act(() => {
      vi.runAllTimers();
    });

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "false");
  });
});
