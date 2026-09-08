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
  onSkipDay?: (day: string) => void;
  completedDays?: Set<string>;
  skippedDays?: Set<string>;
} = {}) {
  const onStartWorkout = overrides.onStartWorkout ?? vi.fn().mockReturnValue(true);
  const onSelectDay = overrides.onSelectDay ?? vi.fn().mockReturnValue(true);
  const onSkipDay = overrides.onSkipDay ?? vi.fn();
  render(
    <ProgramCard
      program={program}
      week={1}
      todaysWorkout={todaysWorkout}
      availableDays={["Monday", "Wednesday"]}
      completedDays={overrides.completedDays ?? new Set()}
      skippedDays={overrides.skippedDays}
      onStartWorkout={onStartWorkout}
      onSelectDay={onSelectDay}
      onSkipDay={onSkipDay}
    />
  );
  return { onStartWorkout, onSelectDay, onSkipDay };
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

  it("calls onSkipDay when 'Mark today as skipped' is clicked", () => {
    const { onSkipDay } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: /mark today as skipped/i }));

    expect(onSkipDay).toHaveBeenCalledWith("Monday");
  });

  it("shows today's workout as skipped and hides the skip link once skipped", () => {
    renderCard({ skippedDays: new Set([new Date().toLocaleDateString("en-CA")]) });

    expect(screen.getByText(/today's workout skipped/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark today as skipped/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /today's workout skipped/i })).toBeDisabled();
  });

  it("a completed day takes priority over a skipped one for today's button", () => {
    const todayISO = new Date().toLocaleDateString("en-CA");
    renderCard({ completedDays: new Set([todayISO]), skippedDays: new Set([todayISO]) });

    expect(screen.getByText(/today's workout completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/today's workout skipped/i)).not.toBeInTheDocument();
  });

  it("shows a Skip button for a day not yet completed and calls onSkipDay when clicked", () => {
    const { onSkipDay } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: /choose different day/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "Skip" })[0]);

    expect(onSkipDay).toHaveBeenCalledWith("Monday");
  });

  it("shows a Skipped tag instead of a Skip button once a day is marked skipped", () => {
    // Mirrors ProgramCard's internal getThisWeekDates() so "Monday" maps to the
    // same ISO date the component computes for the current week.
    const today = new Date();
    const dayIdx = today.getDay();
    const mondayOffset = dayIdx === 0 ? -6 : 1 - dayIdx;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const mondayISO = monday.toLocaleDateString("en-CA");

    renderCard({ skippedDays: new Set([mondayISO]) });

    fireEvent.click(screen.getByRole("button", { name: /choose different day/i }));

    const mondayRow = screen.getByText("Monday").closest("button")!;
    expect(mondayRow).toHaveTextContent("Skipped");
    expect(screen.queryAllByRole("button", { name: "Skip" })).toHaveLength(1); // only Wednesday
  });
});
