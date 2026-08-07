import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDocsMock } = vi.hoisted(() => ({ getDocsMock: vi.fn() }));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn(),
  query: vi.fn((col: unknown, ...filters: unknown[]) => ({ __col: col, filters })),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDoc: vi.fn(),
  getDocs: getDocsMock,
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: class MockTimestamp {
    constructor(private readonly date: Date = new Date(0)) {}
    toDate() { return this.date; }
    static now() { return new MockTimestamp(); }
  },
}));

import { getExerciseHistory } from "../firestore";
import { Timestamp } from "firebase/firestore";
import type { CompletedSet } from "../types";

function fakeSession(id: string, sets: Partial<CompletedSet>[]) {
  return {
    id,
    data: () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      date: new (Timestamp as any)(new Date("2026-01-01")),
      sets: sets.map((s, i) => ({
        id: `${id}-set-${i}`,
        exerciseName: "Bench Press",
        exerciseOrder: 1,
        setNumber: i + 1,
        targetWeight: 100,
        actualWeight: 100,
        targetReps: 8,
        actualReps: 8,
        completed: true,
        timestamp: { toDate: () => new Date("2026-01-01") },
        notes: null,
        ...s,
      })),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getExerciseHistory — definitionId matching", () => {
  it("matches a set by definitionId even when its logged exerciseName is stale (rename scenario)", async () => {
    getDocsMock.mockResolvedValue({
      docs: [fakeSession("s1", [{ definitionId: "def-1", exerciseName: "Old Name", actualWeight: 150 }])],
    });

    const results = await getExerciseHistory("user-1", "New Name", "def-1");

    expect(results).toHaveLength(1);
    expect(results[0].weight).toBe(150);
  });

  it("does not match a set whose definitionId differs, even if the name happens to match", async () => {
    getDocsMock.mockResolvedValue({
      docs: [fakeSession("s1", [{ definitionId: "def-other", exerciseName: "Bench Press", actualWeight: 999 }])],
    });

    const results = await getExerciseHistory("user-1", "Bench Press", "def-1");

    expect(results).toHaveLength(0);
  });

  it("falls back to name matching for legacy sets with no definitionId", async () => {
    getDocsMock.mockResolvedValue({
      docs: [fakeSession("s1", [{ definitionId: undefined, exerciseName: "Bench Press", actualWeight: 135 }])],
    });

    const results = await getExerciseHistory("user-1", "Bench Press", "def-1");

    expect(results).toHaveLength(1);
    expect(results[0].weight).toBe(135);
  });

  it("matches purely by name when no definitionId is supplied (unresolved definition)", async () => {
    getDocsMock.mockResolvedValue({
      docs: [fakeSession("s1", [{ exerciseName: "Bench Press", actualWeight: 135 }])],
    });

    const results = await getExerciseHistory("user-1", "Bench Press", null);

    expect(results).toHaveLength(1);
  });

  it("excludes sets for a different exercise name when no definitionId is supplied", async () => {
    getDocsMock.mockResolvedValue({
      docs: [fakeSession("s1", [{ exerciseName: "Squat", actualWeight: 225 }])],
    });

    const results = await getExerciseHistory("user-1", "Bench Press", null);

    expect(results).toHaveLength(0);
  });
});
