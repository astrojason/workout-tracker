import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExerciseEditor, type ExerciseEditorResult } from "../ExerciseEditor";
import type { Exercise, ExerciseDefinition } from "@/lib/types";

// crypto.randomUUID is used to mint a new occurrence id on save
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

const benchDefinition: ExerciseDefinition = {
  id: "def-bench",
  name: "Bench Press",
  muscleGroups: ["chest"],
  equipmentType: "barbell_45",
  equipmentDetail: null,
  progressionRule: "add_5lb",
  isUnilateral: false,
  isTimeBased: false,
  currentWeight: 135,
  hardStreak: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const existingOccurrence: Exercise = {
  id: "ex-1",
  definitionId: "def-bench",
  order: 2,
  phase: "main",
  sets: 4,
  repMin: 6,
  repMax: { type: "count", value: 10 },
  restSeconds: 90,
  notes: "Pause at bottom",
};

describe("ExerciseEditor", () => {
  let onSave: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSave = vi.fn();
    onCancel = vi.fn();
  });

  // ── new exercise (creating a definition) ─────────────────────────────────

  describe("creating a new exercise", () => {
    it("disables Save until a name is entered, then saves with barbell defaults", () => {
      const { container } = render(
        <ExerciseEditor exercise={null} maxOrder={3} definitions={[]} onSave={onSave} onCancel={onCancel} />
      );

      const saveButton = screen.getByRole("button", { name: "Add" });
      expect(saveButton).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Squat" } });
      expect(saveButton).not.toBeDisabled();

      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledTimes(1);
      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      expect(result.kind).toBe("new");
      if (result.kind !== "new") throw new Error("expected kind 'new'");
      expect(result.definition).toMatchObject({
        name: "Squat",
        equipmentType: "barbell_45",
        equipmentDetail: null,
        progressionRule: "none",
        isUnilateral: false,
        isTimeBased: false,
        currentWeight: 45,
        hardStreak: 0,
      });
      expect(result.occurrence).toMatchObject({
        id: "new-exercise-id",
        order: 4,
        phase: "main",
        sets: 3,
        repMin: 8,
        repMax: { type: "count", value: 12 },
        restSeconds: 120,
        notes: null,
      });
    });

    it("resets the weight field to the new type's default when equipment type changes", () => {
      const { container } = render(
        <ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />
      );

      // select order: [Exercise picker, Phase, Equipment]
      const equipmentSelect = selects(container)[2];
      fireEvent.change(equipmentSelect, { target: { value: "powerblock" } });

      const weightInput = numberInputs(container)[1];
      expect(weightInput.value).toBe("25");
    });

    it("shows an error and blocks Save when barbell weight is below the bar minimum", () => {
      const { container } = render(
        <ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />
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
        <ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />
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
        <ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />
      );

      fireEvent.change(selects(container)[2], { target: { value: "powerblock" } });
      const weightInput = numberInputs(container)[1];
      fireEvent.change(weightInput, { target: { value: "23" } });
      fireEvent.blur(weightInput);

      expect(weightInput.value).toBe("22.5");
      expect(screen.getByText(/Clamped to 22.5 lbs/i)).toBeInTheDocument();
    });

    it("saves the selected band color as equipmentDetail with zero starting weight", () => {
      const { container } = render(
        <ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />
      );

      fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Face Pull" } });
      fireEvent.change(selects(container)[2], { target: { value: "band" } });

      const bandSelect = selects(container)[3];
      fireEvent.change(bandSelect, { target: { value: "Blue" } });

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      if (result.kind !== "new") throw new Error("expected kind 'new'");
      expect(result.definition.equipmentType).toBe("band");
      expect(result.definition.equipmentDetail).toBe("Blue");
      expect(result.definition.currentWeight).toBe(0);
    });

    it("sets repMax to failure when Final Set AMRAP is toggled on", () => {
      const { container } = render(
        <ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />
      );

      fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Pull-Up" } });
      const [, amrapToggle] = toggleButtons(container);
      fireEvent.click(amrapToggle);

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      if (result.kind !== "new") throw new Error("expected kind 'new'");
      expect(result.occurrence.repMax).toEqual({ type: "failure" });
    });

    it("switches progression rule to add_time when Time Based is toggled on", () => {
      const { container } = render(
        <ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />
      );

      fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Plank" } });
      const [timeBasedToggle] = toggleButtons(container);
      fireEvent.click(timeBasedToggle);

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      if (result.kind !== "new") throw new Error("expected kind 'new'");
      expect(result.definition.isTimeBased).toBe(true);
      expect(result.definition.progressionRule).toBe("add_time");
    });

    it("calls onCancel and does not save when Cancel is clicked", () => {
      render(<ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSave).not.toHaveBeenCalled();
    });

    it("sets occurrence.restAfter to false when Skip Rest Before Next Exercise is toggled on", () => {
      const { container } = render(
        <ExerciseEditor exercise={null} maxOrder={0} definitions={[]} onSave={onSave} onCancel={onCancel} />
      );

      fireEvent.change(screen.getByPlaceholderText("e.g. Bench Press"), { target: { value: "Face Pulls" } });
      // Toggle order when creating new: Time Based, Final Set AMRAP, Skip Rest Before Next Exercise, Unilateral
      const [, , skipRestToggle] = toggleButtons(container);
      fireEvent.click(skipRestToggle);

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      if (result.kind !== "new") throw new Error("expected kind 'new'");
      expect(result.occurrence.restAfter).toBe(false);
    });
  });

  // ── editing an occurrence of an existing definition ──────────────────────

  describe("editing an occurrence of an existing exercise", () => {
    it("pre-fills the picker and weight from the definition, and preserves the occurrence id/order on save", () => {
      const { container } = render(
        <ExerciseEditor
          exercise={existingOccurrence}
          maxOrder={9}
          definitions={[benchDefinition]}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      const weightInput = numberInputs(container)[1];
      expect(weightInput.value).toBe("135");

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(onSave).toHaveBeenCalledTimes(1);
      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      expect(result.kind).toBe("existing");
      if (result.kind !== "existing") throw new Error("expected kind 'existing'");
      expect(result.definitionId).toBe("def-bench");
      expect(result.occurrence.id).toBe("ex-1");
      expect(result.occurrence.order).toBe(2);
      expect(result.weight).toBe(135);
    });

    it("does not show metadata fields (equipment/progression) for an existing definition", () => {
      render(
        <ExerciseEditor
          exercise={existingOccurrence}
          maxOrder={9}
          definitions={[benchDefinition]}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      // Definition metadata is shown read-only, not as editable equipment/progression selects
      expect(screen.getByText(/barbell 45.*add 5lb/i)).toBeInTheDocument();
      expect(screen.getByText("Edit in Exercise Library →")).toBeInTheDocument();
    });

    it("editing the weight field produces a kind 'existing' result carrying the new shared weight", () => {
      const { container } = render(
        <ExerciseEditor
          exercise={existingOccurrence}
          maxOrder={9}
          definitions={[benchDefinition]}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      const weightInput = numberInputs(container)[1];
      fireEvent.change(weightInput, { target: { value: "140" } });
      fireEvent.blur(weightInput);

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      if (result.kind !== "existing") throw new Error("expected kind 'existing'");
      expect(result.weight).toBe(140);
    });

    it("switching the picker to '+ New Exercise' reveals the name and metadata fields again", () => {
      const { container } = render(
        <ExerciseEditor
          exercise={existingOccurrence}
          maxOrder={9}
          definitions={[benchDefinition]}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      const picker = selects(container)[0];
      fireEvent.change(picker, { target: { value: "__new__" } });

      expect(screen.getByPlaceholderText("e.g. Bench Press")).toBeInTheDocument();
    });

    it("pre-checks Skip Rest Before Next Exercise when the occurrence has restAfter:false, and preserves it untouched", () => {
      const noRestOccurrence: Exercise = { ...existingOccurrence, restAfter: false };
      render(
        <ExerciseEditor
          exercise={noRestOccurrence}
          maxOrder={9}
          definitions={[benchDefinition]}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      // Save without touching the toggle — the pre-checked state should round-trip.
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      if (result.kind !== "existing") throw new Error("expected kind 'existing'");
      expect(result.occurrence.restAfter).toBe(false);
    });

    it("clearing Skip Rest Before Next Exercise on a restAfter:false occurrence restores normal rest", () => {
      const noRestOccurrence: Exercise = { ...existingOccurrence, restAfter: false };
      const { container } = render(
        <ExerciseEditor
          exercise={noRestOccurrence}
          maxOrder={9}
          definitions={[benchDefinition]}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      // Toggle order when editing an existing definition (Time Based/Unilateral
      // are new-exercise-only): Final Set AMRAP, Skip Rest Before Next Exercise.
      const [, skipRestToggle] = toggleButtons(container);
      fireEvent.click(skipRestToggle);

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      const result = onSave.mock.calls[0][0] as ExerciseEditorResult;
      if (result.kind !== "existing") throw new Error("expected kind 'existing'");
      expect(result.occurrence.restAfter).toBeUndefined();
    });
  });
});
