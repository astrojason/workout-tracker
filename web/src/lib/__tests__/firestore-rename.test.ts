import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the Firestore SDK ──
// We model doc()/collection() as tag objects so query/where/getDocs calls can
// be inspected without a real Firestore instance. getDocs is configured per
// test via mockResolvedValueOnce in call order.

const { updateDocMock, getDocsMock, batchUpdateMock, batchCommitMock } = vi.hoisted(() => ({
  updateDocMock: vi.fn().mockResolvedValue(undefined),
  getDocsMock: vi.fn(),
  batchUpdateMock: vi.fn(),
  batchCommitMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string }, id: string) => ({ __doc: `${col.__col}/${id}` })),
  query: vi.fn((col: unknown, ...filters: unknown[]) => ({ __col: col, filters })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDoc: vi.fn(),
  getDocs: getDocsMock,
  updateDoc: updateDocMock,
  writeBatch: vi.fn(() => ({ update: batchUpdateMock, commit: batchCommitMock })),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { renameProgram, migrateProgramIds } from "../firestore";
import type { Program } from "../types";

function fakeDoc(id: string, data: Record<string, unknown>) {
  return { ref: { __ref: id }, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("renameProgram", () => {
  it("updates the program doc's name field", async () => {
    getDocsMock.mockResolvedValue({ docs: [] });
    await renameProgram("user-1", "prog-1", "New Name");
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __doc: expect.stringContaining("prog-1") }),
      { name: "New Name" }
    );
  });

  it("cascades the new name to every Workout doc matching programId, and only those", async () => {
    getDocsMock
      .mockResolvedValueOnce({ // workouts query
        docs: [
          fakeDoc("w1", { programId: "prog-1", programName: "Old Name" }),
          fakeDoc("w2", { programId: "prog-1", programName: "Old Name" }),
        ],
      })
      .mockResolvedValueOnce({ docs: [] }); // sessions query

    await renameProgram("user-1", "prog-1", "New Name");

    expect(batchUpdateMock).toHaveBeenCalledWith({ __ref: "w1" }, { programName: "New Name" });
    expect(batchUpdateMock).toHaveBeenCalledWith({ __ref: "w2" }, { programName: "New Name" });
    expect(batchUpdateMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalled();
  });

  it("cascades the new name to every WorkoutSessionDoc matching programId", async () => {
    getDocsMock
      .mockResolvedValueOnce({ docs: [] }) // workouts query
      .mockResolvedValueOnce({ // sessions query
        docs: [fakeDoc("s1", { programId: "prog-1", programName: "Old Name" })],
      });

    await renameProgram("user-1", "prog-1", "New Name");

    expect(batchUpdateMock).toHaveBeenCalledWith({ __ref: "s1" }, { programName: "New Name" });
  });

  it("filters both cascade queries by programId, not programName", async () => {
    getDocsMock.mockResolvedValue({ docs: [] });
    const { where } = await import("firebase/firestore");

    await renameProgram("user-1", "prog-1", "New Name");

    expect(where).toHaveBeenCalledWith("programId", "==", "prog-1");
    expect(where).not.toHaveBeenCalledWith("programName", "==", expect.anything());
  });
});

describe("migrateProgramIds", () => {
  const programs: Program[] = [
    { id: "prog-1", name: "Reacher Build", totalWeeks: 4, createdAt: new Date() },
    { id: "prog-2", name: "Other Program", totalWeeks: 4, createdAt: new Date() },
  ];

  it("backfills programId onto legacy Workout docs missing it, matched by programName", async () => {
    getDocsMock
      .mockResolvedValueOnce({ // all workouts
        docs: [
          fakeDoc("w1", { programName: "Reacher Build" }), // legacy, no programId
          fakeDoc("w2", { programName: "Reacher Build", programId: "prog-1" }), // already migrated
        ],
      })
      .mockResolvedValueOnce({ docs: [] }); // all sessions

    await migrateProgramIds("user-1", programs);

    expect(batchUpdateMock).toHaveBeenCalledWith({ __ref: "w1" }, { programId: "prog-1" });
    expect(batchUpdateMock).not.toHaveBeenCalledWith({ __ref: "w2" }, expect.anything());
  });

  it("backfills programId onto legacy WorkoutSessionDoc docs missing it", async () => {
    getDocsMock
      .mockResolvedValueOnce({ docs: [] }) // all workouts
      .mockResolvedValueOnce({ // all sessions
        docs: [fakeDoc("s1", { programName: "Other Program" })],
      });

    await migrateProgramIds("user-1", programs);

    expect(batchUpdateMock).toHaveBeenCalledWith({ __ref: "s1" }, { programId: "prog-2" });
  });

  it("skips docs whose programName doesn't match any known program (never fabricates a link)", async () => {
    getDocsMock
      .mockResolvedValueOnce({
        docs: [fakeDoc("w1", { programName: "Deleted Program" })],
      })
      .mockResolvedValueOnce({ docs: [] });

    await migrateProgramIds("user-1", programs);

    expect(batchUpdateMock).not.toHaveBeenCalled();
  });

  it("is a no-op (issues no batch writes) when every doc already has programId", async () => {
    getDocsMock
      .mockResolvedValueOnce({ docs: [fakeDoc("w1", { programName: "Reacher Build", programId: "prog-1" })] })
      .mockResolvedValueOnce({ docs: [fakeDoc("s1", { programName: "Reacher Build", programId: "prog-1" })] });

    await migrateProgramIds("user-1", programs);

    expect(batchUpdateMock).not.toHaveBeenCalled();
    expect(batchCommitMock).not.toHaveBeenCalled();
  });
});
