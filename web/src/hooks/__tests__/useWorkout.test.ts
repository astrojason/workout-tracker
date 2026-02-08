import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkout } from "../useWorkout";
import type { Workout, Exercise } from "@/lib/types";

// Mock all external dependencies
vi.mock("@/lib/firestore", () => ({
  saveSession: vi.fn().mockResolvedValue("session-id"),
  getLastSetsForExercise: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/progression-service", () => ({
  resolveWeight: vi.fn().mockResolvedValue(135),
}));

vi.mock("@/lib/pr-detector", () => ({
  checkForPRs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../useSound", () => ({
  useSound: () => ({
    playTimerComplete: vi.fn(),
    playSetComplete: vi.fn(),
    initAudio: vi.fn(),
  }),
}));

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.spyOn(crypto, "randomUUID").mockImplementation(() => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`);

// Mock Timestamp
vi.mock("firebase/firestore", () => ({
  Timestamp: {
    now: () => ({ seconds: 1000, nanoseconds: 0 }),
    fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  },
  getFirestore: vi.fn(),
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(),
}));

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: `ex-${++uuidCounter}`,
    order: 1,
    name: "Bench Press",
    phase: "main",
    equipmentType: "barbell_45",
    equipmentDetail: null,
    baseWeight: { type: "fixed", value: 135 },
    sets: 3,
    repMin: 8,
    repMax: { type: "count", value: 12 },
    restSeconds: 120,
    progressionRule: "add_5lb",
    isUnilateral: false,
    notes: null,
    ...overrides,
  };
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "workout-1",
    programName: "Test Program",
    week: 1,
    dayOfWeek: "Monday",
    exercises: [makeExercise()],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  uuidCounter = 0;
  vi.useFakeTimers();
});

describe("useWorkout", () => {
  it("initializes with null session", () => {
    const { result } = renderHook(() => useWorkout("user-1"));
    expect(result.current.session).toBeNull();
    expect(result.current.currentExercise).toBeNull();
    expect(result.current.currentWeight).toBe(0);
  });

  it("does nothing when startWorkout called without userId", async () => {
    const { result } = renderHook(() => useWorkout(null));
    await act(async () => {
      await result.current.startWorkout(makeWorkout());
    });
    expect(result.current.session).toBeNull();
  });

  it("creates session with correct initial state on startWorkout", async () => {
    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    expect(result.current.session).not.toBeNull();
    expect(result.current.session!.currentExerciseIndex).toBe(0);
    expect(result.current.session!.currentSetNumber).toBe(1);
    expect(result.current.session!.completedSets).toEqual([]);
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.prsAchieved).toEqual([]);
  });

  it("sets currentExercise after startWorkout", async () => {
    const exercise = makeExercise({ name: "Squat" });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    expect(result.current.currentExercise).not.toBeNull();
    expect(result.current.currentExercise!.name).toBe("Squat");
  });

  it("adds completed set and starts rest timer on completeSet", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 60 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false);
    });

    expect(result.current.session!.completedSets).toHaveLength(1);
    expect(result.current.session!.completedSets[0].actualReps).toBe(10);
    expect(result.current.session!.completedSets[0].actualWeight).toBe(135);
    expect(result.current.session!.completedSets[0].completed).toBe(true);
    expect(result.current.session!.isResting).toBe(true);
  });

  it("marks set as not completed when failed", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 60 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(5, 135, true);
    });

    expect(result.current.session!.completedSets[0].completed).toBe(false);
  });

  it("advances set number when no rest time", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false);
    });

    // No rest timer, should advance directly
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  it("skipSet adds a skipped set with completed=false", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.skipSet();
    });

    expect(result.current.session!.completedSets).toHaveLength(1);
    expect(result.current.session!.completedSets[0].completed).toBe(false);
    expect(result.current.session!.completedSets[0].actualReps).toBe(0);
    expect(result.current.session!.completedSets[0].actualWeight).toBe(0);
    expect(result.current.session!.completedSets[0].notes).toBe("Skipped");
  });

  it("advances to next exercise after last set with no rest", async () => {
    const ex1 = makeExercise({ name: "Ex1", sets: 1, restSeconds: 0, order: 1 });
    const ex2 = makeExercise({ name: "Ex2", sets: 1, restSeconds: 0, order: 2 });
    const workout = makeWorkout({ exercises: [ex1, ex2] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false);
    });

    expect(result.current.session!.currentExerciseIndex).toBe(1);
    expect(result.current.session!.currentSetNumber).toBe(1);
    expect(result.current.currentExercise!.name).toBe("Ex2");
  });

  it("skipRest clears resting state and advances", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 120 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false);
    });

    expect(result.current.session!.isResting).toBe(true);

    act(() => {
      result.current.skipRest();
    });

    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  it("dismissWorkout clears session to null", async () => {
    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    expect(result.current.session).not.toBeNull();

    act(() => {
      result.current.dismissWorkout();
    });

    expect(result.current.session).toBeNull();
  });

  it("tracks setsCompletedForCurrent correctly", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    expect(result.current.setsCompletedForCurrent).toBe(0);

    act(() => {
      result.current.completeSet(10, 135, false);
    });

    expect(result.current.setsCompletedForCurrent).toBe(1);

    act(() => {
      result.current.completeSet(10, 135, false);
    });

    expect(result.current.setsCompletedForCurrent).toBe(2);
  });

  it("includes notes in completed set", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false, "Felt easy");
    });

    expect(result.current.session!.completedSets[0].notes).toBe("Felt easy");
  });

  it("sets notes to null when not provided", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false);
    });

    expect(result.current.session!.completedSets[0].notes).toBeNull();
  });
});
