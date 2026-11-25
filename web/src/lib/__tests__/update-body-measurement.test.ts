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

import { updateBodyMeasurement } from "../firestore";

beforeEach(() => { vi.clearAllMocks(); calls.length = 0; });

describe("updateBodyMeasurement", () => {
  it("replaces the check-in's values and date, removing measurements that were cleared", async () => {
    await updateBodyMeasurement("user-1", "m-7", { date: new Date("2026-11-24T12:00:00"), weight: 184.2 });
    expect(setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __doc: "users/user-1/bodyMeasurements/m-7" }),
      { date: new Date("2026-11-24T12:00:00"), weight: 184.2 },
    );
  });
});
