import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ErrorProvider } from "@/components/providers/ErrorProvider";
import type { ExerciseDefinition } from "@/lib/types";
import { DEFAULT_EQUIPMENT_CONFIG } from "@/lib/equipment-calculator";

// The exercise library opens straight on the exercise a link names (?edit=<definitionId>), so the
// Equipment and Exercises pages can send you to the exact exercise to fix.

const now = new Date();
const def = (id: string, name: string): ExerciseDefinition => ({
  id, name, muscleGroups: [], equipmentType: "dumbbell", equipmentDetail: null, progressionRule: "add_5lb",
  isUnilateral: false, isTimeBased: false, currentWeight: 30, hardStreak: 0, createdAt: now, updatedAt: now,
});

const { updateMeta } = vi.hoisted(() => ({ updateMeta: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/firebase", () => ({ db: {}, auth: {} }));
vi.mock("@/lib/firestore", () => ({ updateExerciseDefinitionMeta: updateMeta, updateExerciseDefinitionWeight: vi.fn() }));
vi.mock("@/hooks/useEquipmentConfig", () => ({
  useEquipmentConfig: () => ({
    config: { ...DEFAULT_EQUIPMENT_CONFIG, items: [{ id: "fitarc", name: "FitArc", kind: "plate_loaded", baseWeight: 5, sides: 1 }] },
    loading: false,
  }),
}));
vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
vi.mock("@/hooks/useExerciseDefinitions", () => ({
  useExerciseDefinitions: () => ({
    definitions: { arc: def("arc", "FlitArc Press"), row: def("row", "DB Row") },
    machines: [], loading: false, reload: vi.fn(),
  }),
}));

import ExerciseLibraryPage from "../page";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("exercise library deep link", () => {
  it("opens the editor for the exercise named in ?edit=", () => {
    window.history.pushState({}, "", "/settings/exercises?edit=arc");
    render(<ErrorProvider><ExerciseLibraryPage /></ErrorProvider>);
    expect(screen.getByDisplayValue("FlitArc Press")).toBeTruthy();
    expect(screen.queryByDisplayValue("DB Row")).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("opens no editor without ?edit=", () => {
    window.history.pushState({}, "", "/settings/exercises");
    render(<ErrorProvider><ExerciseLibraryPage /></ErrorProvider>);
    expect(screen.queryByDisplayValue("FlitArc Press")).toBeNull();
  });
});

describe("linking an exercise to your own equipment", () => {
  it("saves the chosen equipment item on the exercise", async () => {
    window.history.pushState({}, "", "/settings/exercises?edit=arc");
    render(<ErrorProvider><ExerciseLibraryPage /></ErrorProvider>);
    fireEvent.change(screen.getByLabelText("Equipment item"), { target: { value: "fitarc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateMeta).toHaveBeenCalledWith("u1", "arc", expect.objectContaining({ equipmentItemId: "fitarc" })));
  });

  it("clears the link when None is chosen", async () => {
    window.history.pushState({}, "", "/settings/exercises?edit=arc");
    render(<ErrorProvider><ExerciseLibraryPage /></ErrorProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateMeta).toHaveBeenCalledWith("u1", "arc", expect.objectContaining({ equipmentItemId: null })));
  });
});
