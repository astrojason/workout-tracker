import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDocsMock, addDocMock, batchUpdateMock, batchCommitMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  addDocMock: vi.fn(),
  batchUpdateMock: vi.fn(),
  batchCommitMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string }, id: string) => ({ __doc: `${col.__col}/${id}` })),
  query: vi.fn((col: unknown, ...filters: unknown[]) => ({ __col: col, filters })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: vi.fn((field: string, dir: string) => ({ field, dir })),
  getDoc: vi.fn(),
  getDocs: getDocsMock,
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: addDocMock,
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(() => ({ update: batchUpdateMock, commit: batchCommitMock })),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { migrateToExerciseLibrary } from "../firestore";

function fakeDoc(id: string, data: Record<string, unknown>) {
  return { id, ref: { __ref: id }, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("migrateToExerciseLibrary — no-op cases", () => {
  it("issues no writes when every exercise already has a definitionId", async () => {
    getDocsMock
      .mockResolvedValueOnce({ // workouts
        docs: [fakeDoc("w1", { exercises: [{ id: "ex-1", definitionId: "def-1", order: 1 }] })],
      });

    await migrateToExerciseLibrary("user-1");

    expect(addDocMock).not.toHaveBeenCalled();
    expect(batchUpdateMock).not.toHaveBeenCalled();
    // Should short-circuit before even querying sessions/definitions
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });
});

describe("migrateToExerciseLibrary — unifies same-named exercises across programs", () => {
  it("creates exactly ONE definition for an exercise appearing in two different workout docs", async () => {
    getDocsMock
      .mockResolvedValueOnce({ // workouts: Bench Press in two separate programs' workout docs
        docs: [
          fakeDoc("w1", {
            exercises: [{
              id: "ex-1", order: 1, phase: "main", name: "Bench Press",
              equipmentType: "barbell_45", equipmentDetail: null,
              baseWeight: { type: "fixed", value: 135 }, sets: 3, repMin: 8,
              repMax: { type: "count", value: 12 }, restSeconds: 90,
              progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, notes: null,
            }],
          }),
          fakeDoc("w2", {
            exercises: [{
              id: "ex-2", order: 1, phase: "main", name: "Bench Press",
              equipmentType: "barbell_45", equipmentDetail: null,
              baseWeight: { type: "fixed", value: 135 }, sets: 5, repMin: 5,
              repMax: { type: "count", value: 5 }, restSeconds: 120,
              progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, notes: null,
            }],
          }),
        ],
      })
      .mockResolvedValueOnce({ docs: [] }) // sessions: no history yet
      .mockResolvedValueOnce({ docs: [] }); // existing exercise definitions: none

    addDocMock.mockResolvedValue({ id: "shared-def-id" });

    await migrateToExerciseLibrary("user-1");

    expect(addDocMock).toHaveBeenCalledTimes(1); // not once per occurrence
    expect(batchUpdateMock).toHaveBeenCalledWith(
      { __ref: "w1" },
      { exercises: [expect.objectContaining({ id: "ex-1", definitionId: "shared-def-id", sets: 3 })] }
    );
    expect(batchUpdateMock).toHaveBeenCalledWith(
      { __ref: "w2" },
      { exercises: [expect.objectContaining({ id: "ex-2", definitionId: "shared-def-id", sets: 5 })] }
    );
  });

  it("reuses an already-existing definition instead of creating a duplicate", async () => {
    getDocsMock
      .mockResolvedValueOnce({
        docs: [fakeDoc("w1", {
          exercises: [{
            id: "ex-1", order: 1, phase: "main", name: "Squat",
            equipmentType: "barbell_45", equipmentDetail: null,
            baseWeight: { type: "progressive" }, totalWeight: 225, sets: 3, repMin: 5,
            repMax: { type: "count", value: 5 }, restSeconds: 120,
            progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, notes: null,
          }],
        })],
      })
      .mockResolvedValueOnce({ docs: [] }) // sessions
      .mockResolvedValueOnce({ docs: [fakeDoc("def-existing", { name: "Squat", currentWeight: 275 })] }); // existing defs

    await migrateToExerciseLibrary("user-1");

    expect(addDocMock).not.toHaveBeenCalled();
    expect(batchUpdateMock).toHaveBeenCalledWith(
      { __ref: "w1" },
      { exercises: [expect.objectContaining({ definitionId: "def-existing" })] }
    );
  });
});

describe("migrateToExerciseLibrary — weight seeding", () => {
  it("seeds currentWeight from the most recent completed set, not the planned weight", async () => {
    getDocsMock
      .mockResolvedValueOnce({
        docs: [fakeDoc("w1", {
          exercises: [{
            id: "ex-1", order: 1, phase: "main", name: "Deadlift",
            equipmentType: "barbell_45", equipmentDetail: null,
            baseWeight: { type: "fixed", value: 135 }, sets: 3, repMin: 5,
            repMax: { type: "count", value: 5 }, restSeconds: 150,
            progressionRule: "add_10lb", isUnilateral: false, isTimeBased: false, notes: null,
          }],
        })],
      })
      .mockResolvedValueOnce({ // sessions, most recent first
        docs: [
          fakeDoc("s1", { date: { toDate: () => new Date() }, sets: [
            { exerciseName: "Deadlift", completed: true, actualWeight: 315 },
          ] }),
        ],
      })
      .mockResolvedValueOnce({ docs: [] }); // no existing defs

    addDocMock.mockResolvedValue({ id: "def-deadlift" });

    await migrateToExerciseLibrary("user-1");

    expect(addDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ currentWeight: 315 })
    );
  });

  it("falls back to legacy planned weight when no completed history exists", async () => {
    getDocsMock
      .mockResolvedValueOnce({
        docs: [fakeDoc("w1", {
          exercises: [{
            id: "ex-1", order: 1, phase: "main", name: "Overhead Press",
            equipmentType: "barbell_45", equipmentDetail: null,
            baseWeight: { type: "progressive" }, totalWeight: 95, sets: 3, repMin: 8,
            repMax: { type: "count", value: 10 }, restSeconds: 90,
            progressionRule: "add_2.5lb", isUnilateral: false, isTimeBased: false, notes: null,
          }],
        })],
      })
      .mockResolvedValueOnce({ docs: [] }) // no sessions at all
      .mockResolvedValueOnce({ docs: [] }); // no existing defs

    addDocMock.mockResolvedValue({ id: "def-ohp" });

    await migrateToExerciseLibrary("user-1");

    expect(addDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ currentWeight: 95 })
    );
  });

  it("ignores sets that weren't completed when finding the most recent weight", async () => {
    getDocsMock
      .mockResolvedValueOnce({
        docs: [fakeDoc("w1", {
          exercises: [{
            id: "ex-1", order: 1, phase: "main", name: "Row",
            equipmentType: "barbell_45", equipmentDetail: null,
            baseWeight: { type: "fixed", value: 100 }, sets: 3, repMin: 8,
            repMax: { type: "count", value: 10 }, restSeconds: 90,
            progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, notes: null,
          }],
        })],
      })
      .mockResolvedValueOnce({
        docs: [fakeDoc("s1", { date: { toDate: () => new Date() }, sets: [
          { exerciseName: "Row", completed: false, actualWeight: 999 }, // should be skipped
          { exerciseName: "Row", completed: true, actualWeight: 105 },
        ] })],
      })
      .mockResolvedValueOnce({ docs: [] });

    addDocMock.mockResolvedValue({ id: "def-row" });

    await migrateToExerciseLibrary("user-1");

    expect(addDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ currentWeight: 105 })
    );
  });
});

describe("migrateToExerciseLibrary — partial migration idempotency", () => {
  it("only rewrites already-legacy exercises, leaving migrated ones in a doc untouched", async () => {
    getDocsMock
      .mockResolvedValueOnce({
        docs: [fakeDoc("w1", {
          exercises: [
            { id: "ex-1", definitionId: "already-migrated", order: 1 },
            {
              id: "ex-2", order: 2, phase: "main", name: "Curl",
              equipmentType: "dumbbell", equipmentDetail: null,
              baseWeight: { type: "fixed", value: 25 }, sets: 3, repMin: 10,
              repMax: { type: "count", value: 12 }, restSeconds: 60,
              progressionRule: "add_2.5lb", isUnilateral: false, isTimeBased: false, notes: null,
            },
          ],
        })],
      })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] });

    addDocMock.mockResolvedValue({ id: "def-curl" });

    await migrateToExerciseLibrary("user-1");

    const writtenExercises = batchUpdateMock.mock.calls[0][1].exercises;
    expect(writtenExercises).toHaveLength(2);
    expect(writtenExercises[0]).toEqual({ id: "ex-1", definitionId: "already-migrated", order: 1 });
    expect(writtenExercises[1]).toEqual(expect.objectContaining({ id: "ex-2", definitionId: "def-curl" }));
  });
});
