import { describe, it, expect, vi, beforeEach } from "vitest";

const { updateDocMock, setDocMock, getDocsMock, calls } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    updateDocMock: vi.fn(async () => { calls.push("updateDoc"); }),
    setDocMock: vi.fn(async () => { calls.push("setDoc"); }),
    getDocsMock: vi.fn(async () => ({ docs: [] })),
  };
});

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string }, id: string) => ({ __doc: `${col.__col}/${id}` })),
  query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  getDoc: vi.fn(), getDocs: getDocsMock, updateDoc: updateDocMock, setDoc: setDocMock,
  writeBatch: vi.fn(), addDoc: vi.fn(), deleteDoc: vi.fn(), onSnapshot: vi.fn(), runTransaction: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }), fromDate: (d: Date) => d },
}));

import { updateSessionSets } from "../firestore";

beforeEach(() => { vi.clearAllMocks(); calls.length = 0; });

describe("updateSessionSets", () => {
  it("writes the edited sets and duration to the session, then rebuilds the last-performance summary", async () => {
    await updateSessionSets("user-1", "session-42", { sets: [], durationSeconds: 3000 });
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __doc: "users/user-1/sessions/session-42" }),
      { sets: [], durationSeconds: 3000 },
    );
    // The summary holds each exercise's last sets, so an edit must be folded in after the write.
    expect(calls).toEqual(["updateDoc", "setDoc"]);
  });

  it("does not rebuild the summary when the session write fails", async () => {
    updateDocMock.mockRejectedValueOnce(new Error("permission-denied"));
    await expect(updateSessionSets("user-1", "s", { sets: [], durationSeconds: 1 })).rejects.toThrow("permission-denied");
    expect(setDocMock).not.toHaveBeenCalled();
  });
});
