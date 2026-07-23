import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDocsMock, addDocMock, updateDocMock, getDocMock, deleteDocMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  addDocMock: vi.fn(),
  updateDocMock: vi.fn().mockResolvedValue(undefined),
  getDocMock: vi.fn(),
  deleteDocMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ __col: segments.join("/") })),
  doc: vi.fn((col: { __col: string }, id: string) => ({ __doc: `${col.__col}/${id}` })),
  query: vi.fn((col: unknown, ...filters: unknown[]) => ({ __col: col, filters })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDoc: getDocMock,
  getDocs: getDocsMock,
  updateDoc: updateDocMock,
  setDoc: vi.fn(),
  addDoc: addDocMock,
  deleteDoc: deleteDocMock,
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: { now: () => ({ seconds: 123, nanoseconds: 0 }) },
}));

import {
  findExerciseDefinitionByName,
  createExerciseDefinition,
  updateExerciseDefinitionMeta,
  updateExerciseDefinitionWeight,
} from "../firestore";
import type { ExerciseDefinition } from "../types";

function fakeDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findExerciseDefinitionByName", () => {
  it("matches case-insensitively and ignores surrounding whitespace", async () => {
    getDocsMock.mockResolvedValue({
      docs: [fakeDoc("def-1", { name: "Bench Press", currentWeight: 135 })],
    });
    const found = await findExerciseDefinitionByName("user-1", "  bench press  ");
    expect(found?.id).toBe("def-1");
  });

  it("returns null when no definition matches", async () => {
    getDocsMock.mockResolvedValue({
      docs: [fakeDoc("def-1", { name: "Bench Press" })],
    });
    const found = await findExerciseDefinitionByName("user-1", "Squat");
    expect(found).toBeNull();
  });
});

describe("createExerciseDefinition", () => {
  it("stamps createdAt/updatedAt and does not persist a normalizedName field", async () => {
    addDocMock.mockResolvedValue({ id: "new-def" });
    const input: Omit<ExerciseDefinition, "id" | "createdAt" | "updatedAt"> = {
      name: "Squat",
      muscleGroups: ["quads", "glutes"],
      equipmentType: "barbell_45",
      equipmentDetail: null,
      progressionRule: "add_5lb",
      isUnilateral: false,
      isTimeBased: false,
      currentWeight: 225,
      hardStreak: 0,
    };
    const id = await createExerciseDefinition("user-1", input);
    expect(id).toBe("new-def");
    const written = addDocMock.mock.calls[0][1];
    expect(written).toMatchObject({ name: "Squat", currentWeight: 225 });
    expect(written).not.toHaveProperty("normalizedName");
    expect(written.createdAt).toBeDefined();
    expect(written.updatedAt).toBeDefined();
  });
});

describe("updateExerciseDefinitionMeta", () => {
  it("never touches currentWeight or hardStreak", async () => {
    await updateExerciseDefinitionMeta("user-1", "def-1", {
      name: "Bench Press",
      equipmentType: "barbell_35",
    });
    const written = updateDocMock.mock.calls[0][1];
    expect(written).not.toHaveProperty("currentWeight");
    expect(written).not.toHaveProperty("hardStreak");
    expect(written.name).toBe("Bench Press");
  });
});

describe("updateExerciseDefinitionWeight", () => {
  it("writes currentWeight and hardStreak together", async () => {
    await updateExerciseDefinitionWeight("user-1", "def-1", 140, 1);
    const written = updateDocMock.mock.calls[0][1];
    expect(written.currentWeight).toBe(140);
    expect(written.hardStreak).toBe(1);
  });
});
