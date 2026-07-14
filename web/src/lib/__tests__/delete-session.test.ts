import { describe, it, expect, vi, beforeEach } from "vitest";

const { deleteDocMock } = vi.hoisted(() => ({
  deleteDocMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string }, id: string) => ({ __doc: `${col.__col}/${id}` })),
  query: vi.fn(),
  where: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: deleteDocMock,
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { deleteSession } from "../firestore";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteSession", () => {
  it("deletes the session doc at users/{userId}/sessions/{sessionId}", async () => {
    await deleteSession("user-1", "session-42");
    expect(deleteDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __doc: expect.stringContaining("session-42") })
    );
    const [ref] = deleteDocMock.mock.calls[0];
    expect(ref.__doc).toBe("users/user-1/sessions/session-42");
  });
});
