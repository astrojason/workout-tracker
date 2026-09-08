import { describe, it, expect, vi, beforeEach } from "vitest";

// Mirrors the mocking pattern in getSessionsForWeek.test.ts: model doc()/collection()
// as tag objects so query/where/getDocs/addDoc calls can be inspected without a
// real Firestore instance.

const { getDocsMock, addDocMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  addDocMock: vi.fn(),
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
  addDoc: addDocMock,
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  limit: vi.fn(),
  Timestamp: class MockTimestamp {
    constructor(private readonly date: Date = new Date(0)) {}
    toDate() { return this.date; }
    static now() { return new MockTimestamp(); }
    static fromDate(d: Date) { return new MockTimestamp(d); }
  },
}));

import { saveSkippedSession, getSkippedDays } from "../firestore";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveSkippedSession", () => {
  it("writes a session doc marked skipped, with no sets and no duration", async () => {
    addDocMock.mockResolvedValue({ id: "session-skip-1" });

    const id = await saveSkippedSession("user-1", {
      programId: "prog-1",
      programName: "Test Program",
      week: 2,
      dayOfWeek: "Wednesday",
    });

    expect(id).toBe("session-skip-1");
    const [, payload] = vi.mocked(addDocMock).mock.calls[0];
    expect(payload).toMatchObject({
      programId: "prog-1",
      programName: "Test Program",
      week: 2,
      dayOfWeek: "Wednesday",
      completed: false,
      skipped: true,
      durationSeconds: 0,
      sets: [],
    });
  });
});

describe("getSkippedDays", () => {
  it("queries sessions filtered by programId, week, and skipped", async () => {
    getDocsMock.mockResolvedValue({ docs: [] });

    await getSkippedDays("user-1", "prog-1", 2);

    const queryCall = vi.mocked(getDocsMock).mock.calls[0][0] as { filters: { field: string; op: string; value: unknown }[] };
    const fields = queryCall.filters.map((f) => f.field);
    expect(fields).toEqual(["programId", "week", "skipped"]);
    expect(queryCall.filters.find((f) => f.field === "skipped")?.value).toBe(true);
  });

  it("returns the local date of each skipped session", async () => {
    const date = new Date(2026, 2, 11); // local March 11, 2026
    getDocsMock.mockResolvedValue({
      docs: [
        { id: "s1", data: () => ({ dayOfWeek: "Wednesday", skipped: true, date }) },
      ],
    });

    const days = await getSkippedDays("user-1", "prog-1", 2);

    expect(days).toEqual(new Set([date.toLocaleDateString("en-CA")]));
  });

  it("excludes sessions before the since cutoff", async () => {
    const before = new Date(2026, 0, 1);
    const after = new Date(2026, 2, 11);
    getDocsMock.mockResolvedValue({
      docs: [
        { id: "s1", data: () => ({ dayOfWeek: "Monday", skipped: true, date: before }) },
        { id: "s2", data: () => ({ dayOfWeek: "Wednesday", skipped: true, date: after }) },
      ],
    });

    const days = await getSkippedDays("user-1", "prog-1", 2, new Date(2026, 1, 1));

    expect(days).toEqual(new Set([after.toLocaleDateString("en-CA")]));
  });
});
