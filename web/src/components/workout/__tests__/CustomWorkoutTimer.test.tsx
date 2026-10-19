import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ErrorProvider } from "@/components/providers/ErrorProvider";
import { CustomWorkout } from "../CustomWorkout";

function renderWorkout() {
  return render(
    <ErrorProvider>
      <CustomWorkout exerciseNames={["Bench Press"]} onFinish={async () => []} onClose={() => {}} />
    </ErrorProvider>
  );
}

function addSet(reps: string) {
  fireEvent.change(screen.getByLabelText("Exercise"), { target: { value: "Bench Press" } });
  fireEvent.change(screen.getByLabelText("Reps"), { target: { value: reps } });
  fireEvent.click(screen.getByRole("button", { name: "Add set" }));
}

describe("custom workout set timer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is hidden until the first set is added", () => {
    renderWorkout();
    expect(screen.queryByTestId("set-timer")).not.toBeInTheDocument();
  });

  it("counts up from the last added set", () => {
    renderWorkout();
    addSet("8");
    expect(screen.getByTestId("set-timer")).toHaveTextContent("0:00");
    act(() => { vi.advanceTimersByTime(65_000); });
    expect(screen.getByTestId("set-timer")).toHaveTextContent("1:05");
  });

  it("resets each time a set is added", () => {
    renderWorkout();
    addSet("8");
    act(() => { vi.advanceTimersByTime(90_000); });
    expect(screen.getByTestId("set-timer")).toHaveTextContent("1:30");
    addSet("6");
    expect(screen.getByTestId("set-timer")).toHaveTextContent("0:00");
  });

  it("does not block the form while running", () => {
    renderWorkout();
    addSet("8");
    expect(screen.getByLabelText("Reps")).toBeEnabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
