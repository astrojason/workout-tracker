import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDocMock, setDocMock } = vi.hoisted(() => ({
  getDocMock: vi.fn(),
  setDocMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn((_col, ...segments: string[]) => ({ __doc: segments.join("/") })),
  getDoc: getDocMock,
  getDocs: vi.fn(),
  setDoc: setDocMock,
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { getSettings } from "../firestore";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSettings", () => {
  it("creates and returns full defaults when no settings doc exists", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });

    const settings = await getSettings("user-1");

    expect(settings).toEqual({ defaultRestSeconds: 120, soundEnabled: true, currentWeeks: {} });
    expect(setDocMock).toHaveBeenCalled();
  });

  it("returns the stored doc as-is when it already has every field", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ defaultRestSeconds: 90, soundEnabled: false, currentWeeks: { "prog-1": 3 } }),
    });

    const settings = await getSettings("user-1");

    expect(settings).toEqual({ defaultRestSeconds: 90, soundEnabled: false, currentWeeks: { "prog-1": 3 } });
  });

  it("merges over defaults when the doc exists but is missing fields (a partial write)", async () => {
    // e.g. a merge:true updateSettings() call reaching Firestore before the
    // doc ever existed — should never crash a caller indexing into currentWeeks.
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ exerciseLibraryMigrated: true }),
    });

    const settings = await getSettings("user-1");

    expect(settings).toEqual({
      defaultRestSeconds: 120,
      soundEnabled: true,
      currentWeeks: {},
      exerciseLibraryMigrated: true,
    });
  });

  it("does not overwrite the existing doc when only partial data was found", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ exerciseLibraryMigrated: true }),
    });

    await getSettings("user-1");

    expect(setDocMock).not.toHaveBeenCalled();
  });
});
