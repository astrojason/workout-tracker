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

const { updateMeta, replace, desktop } = vi.hoisted(() => ({
  updateMeta: vi.fn().mockResolvedValue(undefined), replace: vi.fn(), desktop: { value: false },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => desktop.value }));
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
  desktop.value = false;
  replace.mockClear();
});

describe("on desktop", () => {
  it("sends you to the Exercises page's editor, keeping ?edit=", () => {
    desktop.value = true;
    window.history.pushState({}, "", "/settings/exercises?edit=arc");
    render(<ErrorProvider><ExerciseLibraryPage /></ErrorProvider>);
    expect(replace).toHaveBeenCalledWith("/exercises?edit=arc");
    expect(screen.queryByDisplayValue("FlitArc Press")).toBeNull();
  });
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
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "item:fitarc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateMeta).toHaveBeenCalledWith("u1", "arc", expect.objectContaining({ equipmentItemId: "fitarc", equipmentType: "machine" })));
  });

  it("saves no item for built-in equipment", async () => {
    window.history.pushState({}, "", "/settings/exercises?edit=arc");
    render(<ErrorProvider><ExerciseLibraryPage /></ErrorProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateMeta).toHaveBeenCalledWith("u1", "arc", expect.objectContaining({ equipmentItemId: null })));
  });
});

describe("an exercise's warm-up", () => {
  it("can be set to no warm-up, and back to following its equipment's rule", async () => {
    window.history.pushState({}, "", "/settings/exercises?edit=arc");
    render(<ErrorProvider><ExerciseLibraryPage /></ErrorProvider>);
    expect(screen.getByLabelText("Warm-up")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Warm-up"), { target: { value: "none" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateMeta).toHaveBeenCalledWith("u1", "arc", expect.objectContaining({ warmup: "none" })));
  });
});
