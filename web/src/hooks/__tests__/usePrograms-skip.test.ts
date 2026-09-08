import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePrograms } from "../usePrograms";
import type { Program } from "@/lib/types";

const program: Program = {
  id: "prog-1",
  name: "Test Program",
  totalWeeks: 4,
  createdAt: new Date(2020, 0, 1),
};

const {
  getPrograms, getSettings, updateSettings, getWorkoutsForProgram,
  getCompletedDays, getSkippedDays, saveSkippedSession,
} = vi.hoisted(() => ({
  getPrograms: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  getWorkoutsForProgram: vi.fn().mockResolvedValue([]),
  getCompletedDays: vi.fn().mockResolvedValue(new Set<string>()),
  getSkippedDays: vi.fn(),
  saveSkippedSession: vi.fn().mockResolvedValue("skip-session-id"),
}));

vi.mock("@/lib/firestore", () => ({
  getPrograms,
  getSettings,
  updateSettings,
  getWorkoutsForProgram,
  getCompletedDays,
  getSkippedDays,
  saveSkippedSession,
  saveProgram: vi.fn(),
  saveWorkout: vi.fn(),
  deleteProgramDoc: vi.fn(),
  deleteAllWorkoutsForProgram: vi.fn(),
  setProgramArchived: vi.fn(),
  renameProgram: vi.fn(),
  migrateProgramIds: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getPrograms.mockResolvedValue([program]);
  getSettings.mockResolvedValue({
    defaultRestSeconds: 120,
    soundEnabled: true,
    currentWeeks: { "prog-1": 1 },
    migratedProgramIds: true,
  });
  getCompletedDays.mockResolvedValue(new Set<string>());
  getSkippedDays.mockResolvedValue(new Set<string>());
});

describe("usePrograms — mark day skipped", () => {
  it("saves a skipped session and reflects it via getSkippedDaysForProgram", async () => {
    getSkippedDays
      .mockResolvedValueOnce(new Set<string>()) // initial load
      .mockResolvedValueOnce(new Set(["2026-03-11"])); // after markDaySkipped

    const { result } = renderHook(() => usePrograms("user-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.getSkippedDaysForProgram("prog-1")).toEqual(new Set());

    await act(async () => {
      await result.current.markDaySkipped("prog-1", "Wednesday");
    });

    expect(saveSkippedSession).toHaveBeenCalledWith("user-1", {
      programId: "prog-1",
      programName: "Test Program",
      week: 1,
      dayOfWeek: "Wednesday",
    });
    expect(result.current.getSkippedDaysForProgram("prog-1")).toEqual(new Set(["2026-03-11"]));
  });
});
