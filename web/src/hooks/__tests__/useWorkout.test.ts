import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkout } from "../useWorkout";
import type { Workout, Exercise, ExerciseDefinition, EquipmentType, ProgressionRule } from "@/lib/types";

const { updateExerciseDefinitionWeightMock } = vi.hoisted(() => ({
  updateExerciseDefinitionWeightMock: vi.fn().mockResolvedValue(undefined),
}));

// Mock all external dependencies. progression-service itself is NOT mocked —
// it's pure and cheap, so these tests exercise the real computeNextWeight/
// liveEasyBump logic (already unit-tested in progression-service.test.ts).
vi.mock("@/lib/firestore", () => ({
  saveSession: vi.fn().mockResolvedValue("session-id"),
  updateExerciseDefinitionWeight: updateExerciseDefinitionWeightMock,
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

const showErrorMock = vi.fn();

vi.mock("@/components/providers/ErrorProvider", () => ({
  useError: () => ({ showError: showErrorMock }),
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

// Metadata now lives on ExerciseDefinition, not the occurrence. makeExercise still
// accepts the old flat shape (name, equipmentType, etc.) for minimal test churn —
// it splits overrides into an occurrence + a definition, auto-registering the
// definition into a per-test registry that getDefinitions() hands to startWorkout.
let defCounter = 0;
let definitionsRegistry: Record<string, ExerciseDefinition> = {};

interface ExerciseTestOverrides extends Partial<Exercise> {
  name?: string;
  equipmentType?: EquipmentType;
  progressionRule?: ProgressionRule;
  isTimeBased?: boolean;
  isUnilateral?: boolean;
  currentWeight?: number;
  hardStreak?: number;
}

function makeExercise(overrides: ExerciseTestOverrides = {}): Exercise {
  const {
    name = "Bench Press",
    equipmentType = "barbell_45",
    progressionRule = "add_5lb",
    isTimeBased = false,
    isUnilateral = false,
    currentWeight = 135,
    hardStreak = 0,
    ...occurrenceOverrides
  } = overrides;

  const definitionId = occurrenceOverrides.definitionId ?? `def-${++defCounter}`;
  definitionsRegistry[definitionId] = {
    id: definitionId,
    name,
    muscleGroups: [],
    equipmentType,
    equipmentDetail: null,
    progressionRule,
    isUnilateral,
    isTimeBased,
    currentWeight,
    hardStreak,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    id: `ex-${++uuidCounter}`,
    definitionId,
    order: 1,
    phase: "main",
    sets: 3,
    repMin: 8,
    repMax: { type: "count", value: 12 },
    restSeconds: 120,
    notes: null,
    ...occurrenceOverrides,
  };
}

function getDefinitions(): Record<string, ExerciseDefinition> {
  return definitionsRegistry;
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "workout-1",
    programId: "test-program",
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
  defCounter = 0;
  definitionsRegistry = {};
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
      await result.current.startWorkout(makeWorkout(), getDefinitions());
    });
    expect(result.current.session).toBeNull();
  });

  // Regression: usePrograms() and useExerciseDefinitions() fetch in parallel
  // (see page.tsx), so definitions can still be stale/incomplete — missing an
  // id resolveExercise() needs — when the user clicks Start. That throw used
  // to propagate straight out of the onClick handler with no try/catch
  // anywhere in the chain: the button click would silently do nothing instead
  // of starting the workout or telling the user why.
  it("surfaces a startWorkout failure via showError instead of failing silently", () => {
    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    let returned: boolean | undefined;
    act(() => {
      // Empty definitions map: the workout's exercise references a
      // definitionId resolveExercise() won't find.
      returned = result.current.startWorkout(workout, {});
    });

    expect(result.current.session).toBeNull();
    expect(showErrorMock).toHaveBeenCalledTimes(1);
    expect(showErrorMock.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(returned).toBe(false);
  });

  it("creates session with correct initial state on startWorkout", async () => {
    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
    });

    expect(result.current.currentExercise).not.toBeNull();
    expect(result.current.currentExercise!.name).toBe("Squat");
  });

  it("adds completed set and starts rest timer on completeSet", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 60 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
    });

    act(() => {
      result.current.completeSet(10, 135, false, "normal");
    });

    // No rest timer, should advance directly
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  it("restAfter=false does not suppress between-set rest — that always uses restSeconds", async () => {
    // restAfter only governs the transition to the NEXT exercise. Rest between
    // this exercise's own sets always follows restSeconds, regardless of restAfter.
    const exercise = makeExercise({ sets: 3, restSeconds: 120, restAfter: false });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout, getDefinitions());
    });

    act(() => {
      result.current.completeSet(10, 135, false, "normal");
    });

    expect(result.current.session!.isResting).toBe(true);
    expect(result.current.session!.restTimeRemaining).toBeLessThanOrEqual(120);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  it("restAfter=false suppresses rest before the next exercise", async () => {
    const ex1 = makeExercise({ name: "Ex1", sets: 1, restSeconds: 120, restAfter: false, order: 1 });
    const ex2 = makeExercise({ name: "Ex2", sets: 1, restSeconds: 0, order: 2 });
    const workout = makeWorkout({ exercises: [ex1, ex2] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout, getDefinitions());
    });

    act(() => {
      result.current.completeSet(10, 135, false, "normal");
    });

    // Last (only) set of ex1 completed — restAfter=false skips the rest that
    // would otherwise precede moving into ex2.
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentExerciseIndex).toBe(1);
  });

  // ── rest-timer-behavior user story ──────────────────────────────────────

  it("story: rest between sets — completing set 1 of 3 starts a 45s timer, then shows set 2", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 45 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

    act(() => { result.current.completeSet(10, 135, false, "normal"); });

    expect(result.current.session!.isResting).toBe(true);
    expect(result.current.session!.restTimeRemaining).toBeLessThanOrEqual(45);
    expect(result.current.session!.currentSetNumber).toBe(2);

    act(() => { result.current.skipRest(); }); // simulate the countdown finishing
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  it("story: rest_after=false — completing the last set shows the next exercise immediately", async () => {
    const ex1 = makeExercise({ name: "Ex1", sets: 3, restSeconds: 45, restAfter: false, order: 1 });
    const ex2 = makeExercise({ name: "Ex2", sets: 1, restSeconds: 0, order: 2 });
    const workout = makeWorkout({ exercises: [ex1, ex2] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

    act(() => { result.current.completeSet(10, 135, false, "normal"); }); // set 1
    act(() => { result.current.skipRest(); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); }); // set 2
    act(() => { result.current.skipRest(); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); }); // set 3 — last

    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.session!.currentExerciseIndex).toBe(1);
    expect(result.current.currentExercise!.name).toBe("Ex2");
  });

  it("story: rest_after enabled (default) — completing the last set starts a 45s timer, then shows the next exercise", async () => {
    const ex1 = makeExercise({ name: "Ex1", sets: 3, restSeconds: 45, order: 1 });
    const ex2 = makeExercise({ name: "Ex2", sets: 1, restSeconds: 0, order: 2 });
    const workout = makeWorkout({ exercises: [ex1, ex2] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

    act(() => { result.current.completeSet(10, 135, false, "normal"); }); // set 1
    act(() => { result.current.skipRest(); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); }); // set 2
    act(() => { result.current.skipRest(); });
    act(() => { result.current.completeSet(10, 135, false, "normal"); }); // set 3 — last

    expect(result.current.session!.isResting).toBe(true);
    expect(result.current.session!.restTimeRemaining).toBeLessThanOrEqual(45);
    expect(result.current.session!.currentExerciseIndex).toBe(1); // position already advanced

    act(() => { result.current.skipRest(); }); // simulate the countdown finishing
    expect(result.current.session!.isResting).toBe(false);
    expect(result.current.currentExercise!.name).toBe("Ex2");
  });

  it("restAfter as a number overrides between-exercise rest but not between-set rest", async () => {
    // Between-set rest always uses restSeconds; restAfter=60 only changes
    // how long the timer runs when transitioning to the next exercise.
    const exercise = makeExercise({ sets: 3, restSeconds: 120, restAfter: 60 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => {
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
    });

    act(() => { result.current.updateSets(exercise.id, 5); });

    expect(result.current.session!.workout.exercises[0].sets).toBe(5);
  });

  // ── session-persistence user story ───────────────────────────────────────

  it("pauseWorkout moves session to pausedSession and clears session", async () => {
    const workout = makeWorkout();
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
    expect(result.current.session).not.toBeNull();

    act(() => { result.current.pauseWorkout(); });

    expect(result.current.session).toBeNull();
    expect(result.current.pausedSession).not.toBeNull();
  });

  it("pauseWorkout preserves currentSetNumber in pausedSession", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 120 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));

    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
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

    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
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

    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
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

    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
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
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
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
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

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
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
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
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
    act(() => { result.current.completeSet(30, 0, false, "normal"); });
    expect(result.current.session!.completedSets[0].isTimeBased).toBe(true);
  });

  // ── warm-up-phase-behavior user story ─────────────────────────────────────

  it("warmup exercise (restAfter=false) still rests between its own sets using restSeconds", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 60, restAfter: false });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
    act(() => { result.current.completeSet(10, 0, false, "normal"); });
    // restAfter=false only skips the transition into the NEXT exercise, not
    // rest between this warmup exercise's own sets.
    expect(result.current.session!.isResting).toBe(true);
    expect(result.current.session!.restTimeRemaining).toBeLessThanOrEqual(60);
    expect(result.current.session!.currentSetNumber).toBe(2);
  });

  // ── unilateral-exercises user story ────────────────────────────────────────

  it("isUnilateral=true does not affect set advancement or rest behavior", async () => {
    const exercise = makeExercise({ sets: 2, restSeconds: 0, isUnilateral: true });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
    act(() => { result.current.completeSet(12, 20, false, "normal"); });
    expect(result.current.session!.currentSetNumber).toBe(2);
    expect(result.current.session!.isResting).toBe(false);
  });

  it("completeSet stores per-side actualWeight for unilateral exercises", async () => {
    const exercise = makeExercise({ sets: 1, restSeconds: 0, isUnilateral: true });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });
    act(() => { result.current.completeSet(12, 25, false, "normal"); });
    // actualWeight is the per-side value as entered — not doubled
    expect(result.current.session!.completedSets[0].actualWeight).toBe(25);
  });

  // ── mid-workout-weight-editing user story ──────────────────────────────────

  it("previously completed sets retain original targetWeight after updateWeight", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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
      await result.current.startWorkout(workout, getDefinitions());
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

  // ── rating-driven progression engine wiring ────────────────────────────────

  it("an 'easy' rating live-bumps the weight for the next set of the same exercise", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0, progressionRule: "add_5lb", currentWeight: 100 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

    expect(result.current.currentWeight).toBe(100);

    act(() => { result.current.completeSet(10, 100, false, "easy"); });

    // Live bump applies to the very next set of this same exercise, immediately —
    // not just at the next session.
    expect(result.current.currentWeight).toBe(105);
  });

  it("a 'normal' rating does NOT live-bump the next set", async () => {
    const exercise = makeExercise({ sets: 3, restSeconds: 0, progressionRule: "add_5lb", currentWeight: 100 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

    act(() => { result.current.completeSet(10, 100, false, "normal"); });

    expect(result.current.currentWeight).toBe(100);
  });

  it("endWorkout writes the progression result back to the exercise's definition", async () => {
    const exercise = makeExercise({ sets: 1, restSeconds: 0, progressionRule: "add_5lb", currentWeight: 100, hardStreak: 0 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

    // Single exercise, single set — completing it ends the workout automatically.
    await act(async () => {
      result.current.completeSet(10, 100, false, "normal");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateExerciseDefinitionWeightMock).toHaveBeenCalledWith(
      "user-1", exercise.definitionId, 105, 0
    );
  });

  it("endWorkout does not write back when the progression rule has no numeric increment", async () => {
    const exercise = makeExercise({ sets: 1, restSeconds: 0, progressionRule: "maintain", currentWeight: 100 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

    await act(async () => {
      result.current.completeSet(10, 100, false, "normal");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateExerciseDefinitionWeightMock).not.toHaveBeenCalled();
  });

  it("endWorkout applies a 3rd consecutive hard rating as a weight drop", async () => {
    const exercise = makeExercise({ sets: 1, restSeconds: 0, progressionRule: "add_5lb", currentWeight: 100, hardStreak: 2 });
    const workout = makeWorkout({ exercises: [exercise] });
    const { result } = renderHook(() => useWorkout("user-1"));
    await act(async () => { await result.current.startWorkout(workout, getDefinitions()); });

    await act(async () => {
      result.current.completeSet(6, 100, false, "hard");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateExerciseDefinitionWeightMock).toHaveBeenCalledWith(
      "user-1", exercise.definitionId, 95, 0
    );
  });
});
