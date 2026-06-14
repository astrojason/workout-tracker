import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkForPRs } from "../pr-detector";
import type { CompletedSet } from "../types";
import { Timestamp } from "firebase/firestore";

// Mock firestore module
vi.mock("../firestore", () => ({
  getPR: vi.fn(),
  savePR: vi.fn(),
}));

import { getPR, savePR } from "../firestore";
const mockGetPR = vi.mocked(getPR);
const mockSavePR = vi.mocked(savePR);

function makeSet(overrides: Partial<CompletedSet> = {}): CompletedSet {
  return {
    id: "set-1",
    exerciseName: "Bench Press",
    exerciseOrder: 1,
    setNumber: 1,
    targetWeight: 135,
    actualWeight: 135,
    targetReps: 12,
    actualReps: 10,
    completed: true,
    timestamp: Timestamp.now(),
    notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPR.mockResolvedValue(null);
  mockSavePR.mockResolvedValue(undefined);
});

describe("checkForPRs", () => {
  it("returns empty array for empty sets", async () => {
    const result = await checkForPRs("user-1", "Bench Press", []);
    expect(result).toEqual([]);
  });

  it("returns empty array when all sets have zero weight (bodyweight)", async () => {
    const sets = [
      makeSet({ actualWeight: 0, completed: true }),
      makeSet({ actualWeight: 0, completed: true }),
    ];
    const result = await checkForPRs("user-1", "Push-ups", sets);
    expect(result).toEqual([]);
  });

  it("filters out failed sets", async () => {
    const sets = [
      makeSet({ actualWeight: 200, actualReps: 5, completed: false }),
    ];
    const result = await checkForPRs("user-1", "Bench Press", sets);
    expect(result).toEqual([]);
  });

  it("detects new weight PR with no previous record", async () => {
    mockGetPR.mockResolvedValue(null);
    const sets = [makeSet({ actualWeight: 135, actualReps: 10, completed: true })];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const weightPR = result.find((r) => r.type === "weight");
    expect(weightPR).toBeDefined();
    expect(weightPR!.value).toBe(135);
    expect(weightPR!.previousBest).toBeNull();
  });

  it("detects weight PR that beats previous", async () => {
    mockGetPR.mockImplementation(async (_userId, _name, recordType) => {
      if (recordType === "weight") return 130;
      return null;
    });
    const sets = [makeSet({ actualWeight: 135, actualReps: 10, completed: true })];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const weightPR = result.find((r) => r.type === "weight");
    expect(weightPR).toBeDefined();
    expect(weightPR!.value).toBe(135);
    expect(weightPR!.previousBest).toBe(130);
  });

  it("does not detect weight PR when equal to previous", async () => {
    mockGetPR.mockImplementation(async (_userId, _name, recordType) => {
      if (recordType === "weight") return 135;
      if (recordType === "estimated1RM") return 999;
      if (recordType === "volume") return 99999;
      return null;
    });
    const sets = [makeSet({ actualWeight: 135, actualReps: 10, completed: true })];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const weightPR = result.find((r) => r.type === "weight");
    expect(weightPR).toBeUndefined();
  });

  it("calculates estimated 1RM using Epley formula", async () => {
    const sets = [makeSet({ actualWeight: 200, actualReps: 10, completed: true })];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const oneRM = result.find((r) => r.type === "estimated1RM");
    expect(oneRM).toBeDefined();
    // Epley: 200 * (1 + 10/30) = 200 * 1.333... = 266.67
    expect(oneRM!.value).toBeCloseTo(266.67, 1);
  });

  it("returns weight directly for single rep 1RM (not Epley formula)", async () => {
    const sets = [makeSet({ actualWeight: 300, actualReps: 1, completed: true })];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const oneRM = result.find((r) => r.type === "estimated1RM");
    expect(oneRM).toBeDefined();
    expect(oneRM!.value).toBe(300);
  });

  it("calculates volume PR (total weight x reps)", async () => {
    const sets = [
      makeSet({ actualWeight: 200, actualReps: 10, completed: true }),
      makeSet({ actualWeight: 200, actualReps: 10, completed: true }),
      makeSet({ actualWeight: 200, actualReps: 8, completed: true }),
    ];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const volumePR = result.find((r) => r.type === "volume");
    expect(volumePR).toBeDefined();
    // Volume = 200*10 + 200*10 + 200*8 = 5600
    expect(volumePR!.value).toBe(5600);
  });

  it("does not include volume PR when below previous", async () => {
    mockGetPR.mockImplementation(async (_userId, _name, recordType) => {
      if (recordType === "volume") return 10000;
      return null;
    });
    const sets = [makeSet({ actualWeight: 100, actualReps: 5, completed: true })];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const volumePR = result.find((r) => r.type === "volume");
    expect(volumePR).toBeUndefined();
  });

  it("only counts completed sets for weight PR (filters failed)", async () => {
    const sets = [
      makeSet({ actualWeight: 200, actualReps: 5, completed: false }),
      makeSet({ actualWeight: 150, actualReps: 10, completed: true }),
    ];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const weightPR = result.find((r) => r.type === "weight");
    expect(weightPR).toBeDefined();
    expect(weightPR!.value).toBe(150); // not 200 (failed)
  });

  it("calls savePR for each new PR detected", async () => {
    const sets = [makeSet({ actualWeight: 200, actualReps: 10, completed: true })];
    await checkForPRs("user-1", "Bench Press", sets);

    // Should save weight, 1RM, and volume PRs
    expect(mockSavePR).toHaveBeenCalledWith("user-1", "Bench Press", "weight", 200);
    expect(mockSavePR).toHaveBeenCalledWith("user-1", "Bench Press", "estimated1RM", expect.any(Number));
    expect(mockSavePR).toHaveBeenCalledWith("user-1", "Bench Press", "volume", 2000);
  });

  it("picks highest weight from multiple sets for weight PR", async () => {
    const sets = [
      makeSet({ actualWeight: 135, actualReps: 10, completed: true }),
      makeSet({ actualWeight: 155, actualReps: 8, completed: true }),
      makeSet({ actualWeight: 145, actualReps: 9, completed: true }),
    ];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const weightPR = result.find((r) => r.type === "weight");
    expect(weightPR!.value).toBe(155);
  });

  it("picks highest 1RM from multiple sets", async () => {
    const sets = [
      makeSet({ actualWeight: 200, actualReps: 5, completed: true }),  // 1RM = 200*(1+5/30) = 233.33
      makeSet({ actualWeight: 180, actualReps: 10, completed: true }), // 1RM = 180*(1+10/30) = 240
    ];
    const result = await checkForPRs("user-1", "Bench Press", sets);

    const oneRM = result.find((r) => r.type === "estimated1RM");
    expect(oneRM!.value).toBeCloseTo(240, 1);
  });

  // amrap-pr-edge-cases user story
  it("failed AMRAP set does not generate PR even with high rep count", async () => {
    const sets = [
      makeSet({ actualWeight: 100, actualReps: 25, completed: false }),
    ];
    const result = await checkForPRs("user-1", "Assisted Pull-ups", sets);
    expect(result).toEqual([]);
    expect(mockSavePR).not.toHaveBeenCalled();
  });

  it("zero-weight bodyweight completed set generates no PRs (weight filter excludes volume too)", async () => {
    // weight=0 → filtered from weightedSets → no weight, 1RM, or volume PR
    // (volume = 0 × reps = 0 in any case)
    const sets = [
      makeSet({ actualWeight: 0, actualReps: 20, completed: true }),
    ];
    const result = await checkForPRs("user-1", "Push-ups", sets);
    expect(result).toEqual([]);
    expect(mockSavePR).not.toHaveBeenCalled();
  });

  // personal-records-and-history user story: skipped sets excluded
  it("excludes skipped sets (0 reps, completed=false) from all PR calculations", async () => {
    const sets = [
      makeSet({ actualWeight: 135, actualReps: 0, completed: false, notes: "Skipped" }),
    ];
    const result = await checkForPRs("user-1", "Bench Press", sets);
    expect(result).toEqual([]);
    expect(mockSavePR).not.toHaveBeenCalled();
  });
});
