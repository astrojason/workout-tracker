import { describe, it, expect, vi, beforeEach } from "vitest";

const { deleteDocMock, getDocMock, updateDocMock } = vi.hoisted(() => ({
  deleteDocMock: vi.fn().mockResolvedValue(undefined),
  getDocMock: vi.fn(),
  updateDocMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string }, id: string) => ({ __doc: `${col.__col}/${id}` })),
  query: vi.fn(),
  where: vi.fn(),
  getDoc: getDocMock,
  getDocs: vi.fn(),
  updateDoc: updateDocMock,
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

const snap = (data: unknown) => ({ exists: () => data !== undefined, data: () => data });

// The session doc and the program doc, as getDoc sees them.
function mockDocs(session: unknown, program: unknown) {
  getDocMock.mockImplementation(async (ref: { __doc: string }) =>
    ref.__doc.includes("/sessions/") ? snap(session) : snap(program));
}

const change = {
  definitionId: "squat",
  before: { currentWeight: 65, hardStreak: 0 },
  after: { currentWeight: 75, hardStreak: 0 },
};

describe("deleteSession", () => {
  beforeEach(() => mockDocs({ programId: "prog-1" }, { weights: {} }));

  it("deletes the session doc at users/{userId}/sessions/{sessionId}", async () => {
    await deleteSession("user-1", "session-42");
    expect(deleteDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __doc: expect.stringContaining("session-42") })
    );
    const [ref] = deleteDocMock.mock.calls[0];
    expect(ref.__doc).toBe("users/user-1/sessions/session-42");
  });

  it("undoes the progression bump the session caused", async () => {
    mockDocs({ programId: "prog-1", progressionChanges: [change] }, { weights: { squat: change.after } });
    await deleteSession("user-1", "session-42");
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __doc: "users/user-1/programs/prog-1" }),
      { "weights.squat": change.before },
    );
    expect(deleteDocMock).toHaveBeenCalledTimes(1);
  });

  it("leaves a weight alone if a later session has moved it on since", async () => {
    mockDocs(
      { programId: "prog-1", progressionChanges: [change] },
      { weights: { squat: { currentWeight: 80, hardStreak: 0 } } },
    );
    await deleteSession("user-1", "session-42");
    expect(updateDocMock).not.toHaveBeenCalled();
    expect(deleteDocMock).toHaveBeenCalledTimes(1);
  });

  it("does not delete the session if the undo fails", async () => {
    mockDocs({ programId: "prog-1", progressionChanges: [change] }, { weights: { squat: change.after } });
    updateDocMock.mockRejectedValueOnce(new Error("write failed"));
    await expect(deleteSession("user-1", "session-42")).rejects.toThrow("write failed");
    expect(deleteDocMock).not.toHaveBeenCalled();
  });
});
