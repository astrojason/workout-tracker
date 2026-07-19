import { describe, it, expect, vi, beforeEach } from "vitest";

// Mirrors the mocking pattern in firestore-rename.test.ts: model doc()/collection()
// as tag objects so query/where/getDocs calls can be inspected without a real
// Firestore instance.

const { getDocsMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string }, id: string) => ({ __doc: `${col.__col}/${id}` })),
  query: vi.fn((col: unknown, ...filters: unknown[]) => ({ __col: col, filters })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: vi.fn((field: string, dir?: string) => ({ orderBy: field, dir })),
  getDoc: vi.fn(),
  getDocs: getDocsMock,
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { getSessionsForWeek } from "../firestore";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSessionsForWeek", () => {
  it("queries sessions filtered by programId and week", async () => {
    getDocsMock.mockResolvedValue({ docs: [] });

    await getSessionsForWeek("user-1", "prog-1", 2);

    const queryCall = vi.mocked(getDocsMock).mock.calls[0][0] as { filters: { field: string; op: string; value: unknown }[] };
    const fields = queryCall.filters.map((f) => f.field);
    expect(fields).toContain("programId");
    expect(fields).toContain("week");

    const programIdFilter = queryCall.filters.find((f) => f.field === "programId");
    const weekFilter = queryCall.filters.find((f) => f.field === "week");
    expect(programIdFilter?.value).toBe("prog-1");
    expect(weekFilter?.value).toBe(2);
  });

  it("returns session docs with their ids attached", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        { id: "session-1", data: () => ({ programId: "prog-1", week: 2, dayOfWeek: "Monday", sets: [] }) },
      ],
    });

    const result = await getSessionsForWeek("user-1", "prog-1", 2);

    expect(result).toEqual([
      { id: "session-1", programId: "prog-1", week: 2, dayOfWeek: "Monday", sets: [] },
    ]);
  });
});
