import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePrograms } from "../usePrograms";

const {
  getPrograms, getSettings, getWorkoutsForProgram, getCompletedDays, getSkippedDays,
} = vi.hoisted(() => ({
  getPrograms: vi.fn(),
  getSettings: vi.fn(),
  getWorkoutsForProgram: vi.fn(),
  getCompletedDays: vi.fn(),
  getSkippedDays: vi.fn(),
}));

vi.mock("@/lib/firestore", () => ({
  getPrograms, getSettings, getWorkoutsForProgram, getCompletedDays, getSkippedDays,
  updateSettings: vi.fn(), saveSkippedSession: vi.fn(), saveProgram: vi.fn(), saveWorkout: vi.fn(),
  setProgramWeights: vi.fn(), deleteProgramDoc: vi.fn(), deleteAllWorkoutsForProgram: vi.fn(),
  setProgramArchived: vi.fn(), renameProgram: vi.fn(), migrateProgramIds: vi.fn(), saveBodyMeasurement: vi.fn(),
}));

const programs = ["a", "b", "c"].map((id) => ({ id, name: id, totalWeeks: 4, createdAt: new Date(2020, 0, 1) }));

beforeEach(() => {
  vi.clearAllMocks();
  getPrograms.mockResolvedValue(programs);
  getSettings.mockResolvedValue({ defaultRestSeconds: 120, soundEnabled: true, currentWeeks: {}, migratedProgramIds: true });
});

describe("usePrograms initial load", () => {
  it("starts every program's workout, completed-day and skipped-day reads without waiting on each other", async () => {
    // Reads that never resolve: if the load is serial only the very first one is ever started.
    const never = new Promise<never>(() => undefined);
    getWorkoutsForProgram.mockReturnValue(never);
    getCompletedDays.mockReturnValue(never);
    getSkippedDays.mockReturnValue(never);

    renderHook(() => usePrograms("user-1"));

    await waitFor(() => {
      expect(getWorkoutsForProgram).toHaveBeenCalledTimes(3);
      expect(getCompletedDays).toHaveBeenCalledTimes(3);
      expect(getSkippedDays).toHaveBeenCalledTimes(3);
    });
  });

  it("still fills every cache and finishes loading", async () => {
    getWorkoutsForProgram.mockImplementation(async (_u: string, id: string) => [{ id: `w-${id}`, dayOfWeek: "Daily" }]);
    getCompletedDays.mockResolvedValue(new Set<string>());
    getSkippedDays.mockResolvedValue(new Set<string>());

    const { result } = renderHook(() => usePrograms("user-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    for (const p of programs) expect(result.current.getWorkoutsForDay(p.id, "Daily")?.id).toBe(`w-${p.id}`);
  });
});
