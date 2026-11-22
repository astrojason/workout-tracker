import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHistory } from "../useHistory";

const { subscribeToSessions, showError } = vi.hoisted(() => ({ subscribeToSessions: vi.fn(), showError: vi.fn() }));

vi.mock("@/lib/firestore", () => ({ subscribeToSessions, getExerciseHistory: vi.fn() }));
vi.mock("@/components/providers/ErrorProvider", () => ({ useError: () => ({ showError }) }));

const NOW = new Date("2026-11-22T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  subscribeToSessions.mockReset();
  subscribeToSessions.mockImplementation((_u: string, _limit: number, cb: (s: unknown[]) => void) => { cb([]); return () => undefined; });
});
afterEach(() => vi.useRealTimers());

describe("useHistory", () => {
  it("loads the last 50 sessions by default", async () => {
    renderHook(() => useHistory("u1"));
    await waitFor(() => expect(subscribeToSessions).toHaveBeenCalled());
    expect(subscribeToSessions.mock.calls[0][1]).toBe(50);
    expect(subscribeToSessions.mock.calls[0][4]).toBeUndefined();
  });

  it("limits the query to the last N days when asked", async () => {
    const { result } = renderHook(() => useHistory("u1", 7));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const since = subscribeToSessions.mock.calls[0][4] as Date;
    expect(since.getTime()).toBe(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
  });
});
