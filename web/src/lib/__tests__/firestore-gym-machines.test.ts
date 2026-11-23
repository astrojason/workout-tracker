import { beforeEach, describe, expect, it, vi } from "vitest";

const { addDocMock, updateDocMock, getDocsMock, getDocMock, batch } = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  updateDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  getDocMock: vi.fn(),
  batch: { update: vi.fn(), delete: vi.fn(), commit: vi.fn() },
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string } | unknown, ...rest: string[]) =>
    ({ __doc: `${(col as { __col?: string }).__col ?? "db"}/${rest.join("/")}` })),
  query: vi.fn((col: unknown, ...filters: unknown[]) => ({ col, filters })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: vi.fn(),
  getDocs: getDocsMock,
  getDoc: getDocMock,
  addDoc: addDocMock,
  updateDoc: updateDocMock,
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  writeBatch: vi.fn(() => batch),
  Timestamp: { now: vi.fn(() => ({ __now: true })), fromDate: vi.fn() },
}));

import { createGymMachine, deleteGymMachine, getGymMachines, updateGymMachine } from "../firestore";

beforeEach(() => {
  vi.clearAllMocks();
  batch.commit.mockResolvedValue(undefined);
});

describe("gym machine persistence", () => {
  it("loads machines sorted by name", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        { id: "m2", data: () => ({ name: "Chest Press", plates: [10, 20] }) },
        { id: "m1", data: () => ({ name: "Ab Crunch", plates: [10, 20] }) },
      ],
    });
    const result = await getGymMachines("user-1");
    expect(result.map((m) => m.name)).toEqual(["Ab Crunch", "Chest Press"]);
    expect(getDocsMock.mock.calls[0][0]).toEqual({ __col: "users/user-1/gymMachines" });
  });

  it("creates a machine with timestamps and returns its id", async () => {
    addDocMock.mockResolvedValue({ id: "new-1" });
    const id = await createGymMachine("user-1", { name: "Lat Pulldown", plates: [10, 20, 30] });
    expect(id).toBe("new-1");
    expect(addDocMock).toHaveBeenCalledWith(
      { __col: "users/user-1/gymMachines" },
      { name: "Lat Pulldown", plates: [10, 20, 30], createdAt: { __now: true }, updatedAt: { __now: true } },
    );
  });

  it("updates name and weights", async () => {
    await updateGymMachine("user-1", "m1", { name: "Lat", plates: [10, 20] });
    expect(updateDocMock).toHaveBeenCalledWith(
      { __doc: "users/user-1/gymMachines/m1" },
      { name: "Lat", plates: [10, 20], updatedAt: { __now: true } },
    );
  });

  it("deleting copies the weights onto linked exercises, unlinks them, then removes the machine - in one batch", async () => {
    getDocMock.mockResolvedValue({ exists: () => true, id: "m1", data: () => ({ name: "Lat", plates: [10, 20, 30] }) });
    getDocsMock.mockResolvedValue({ docs: [{ id: "d1" }, { id: "d2" }] });

    await deleteGymMachine("user-1", "m1");

    const q = getDocsMock.mock.calls[0][0] as { col: { __col: string }; filters: { field: string; op: string; value: string }[] };
    expect(q.col.__col).toBe("users/user-1/exerciseDefinitions");
    expect(q.filters).toContainEqual({ field: "machineId", op: "==", value: "m1" });

    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.update).toHaveBeenCalledWith(
      { __doc: "users/user-1/exerciseDefinitions/d1" },
      { weightOptions: [10, 20, 30], machineId: null, updatedAt: { __now: true } },
    );
    expect(batch.delete).toHaveBeenCalledWith({ __doc: "users/user-1/gymMachines/m1" });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("throws when the machine to delete does not exist, and writes nothing", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    await expect(deleteGymMachine("user-1", "nope")).rejects.toThrow(/nope/);
    expect(batch.commit).not.toHaveBeenCalled();
  });
});
