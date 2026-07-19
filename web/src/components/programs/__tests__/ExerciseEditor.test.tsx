import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExerciseEditor } from "../ExerciseEditor";
import type { Exercise } from "@/lib/types";

// crypto.randomUUID is used to mint a new exercise id on save
vi.spyOn(crypto, "randomUUID").mockReturnValue("new-exercise-id" as `${string}-${string}-${string}-${string}-${string}`);

function selects(container: HTMLElement): HTMLSelectElement[] {
  return Array.from(container.querySelectorAll("select"));
}

function numberInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="number"]'));
}

// Toggle buttons (time-based, final-set AMRAP, unilateral) have no accessible text of
// their own, so they're located positionally among all buttons that aren't Cancel/Save/steppers.
function toggleButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button")).filter(
    (b) => !["Cancel", "Add", "Save", "-", "+"].includes(b.textContent ?? "")
  );
}

const existingExercise: Exercise = {
  id: "ex-1",
  order: 2,
  name: "Bench Press",
  phase: "main",
  equipmentType: "barbell_45",
  equipmentDetail: null,
  baseWeight: { type: "fixed", value: 135 },
  sets: 4,
  repMin: 6,
  repMax: { type: "count", value: 10 },
  restSeconds: 90,
  progressionRule: "add_5lb",
  isUnilateral: false,
  isTimeBased: false,
  notes: "Pause at bottom",
};

describe("ExerciseEditor", () => {
  let onSave: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSave = vi.fn();
    onCancel = vi.fn();
  });

  it("disables Save until a name is entered, then saves a new exercise with barbell defaults", () => {
    const { container } = render(
      <ExerciseEditor exercise={null} maxOrder={3} onSave={onSave} onCancel={onCancel} />
    );

    const saveButton = screen.getByRole("button", { name: "Add" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Squat" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as Exercise;
    expect(saved).toMatchObject({
      id: "new-exercise-id",
      order: 4,
      name: "Squat",
      phase: "main",
      equipmentType: "barbell_45",
      equipmentDetail: null,
      baseWeight: { type: "fixed", value: 45 },
      sets: 3,
      repMin: 8,
      repMax: { type: "count", value: 12 },
      restSeconds: 120,
      progressionRule: "none",
      isUnilateral: false,
      isTimeBased: false,
      notes: null,
    });
    void container;
  });

  it("pre-fills fields from an existing exercise and preserves its id and order on save", () => {
    const { container } = render(
      <ExerciseEditor exercise={existingExercise} maxOrder={9} onSave={onSave} onCancel={onCancel} />
    );

    expect(screen.getByDisplayValue("Bench Press")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as Exercise;
    expect(saved.id).toBe("ex-1");
    expect(saved.order).toBe(2);
    expect(saved.baseWeight).toEqual({ type: "fixed", value: 135 });
    expect(saved.progressionRule).toBe("add_5lb");
    void container;
  });

  it("resets the weight field to the new type's default when equipment type changes", () => {
    const { container } = render(
      <ExerciseEditor exercise={null} maxOrder={0} onSave={onSave} onCancel={onCancel} />
    );

    const equipmentSelect = selects(container)[1];
    fireEvent.change(equipmentSelect, { target: { value: "powerblock" } });

    const weightInput = numberInputs(container)[1];
    expect(weightInput.value).toBe("25");
  });

  it("shows an error and blocks Save when barbell weight is below the bar minimum", () => {
    const { container } = render(
      <ExerciseEditor exercise={null} maxOrder={0} onSave={onSave} onCancel={onCancel} />
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Squat" } });
    const weightInput = numberInputs(container)[1];
    fireEvent.change(weightInput, { target: { value: "20" } });
    fireEvent.blur(weightInput);

    expect(screen.getByText(/Minimum weight for this bar is 45 lbs/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("adjusts barbell weight to the nearest achievable plate combination and warns", () => {
    const { container } = render(
      <ExerciseEditor exercise={null} maxOrder={0} onSave={onSave} onCancel={onCancel} />
    );

    const weightInput = numberInputs(container)[1];
    // 100.3 lbs isn't reachable with any combination of the default plate set.
    fireEvent.change(weightInput, { target: { value: "100.3" } });
    fireEvent.blur(weightInput);

    expect(screen.getByText(/isn't possible with available plates/i)).toBeInTheDocument();
    expect(weightInput.value).not.toBe("100.3");
  });

  it("snaps PowerBlock weight to the nearest 2.5lb increment and warns when clamped", () => {
    const { container } = render(
      <ExerciseEditor exercise={null} maxOrder={0} onSave={onSave} onCancel={onCancel} />
    );

    fireEvent.change(selects(container)[1], { target: { value: "powerblock" } });
    const weightInput = numberInputs(container)[1];
    fireEvent.change(weightInput, { target: { value: "23" } });
    fireEvent.blur(weightInput);

    expect(weightInput.value).toBe("22.5");
    expect(screen.getByText(/Clamped to 22.5 lbs/i)).toBeInTheDocument();
  });

  it("saves the selected band color as equipmentDetail with zero base weight", () => {
    const { container } = render(
      <ExerciseEditor exercise={null} maxOrder={0} onSave={onSave} onCancel={onCancel} />
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Face Pull" } });
    fireEvent.change(selects(container)[1], { target: { value: "band" } });

    const bandSelect = selects(container)[2];
    fireEvent.change(bandSelect, { target: { value: "Blue" } });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const saved = onSave.mock.calls[0][0] as Exercise;
    expect(saved.equipmentType).toBe("band");
    expect(saved.equipmentDetail).toBe("Blue");
    expect(saved.baseWeight).toEqual({ type: "fixed", value: 0 });
  });

  it("sets repMax to failure when Final Set AMRAP is toggled on", () => {
    const { container } = render(
      <ExerciseEditor exercise={null} maxOrder={0} onSave={onSave} onCancel={onCancel} />
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Pull-Up" } });
    const [, amrapToggle] = toggleButtons(container);
    fireEvent.click(amrapToggle);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const saved = onSave.mock.calls[0][0] as Exercise;
    expect(saved.repMax).toEqual({ type: "failure" });
  });

  it("switches progression rule to add_time when Time Based is toggled on", () => {
    const { container } = render(
      <ExerciseEditor exercise={null} maxOrder={0} onSave={onSave} onCancel={onCancel} />
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Plank" } });
    const [timeBasedToggle] = toggleButtons(container);
    fireEvent.click(timeBasedToggle);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const saved = onSave.mock.calls[0][0] as Exercise;
    expect(saved.isTimeBased).toBe(true);
    expect(saved.progressionRule).toBe("add_time");
  });

  it("calls onCancel and does not save when Cancel is clicked", () => {
    render(<ExerciseEditor exercise={null} maxOrder={0} onSave={onSave} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
