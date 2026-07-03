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
  resolveWeightWithMeta: vi.fn().mockResolvedValue({ weight: 135, prevWeight: null, reason: "no_history" }),
  getProgressionIncrement: vi.fn().mockReturnValue(5),
  adjustForEquipment: vi.fn().mockImplementation((target: number) => target),
}));

vi.mock("@/lib/pr-detector", () => ({
  checkForPRs: vi.fn().mockResolvedValue([]),
}));

const playTimerCompleteMock = vi.fn();
const playSetCompleteMock = vi.fn();
const initAudioMock = vi.fn();

vi.mock("../useSound", () => ({
  useSound: () => ({
    playTimerComplete: playTimerCompleteMock,
    playSetComplete: playSetCompleteMock,
    initAudio: initAudioMock,
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
    isTimeBased: false,
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
      result.current.completeSet(10, 135, false, "normal");
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
      result.current.completeSet(5, 135, true, "normal");
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
      result.current.completeSet(10, 135, false, "normal");
    });

    // No rest timer, should advance directly
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  it("restAfter=false suppresses all rest timers (between-set and between-exercise)", async () => {
    // Exercise with restSeconds=120 and restAfter=false: all rest timers are
    // suppressed — used for warmup exercises that flow through without pausing.
    const exercise = makeExercise({ sets: 3, restSeconds: 120, restAfter: false });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false, "normal");
    });

    // restAfter=false suppresses between-set rest — advances immediately
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  it("restAfter as a number overrides between-exercise rest but not between-set rest", async () => {
    // Between-set rest always uses restSeconds; restAfter=60 only changes
    // how long the timer runs when transitioning to the next exercise.
    const exercise = makeExercise({ sets: 3, restSeconds: 120, restAfter: 60 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false, "normal");
    });

    // Between-set rest uses restSeconds=120 — timer should be running at 120s
    expect(result.current.session!.isResting).toBe(true);
    expect(result.current.session!.restTimeRemaining).toBeLessThanOrEqual(120);
  });

  it("isCurrentSetAmrap is true on the last set of an exercise with lastSetAmrap=true", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0, lastSetAmrap: true });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    // Set 1 — not the last set
    expect(result.current.isCurrentSetAmrap).toBe(false);

    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    // Set 2 — still not last
    expect(result.current.isCurrentSetAmrap).toBe(false);

    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    // Set 3 — this is the last set, AMRAP
    expect(result.current.isCurrentSetAmrap).toBe(true);
  });

  it("isCurrentSetAmrap is always false when lastSetAmrap is not set", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    // On the 3rd set, still false because lastSetAmrap is not set
    expect(result.current.isCurrentSetAmrap).toBe(false);
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
      result.current.completeSet(10, 135, false, "normal");
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
      result.current.completeSet(10, 135, false, "normal");
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
      result.current.completeSet(10, 135, false, "normal");
    });

    expect(result.current.setsCompletedForCurrent).toBe(1);

    act(() => {
      result.current.completeSet(10, 135, false, "normal");
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
      result.current.completeSet(10, 135, false, "normal", "Felt easy");
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
      result.current.completeSet(10, 135, false, "normal");
    });

    expect(result.current.session!.completedSets[0].notes).toBeNull();
  });

  // ── progression-and-weight-resolution user story ──────────────────────────

  it("updateWeight changes the resolved weight for the current exercise", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.updateWeight(exercise.id, 200);
    });

    expect(result.current.currentWeight).toBe(200);
  });

  it("updateWeight does not affect other exercises", async () => {
    const ex1 = makeExercise({ name: "Ex1", sets: 1, restSeconds: 0, order: 1 });
    const ex2 = makeExercise({ name: "Ex2", sets: 1, restSeconds: 0, order: 2 });
    const workout = makeWorkout({ exercises: [ex1, ex2] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => { result.current.updateWeight(ex1.id, 200); });
    act(() => { result.current.completeSet(10, 200, false, "normal"); });

    // Now on ex2 — weight should be the mocked default (135)
    expect(result.current.currentWeight).toBe(135);
  });

  it("updateSets changes the set count for the current exercise", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => { result.current.updateSets(exercise.id, 5); });

    expect(result.current.session!.workout.exercises[0].sets).toBe(5);
  });

  // ── session-persistence user story ───────────────────────────────────────

  it("pauseWorkout moves session to pausedSession and clears session", async () => {
    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => { await result.current.startWorkout(workout); });
    expect(result.current.session).not.toBeNull();

    act(() => { result.current.pauseWorkout(); });

    expect(result.current.session).toBeNull();
    expect(result.current.pausedSession).not.toBeNull();
  });

  it("pauseWorkout preserves currentSetNumber in pausedSession", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 120 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    // Now resting before set 2
    expect(result.current.session!.currentSetNumber).toBe(2);

    act(() => { result.current.pauseWorkout(); });

    expect(result.current.pausedSession!.currentSetNumber).toBe(2);
    expect(result.current.pausedSession!.isResting).toBe(false);
  });

  it("resumeWorkout restores pausedSession to session and clears pausedSession", async () => {
    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.pauseWorkout(); });
    expect(result.current.pausedSession).not.toBeNull();

    act(() => { result.current.resumeWorkout(); });

    expect(result.current.session).not.toBeNull();
    expect(result.current.pausedSession).toBeNull();
  });

  it("resumeWorkout restores session at the exact set that was paused", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    expect(result.current.session!.currentSetNumber).toBe(3);

    act(() => { result.current.pauseWorkout(); });
    act(() => { result.current.resumeWorkout(); });

    expect(result.current.session!.currentSetNumber).toBe(3);
  });

  it("dismissWorkout clears pausedSession when no active session", async () => {
    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.pauseWorkout(); });
    expect(result.current.pausedSession).not.toBeNull();
    expect(result.current.session).toBeNull();

    act(() => { result.current.dismissWorkout(); });

    expect(result.current.pausedSession).toBeNull();
    expect(result.current.session).toBeNull();
  });

  // ── amrap-pr-edge-cases user story ────────────────────────────────────────

  it("stores targetReps as repMin when repMax is failure (pure AMRAP exercise)", async () => {
    const exercise = makeExercise({ sets: 1, restSeconds: 0, repMin: 8, repMax: { type: "failure" } });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.completeSet(15, 135, false, "normal"); });
    expect(result.current.session!.completedSets[0].targetReps).toBe(8); // repMin, not 0
  });

  it("stores targetReps as repMin on the lastSetAmrap final set", async () => {
    const exercise = makeExercise({
      sets: 3,
      restSeconds: 0,
      repMin: 8,
      repMax: { type: "count", value: 12 },
      lastSetAmrap: true,
    });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout); });

    act(() => { result.current.completeSet(12, 135, false, "normal"); });
    expect(result.current.session!.completedSets[0].targetReps).toBe(12); // set 1: repMax

    act(() => { result.current.completeSet(12, 135, false, "normal"); });
    expect(result.current.session!.completedSets[1].targetReps).toBe(12); // set 2: repMax

    act(() => { result.current.completeSet(20, 135, false, "normal"); });
    expect(result.current.session!.completedSets[2].targetReps).toBe(8); // set 3 (AMRAP): repMin
  });

  it("records actualReps and actualWeight on a failed set", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.completeSet(6, 135, true, "hard"); }); // failed=true
    const s = result.current.session!.completedSets[0];
    expect(s.completed).toBe(false);
    expect(s.actualReps).toBe(6);
    expect(s.actualWeight).toBe(135);
  });

  it("stores isTimeBased from the exercise on the CompletedSet", async () => {
    const exercise = makeExercise({ sets: 1, restSeconds: 0, isTimeBased: true });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.completeSet(30, 0, false, "normal"); });
    expect(result.current.session!.completedSets[0].isTimeBased).toBe(true);
  });

  // ── warm-up-phase-behavior user story ─────────────────────────────────────

  it("warmup exercise (restAfter=false) fires no rest timer between sets even with restSeconds set", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 60, restAfter: false });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.completeSet(10, 0, false, "normal"); });
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  // ── unilateral-exercises user story ────────────────────────────────────────

  it("isUnilateral=true does not affect set advancement or rest behavior", async () => {
    const exercise = makeExercise({ sets: 2, restSeconds: 0, isUnilateral: true });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.completeSet(12, 20, false, "normal"); });
    expect(result.current.session!.currentSetNumber).toBe(2);
    expect(result.current.session!.isResting).toBe(false);
  });

  it("completeSet stores per-side actualWeight for unilateral exercises", async () => {
    const exercise = makeExercise({ sets: 1, restSeconds: 0, isUnilateral: true });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout); });
    act(() => { result.current.completeSet(12, 25, false, "normal"); });
    // actualWeight is the per-side value as entered — not doubled
    expect(result.current.session!.completedSets[0].actualWeight).toBe(25);
  });

  // ── mid-workout-weight-editing user story ──────────────────────────────────

  it("previously completed sets retain original targetWeight after updateWeight", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout); });

    // Set 1: targetWeight = resolved weight (135 from mock)
    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    expect(result.current.session!.completedSets[0].targetWeight).toBe(135);

    // Change weight mid-workout
    act(() => { result.current.updateWeight(exercise.id, 200); });

    // Set 2: targetWeight = new weight
    act(() => { result.current.completeSet(10, 200, false, "normal"); });
    expect(result.current.session!.completedSets[1].targetWeight).toBe(200);

    // Set 1 targetWeight must be unchanged
    expect(result.current.session!.completedSets[0].targetWeight).toBe(135);
  });

  it("updateSets below current set number advances to the next exercise immediately", async () => {
    const ex1 = makeExercise({ name: "Ex1", sets: 3, restSeconds: 0, order: 1 });
    const ex2 = makeExercise({ name: "Ex2", sets: 1, restSeconds: 0, order: 2 });
    const workout = makeWorkout({ exercises: [ex1, ex2] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    // Advance to set 3
    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); });
    expect(result.current.session!.currentSetNumber).toBe(3);

    // Reduce to 2 sets — exercise is already past set 2, so complete immediately
    act(() => { result.current.updateSets(ex1.id, 2); });

    expect(result.current.session!.currentExerciseIndex).toBe(1);
    expect(result.current.session!.currentSetNumber).toBe(1);
    expect(result.current.currentExercise!.name).toBe("Ex2");
  });

  it("catches up immediately when the tab becomes visible after the rest timer expired unnoticed", async () => {
    // Simulates a backgrounded tab where setInterval is throttled/suspended by
    // the browser for longer than the rest period, so it never fires on its
    // own. Returning to the tab must resync state immediately instead of
    // waiting for the next (possibly very late) interval tick.
    const exercise = makeExercise({ sets: 3, restSeconds: 60 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
    });

    act(() => {
      result.current.completeSet(10, 135, false, "normal");
    });
    expect(result.current.session!.isResting).toBe(true);

    // Real time passes well beyond the rest duration, but the interval never
    // fires (fake timers are not advanced) — the throttled-background case.
    vi.setSystemTime(Date.now() + 90_000);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.session!.isResting).toBe(false);
    expect(playTimerCompleteMock).toHaveBeenCalledTimes(1);
  });

  it("reacquires the wake lock if it is released unexpectedly while the session is still active", async () => {
    const sentinel = {
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const requestMock = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, "wakeLock", {
      value: { request: requestMock },
      configurable: true,
    });

    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout);
      await Promise.resolve();
    });

    expect(requestMock).toHaveBeenCalledTimes(1);

    // Grab the 'release' listener the hook registered on the sentinel and
    // fire it, simulating a browser/OS-initiated release unrelated to a
    // visibilitychange (e.g. some mobile browsers release it spontaneously).
    const releaseHandler = sentinel.addEventListener.mock.calls.find(
      ([eventName]) => eventName === "release"
    )?.[1];
    expect(releaseHandler).toBeDefined();

    await act(async () => {
      releaseHandler();
      await Promise.resolve();
    });

    expect(requestMock).toHaveBeenCalledTimes(2);
  });
});
