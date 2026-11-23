import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import * as XLSX from "xlsx";
import { usePrograms } from "../usePrograms";
import type { Program } from "@/lib/types";

const existing: Program = {
  id: "reacher-build",
  name: "Reacher Build",
  totalWeeks: 4,
  createdAt: new Date(2020, 0, 1),
};

const { getPrograms, getSettings, saveProgram, saveWorkout } = vi.hoisted(() => ({
  getPrograms: vi.fn(),
  getSettings: vi.fn(),
  saveProgram: vi.fn().mockResolvedValue(undefined),
  saveWorkout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firestore", () => ({
  getPrograms,
  getSettings,
  saveProgram,
  saveWorkout,
  updateSettings: vi.fn().mockResolvedValue(undefined),
  getWorkoutsForProgram: vi.fn().mockResolvedValue([]),
  getCompletedDays: vi.fn().mockResolvedValue(new Set<string>()),
  getSkippedDays: vi.fn().mockResolvedValue(new Set<string>()),
  setProgramWeights: vi.fn().mockResolvedValue(undefined),
  saveBodyMeasurement: vi.fn().mockResolvedValue(undefined),
  deleteProgramDoc: vi.fn(),
  deleteAllWorkoutsForProgram: vi.fn(),
  setProgramArchived: vi.fn(),
  renameProgram: vi.fn(),
  migrateProgramIds: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/exercise-import", () => ({
  resolveExerciseDefinitions: vi.fn(async (_uid: string, workouts: unknown[]) => ({ workouts, weights: {} })),
}));

function generalWorkbook(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["MONDAY"], ["Home · Push · 30 min"],
    ["Exercise", "Sets", "Reps / Time", "Weight", "Notes"],
    ["Push-ups", 3, "Max", "BW", ""],
  ]), "Monday");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

beforeEach(() => {
  vi.clearAllMocks();
  getPrograms.mockResolvedValue([existing]);
  getSettings.mockResolvedValue({
    defaultRestSeconds: 120, soundEnabled: true, currentWeeks: { "reacher-build": 1 }, migratedProgramIds: true,
  });
});

describe("usePrograms — importXLSX", () => {
  it("keys a new program by its chosen name, leaving existing programs untouched", async () => {
    const { result } = renderHook(() => usePrograms("user-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.importXLSX(generalWorkbook(), "Reacher Build 2"); });

    expect(saveProgram).toHaveBeenCalledWith("user-1", expect.objectContaining({ id: "reacher-build-2", name: "Reacher Build 2", totalWeeks: 1 }));
    expect(saveWorkout).toHaveBeenCalledWith("user-1", expect.objectContaining({ programId: "reacher-build-2" }));
  });

  it("refuses to overwrite an existing program that has the same name", async () => {
    const { result } = renderHook(() => usePrograms("user-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.importXLSX(generalWorkbook(), "Reacher Build")).rejects.toThrow(/already exists/i);
    expect(saveProgram).not.toHaveBeenCalled();
    expect(saveWorkout).not.toHaveBeenCalled();
  });
});
