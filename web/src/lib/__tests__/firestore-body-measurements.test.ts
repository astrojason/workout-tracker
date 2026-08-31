import { beforeEach, describe, expect, it, vi } from "vitest";

const { addDocMock, deleteDocMock, getDocsMock } = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  deleteDocMock: vi.fn(),
  getDocsMock: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string }, id: string) => ({ __doc: `${col.__col}/${id}` })),
  query: vi.fn((col: unknown, ...filters: unknown[]) => ({ col, filters })),
  orderBy: vi.fn((field: string, direction?: string) => ({ field, direction })),
  getDocs: getDocsMock,
  addDoc: addDocMock,
  deleteDoc: deleteDocMock,
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: {
    now: vi.fn(),
    fromDate: vi.fn((date: Date) => ({ __timestamp: date.toISOString() })),
  },
}));

import {
  deleteBodyMeasurement,
  getBodyMeasurements,
  saveBodyMeasurement,
} from "../firestore";

beforeEach(() => vi.clearAllMocks());

describe("body measurement persistence", () => {
  it("loads check-ins in chronological order", async () => {
    getDocsMock.mockResolvedValue({
      docs: [{ id: "entry-1", data: () => ({ weight: 180, waist: 34 }) }],
    });

    const result = await getBodyMeasurements("user-1");

    expect(result).toEqual([{ id: "entry-1", weight: 180, waist: 34 }]);
    const request = getDocsMock.mock.calls[0][0] as { filters: { field: string; direction: string }[] };
    expect(request.filters).toContainEqual({ field: "date", direction: "asc" });
  });

  it("saves required weight and only the optional measurements provided", async () => {
    addDocMock.mockResolvedValue({ id: "entry-2" });
    const date = new Date("2026-09-07T12:00:00.000Z");

    const id = await saveBodyMeasurement("user-1", {
      date,
      weight: 178.5,
      waist: 33.25,
    });

    expect(id).toBe("entry-2");
    expect(addDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __col: "users/user-1/bodyMeasurements" }),
      {
        date: { __timestamp: "2026-09-07T12:00:00.000Z" },
        weight: 178.5,
        waist: 33.25,
      },
    );
  });

  it("deletes only the selected user's entry", async () => {
    await deleteBodyMeasurement("user-1", "entry-2");

    expect(deleteDocMock).toHaveBeenCalledWith({
      __doc: "users/user-1/bodyMeasurements/entry-2",
    });
  });
});
