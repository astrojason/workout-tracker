"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  Workout, ActiveSession, CompletedSet, PRResult, UserEquipmentConfig, ExerciseDefinition,
  WorkoutSessionDoc,
} from "@/lib/types";
import { resolveWorkout } from "@/lib/types";
import type { ProgressionChange } from "@/lib/types";
import { computeNextWeight, liveEasyBump } from "@/lib/progression-service";
import { rampWarmups } from "@/lib/warmup-ramp";
import { currentSetView } from "@/lib/inserted-set";
import { nextSetSummary } from "@/lib/next-set";
import { checkForPRs } from "@/lib/pr-detector";
import { saveSession, updateProgramExerciseWeight } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useSound } from "./useSound";
import { useError } from "@/components/providers/ErrorProvider";
import { useNativeMirror } from "./useNativeMirror";
import { notifyRestComplete } from "@/lib/rest-notifications";
import { buildPreviousPerformanceMap, seedAssistedWeights } from "@/lib/last-performance";

// Returns the rest duration in seconds before moving to the NEXT exercise.
// restAfter === false → 0 (no rest); restAfter is a number → use it;
// otherwise fall back to restSeconds. Not used for between-set rest, which
// always uses restSeconds directly.
function effectiveRestSeconds(exercise: { restSeconds: number; restAfter?: false | number }): number {
  if (exercise.restAfter === false) return 0;
  if (typeof exercise.restAfter === "number") return exercise.restAfter;
  return exercise.restSeconds;
}

const STORAGE_KEY = "activeWorkout";
const REST_END_KEY = "activeWorkoutRestEnd";
const PAUSED_KEY = "workoutPaused";

// Serialization helpers for localStorage (survives tab/browser close)
function serializeSession(session: ActiveSession): string {
  return JSON.stringify({
    ...session,
    ended: undefined, // a restored session is active again, with no pending save to retry
    startTime: session.startTime.toISOString(),
    completedSets: session.completedSets.map((s) => ({
      ...s,
      timestamp: s.timestamp instanceof Timestamp
        ? s.timestamp.toDate().toISOString()
        : s.timestamp instanceof Date
          ? s.timestamp.toISOString()
          : s.timestamp,
    })),
  });
}

function deserializeSession(json: string): ActiveSession | null {
  try {
    const data = JSON.parse(json);
    return {
      ...data,
      startTime: new Date(data.startTime),
      completedSets: data.completedSets.map((s: Record<string, unknown>) => ({
        ...s,
        timestamp: Timestamp.fromDate(new Date(s.timestamp as string)),
      })),
    };
  } catch {
    return null;
  }
}

function persistSession(session: ActiveSession | null, restEnd: Date | null) {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, serializeSession(session));
      if (restEnd) {
        localStorage.setItem(REST_END_KEY, restEnd.toISOString());
      } else {
        localStorage.removeItem(REST_END_KEY);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(REST_END_KEY);
    }
  } catch {
    // localStorage may be unavailable
  }
}

function clearPersistedSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REST_END_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

export function useWorkout(userId: string | null) {
  const { showError } = useError();
  const [session, setSession] = useState<ActiveSession | null>(null);
  // Latest session, for callbacks that fire later (the rest-complete notification).
  const sessionRef = useRef<ActiveSession | null>(null);
  sessionRef.current = session;
  useNativeMirror(session);
  const [pausedSession, setPausedSession] = useState<ActiveSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // True once endWorkoutInternal has started, so repeated taps can't save duplicate sessions.
  const endingRef = useRef(false);
  const pendingSaveRef = useRef<{ sets: CompletedSet[]; prs: PRResult[]; duration: number; date: import("firebase/firestore").Timestamp; progressionChanges: ProgressionChange[] } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationGenerationRef = useRef(0);
  const restEndRef = useRef<Date | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Captured at startWorkout, read again at endWorkout for progression's equipment rounding.
  const equipmentConfigRef = useRef<UserEquipmentConfig | undefined>(undefined);
  const { playTimerComplete, playSetComplete, initAudio } = useSound();

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const restored = deserializeSession(saved);
        if (restored) {
          const isPaused = localStorage.getItem(PAUSED_KEY) === "1";
          if (isPaused) {
            // User intentionally paused — show resume banner, don't auto-resume
            setPausedSession(restored);
            return;
          }

          setSession(restored);

          // Restore rest timer if active
          const restEndStr = localStorage.getItem(REST_END_KEY);
          if (restEndStr && restored.isResting) {
            const restEnd = new Date(restEndStr);
            const remaining = Math.max(0, Math.round((restEnd.getTime() - Date.now()) / 1000));
            if (remaining > 0) {
              // Timer still has time — restart it
              restEndRef.current = restEnd;
              startRestTimerFromEnd(restEnd);
            } else {
              // Timer expired while away — state was already advanced before
              // the rest timer started, so just clear the resting flag.
              setSession((prev) =>
                prev ? { ...prev, isResting: false, restTimeRemaining: 0 } : prev
              );
            }
          }
        }
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Persist session to localStorage on every change
  useEffect(() => {
    persistSession(session, restEndRef.current);
  }, [session]);

  // WakeLock management
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator && session) {
          const sentinel = await navigator.wakeLock.request("screen");
          wakeLockRef.current = sentinel;
          // Some browsers release the lock spontaneously (not just on
          // visibilitychange, e.g. low battery) — reacquire if we're still
          // in an active, visible session. Only do this for *unexpected*
          // releases: if wakeLockRef.current no longer points at this
          // sentinel, we already released it intentionally (releaseWakeLock
          // clears the ref before calling release()) and must not fight
          // that by requesting a new lock right as we're tearing down.
          sentinel.addEventListener("release", () => {
            if (wakeLockRef.current !== sentinel) return;
            wakeLockRef.current = null;
            if (document.visibilityState === "visible" && session) {
              requestWakeLock();
            }
          });
        }
      } catch {
        // non-critical: WakeLock is a best-effort enhancement, safe to ignore failures
      }
    }

    async function releaseWakeLock() {
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      try {
        await sentinel?.release();
      } catch {
        // non-critical: releasing is best-effort cleanup
      }
    }

    if (session) {
      requestWakeLock();

      // Re-acquire on visibility change (WakeLock is released when tab is hidden).
      // Also resync the rest timer immediately: a backgrounded tab can have its
      // interval throttled/suspended past the rest duration, so waiting for the
      // next tick could leave the countdown and completion sound stale for a
      // while after the user returns.
      function handleVisibilityChange() {
        if (document.visibilityState === "visible" && session) {
          requestWakeLock();
          if (restEndRef.current) {
            startRestTimerFromEnd(restEndRef.current);
          }
        }
      }
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        releaseWakeLock();
      };
    } else {
      releaseWakeLock();
    }
  }, [!!session]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      notificationGenerationRef.current++;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Returns whether the workout actually started, so callers (the Start
  // Workout button) can tell a real failure apart from success and release
  // their own loading state instead of getting stuck. definitions can still be
  // stale/incomplete when this runs (usePrograms and useExerciseDefinitions
  // fetch in parallel — see page.tsx), so resolveWorkout can throw; without
  // this try/catch that throw propagated straight out of the onClick handler
  // and the button silently did nothing.
  const startWorkout = useCallback((
    workout: Workout,
    definitions: Record<string, ExerciseDefinition>,
    equipmentConfig?: UserEquipmentConfig,
    previousSessions: WorkoutSessionDoc[] = [],
  ): boolean => {
    if (!userId) return false;
    endingRef.current = false;
    try {
      initAudio();
      equipmentConfigRef.current = equipmentConfig;

      const baseWorkout = resolveWorkout(workout, definitions);
      const resolvedWorkout = { ...baseWorkout, exercises: rampWarmups(baseWorkout.exercises, equipmentConfig) };
      const resolvedWeights: Record<string, number> = {};
      for (const exercise of resolvedWorkout.exercises) {
        resolvedWeights[exercise.id] = exercise.currentWeight;
      }

      const previousPerformances = buildPreviousPerformanceMap(resolvedWorkout.exercises, previousSessions);
      Object.assign(resolvedWeights, seedAssistedWeights(resolvedWorkout.exercises, previousPerformances));

      setSession({
        workout: resolvedWorkout,
        resolvedWeights,
        previousPerformances,
        currentExerciseIndex: 0,
        currentSetNumber: 1,
        completedSets: [],
        isResting: false,
        restTimeRemaining: 0,
        startTime: new Date(),
        prsAchieved: [],
      });
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  }, [userId, initAudio, showError]);

  const currentView = session ? currentSetView(session) : null;
  const currentExercise = currentView?.exercise ?? null;
  const currentWeight = currentView?.weight ?? 0;
  const onInsertedSet = currentView?.isInserted ?? false;

  const setsCompletedForCurrent = session ? session.currentSetNumber - 1 : 0;

  // True when the current set is the final AMRAP set of an exercise flagged with lastSetAmrap
  const isCurrentSetAmrap = Boolean(
    currentExercise?.lastSetAmrap &&
    session &&
    session.currentSetNumber === currentExercise.sets
  );

  function startRestTimerFromEnd(endDate: Date) {
    const generation = ++notificationGenerationRef.current;
    function notify() {
      void notifyRestComplete(
        () => notificationGenerationRef.current === generation,
        () => (sessionRef.current ? nextSetSummary(sessionRef.current) : null),
      ).catch(showError);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const remaining = Math.max(0, Math.round((endDate.getTime() - Date.now()) / 1000));
    restEndRef.current = endDate;

    // Already past the end time — e.g. resyncing after a backgrounded tab's
    // interval was throttled past the rest duration. Complete immediately
    // rather than waiting for a tick that may be a while away.
    if (remaining <= 0) {
      restEndRef.current = null;
      playTimerComplete();
      notify();
      setSession((prev) => prev ? { ...prev, isResting: false, restTimeRemaining: 0 } : prev);
      return;
    }

    // NOTE: State (currentSetNumber / currentExerciseIndex) must already be
    // advanced by the caller before startRestTimerFromEnd is invoked.
    // The timer only flips isResting → false when it expires; it never
    // advances exercise/set counters itself, eliminating double-advance bugs.
    setSession((prev) => prev ? { ...prev, isResting: true, restTimeRemaining: remaining } : prev);

    timerRef.current = setInterval(() => {
      const rem = Math.max(0, Math.round((endDate.getTime() - Date.now()) / 1000));
      setSession((prev) => prev ? { ...prev, restTimeRemaining: rem } : prev);

      if (rem <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        restEndRef.current = null;
        playTimerComplete();
        notify();
        // Only flip the resting flag — position in the workout is already correct.
        setSession((prev) => prev ? { ...prev, isResting: false, restTimeRemaining: 0 } : prev);
      }
    }, 1000);
  }

  function startRestTimer(seconds: number) {
    const endDate = new Date(Date.now() + seconds * 1000);
    startRestTimerFromEnd(endDate);
  }

  const completeSet = useCallback((actualReps: number, actualWeight: number, failed: boolean, givenRating: "easy" | "normal" | "hard", notes?: string) => {
    if (!session || !currentExercise) return;

    // AMRAP sets are hard by design, so their rating never counts: always recorded as hard
    // (which also means an AMRAP set never live-bumps the next set's weight).
    const isAmrapSet = currentExercise.repMax.type === "failure" ||
      (currentExercise.lastSetAmrap === true && session.currentSetNumber === currentExercise.sets);
    const rating = isAmrapSet ? "hard" : givenRating;

    const targetReps =
      currentExercise.repMax.type === "count" &&
      !(currentExercise.lastSetAmrap && session.currentSetNumber === currentExercise.sets)
        ? currentExercise.repMax.value
        : currentExercise.repMin;

    const completedSet: CompletedSet = {
      id: crypto.randomUUID(),
      exerciseName: currentExercise.name,
      definitionId: currentExercise.definitionId,
      exerciseOrder: currentExercise.order,
      setNumber: session.currentSetNumber,
      targetWeight: currentWeight,
      actualWeight,
      targetReps,
      actualReps,
      completed: !failed,
      timestamp: Timestamp.now(),
      notes: notes || null,
      rating,
      isTimeBased: currentExercise.isTimeBased,
      equipmentType: currentExercise.equipmentType,
      equipmentDetail: currentExercise.equipmentDetail ?? null,
      phase: currentExercise.phase,
    };

    playSetComplete();

    const newSets = [...session.completedSets, completedSet];
    const setsCompletedNow = session.currentSetNumber; // set N was just completed
    const setsRemaining = currentExercise.sets - setsCompletedNow;

    const updatedSession = { ...session, completedSets: newSets };

    // restAfter only governs the transition into the NEXT exercise (used e.g.
    // to let warmup exercises flow into each other without pausing). Rest
    // between this exercise's own sets always follows restSeconds, regardless
    // of restAfter.
    // IMPORTANT: always advance the position in state FIRST, then start the
    // rest timer. The timer only flips isResting → false; it never moves
    // currentSetNumber or currentExerciseIndex. This prevents double-advance
    // bugs caused by stale closures or rapid state updates.
    const betweenSetRest = currentExercise.restSeconds;
    const betweenExerciseRest = effectiveRestSeconds(currentExercise);
    if (onInsertedSet && setsRemaining > 0) {
      // The planned set this custom set pushed back is next, at the plan's own weight:
      // a custom set's weight or rating never carries into it.
      setSession({ ...updatedSession, insertedSet: undefined, currentSetNumber: session.currentSetNumber + 1 });
      if (betweenSetRest > 0) startRestTimer(betweenSetRest);
    } else if (onInsertedSet && session.currentExerciseIndex < session.workout.exercises.length - 1) {
      // An extra set added after the exercise finished: carry on to the next exercise.
      setSession({ ...updatedSession, insertedSet: undefined, currentExerciseIndex: session.currentExerciseIndex + 1, currentSetNumber: 1 });
      if (betweenExerciseRest > 0) startRestTimer(betweenExerciseRest);
    } else if (onInsertedSet) {
      setSession({ ...updatedSession, insertedSet: undefined });
      endWorkoutInternal(newSets);
    } else if (setsRemaining > 0) {
      // The weight just logged (edited in the set dialog or not) carries into
      // the next set of this exercise; for assisted exercises that's the band count.
      // Live autoregulation: an "easy" set also bumps it for the very next set,
      // right now — separate from (and in addition to) the end-of-session
      // progression write-back below.
      const loggedWeight = actualWeight > 0 ? actualWeight : currentWeight;
      const nextWeight = rating === "easy" ? liveEasyBump(loggedWeight, currentExercise, equipmentConfigRef.current) : loggedWeight;
      const bumpedWeights = { ...updatedSession.resolvedWeights, [currentExercise.id]: nextWeight };
      const nextSession = { ...updatedSession, resolvedWeights: bumpedWeights, currentSetNumber: session.currentSetNumber + 1 };
      if (betweenSetRest > 0) {
        setSession(nextSession);
        startRestTimer(betweenSetRest);
      } else {
        setSession(nextSession);
      }
    } else if (session.currentExerciseIndex < session.workout.exercises.length - 1) {
      const nextSession = { ...updatedSession, currentExerciseIndex: session.currentExerciseIndex + 1, currentSetNumber: 1 };
      if (betweenExerciseRest > 0) {
        setSession(nextSession);
        startRestTimer(betweenExerciseRest);
      } else {
        setSession(nextSession);
      }
    } else {
      // Last exercise, last set
      setSession(updatedSession);
      endWorkoutInternal(newSets);
    }
  }, [session, currentExercise, currentWeight, onInsertedSet, playSetComplete]);

  const skipSet = useCallback(() => {
    if (!session || !currentExercise) return;

    if (onInsertedSet) {
      // Skipping a custom set just takes it back out; there's nothing planned to record.
      const exercises = session.workout.exercises.map((e) =>
        e.id === currentExercise.id ? { ...e, sets: Math.max(1, e.sets - 1) } : e
      );
      const removed = { ...session, insertedSet: undefined, workout: { ...session.workout, exercises } };
      // An extra set after the exercise was done: go back to where we were, the next exercise.
      const wasExtra = session.currentSetNumber > currentExercise.sets - 1;
      setSession(wasExtra && session.currentExerciseIndex < exercises.length - 1
        ? { ...removed, currentExerciseIndex: session.currentExerciseIndex + 1, currentSetNumber: 1 }
        : removed);
      return;
    }

    const skipped: CompletedSet = {
      id: crypto.randomUUID(),
      exerciseName: currentExercise.name,
      definitionId: currentExercise.definitionId,
      exerciseOrder: currentExercise.order,
      setNumber: session.currentSetNumber,
      targetWeight: currentWeight,
      actualWeight: 0,
      targetReps:
        currentExercise.repMax.type === "count" &&
        !(currentExercise.lastSetAmrap && session.currentSetNumber === currentExercise.sets)
          ? currentExercise.repMax.value
          : currentExercise.repMin,
      actualReps: 0,
      completed: false,
      timestamp: Timestamp.now(),
      notes: "Skipped",
      isTimeBased: currentExercise.isTimeBased,
      equipmentType: currentExercise.equipmentType,
      equipmentDetail: currentExercise.equipmentDetail ?? null,
      phase: currentExercise.phase,
      skipped: true,
    };

    const newSets = [...session.completedSets, skipped];
    const setsCompletedNow = session.currentSetNumber; // set N was just skipped
    const setsRemaining = currentExercise.sets - setsCompletedNow;

    if (setsRemaining > 0) {
      setSession({ ...session, completedSets: newSets, currentSetNumber: session.currentSetNumber + 1 });
    } else if (session.currentExerciseIndex < session.workout.exercises.length - 1) {
      setSession({ ...session, completedSets: newSets, currentExerciseIndex: session.currentExerciseIndex + 1, currentSetNumber: 1 });
    } else {
      setSession({ ...session, completedSets: newSets });
      endWorkoutInternal(newSets);
    }
  }, [session, currentExercise, currentWeight, onInsertedSet]);

  const skipRest = useCallback(() => {
    notificationGenerationRef.current++;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    restEndRef.current = null;
    // State (currentSetNumber / currentExerciseIndex) was already advanced when
    // the rest timer started — just flip the resting flag.
    setSession((prev) => prev ? { ...prev, isResting: false, restTimeRemaining: 0 } : prev);
  }, []);

  async function endWorkoutInternal(sets: CompletedSet[]) {
    if (!session || !userId || endingRef.current) return;
    endingRef.current = true;

    setSaveError(null);
    setIsSaving(true);
    // Show the summary immediately, even if no PR is achieved and sets remain.
    setSession((prev) => prev ? { ...prev, ended: true, isResting: false, restTimeRemaining: 0 } : prev);

    // PR detection is best-effort — don't let it block the save
    let allPRs: PRResult[] = [];
    try {
      // Warmup sets aren't attempts at a record — a 45x10 warmup must not pad the volume PR.
      const warmupOrders = new Set(
        session.workout.exercises.filter((e) => e.phase === "warmup").map((e) => e.order),
      );
      const workingSets = sets.filter((s) => !warmupOrders.has(s.exerciseOrder));
      const exerciseNames = [...new Set(workingSets.map((s) => s.exerciseName))];
      for (const name of exerciseNames) {
        const setsForExercise = workingSets.filter((s) => s.exerciseName === name);
        const prs = await checkForPRs(userId, name, setsForExercise);
        allPRs.push(...prs);
      }
    } catch (err) {
      showError(err); // Show but proceed — PR failure must not block the save
    }

    // Progression is best-effort too — for each exercise occurrence, run the
    // rating/AMRAP-driven engine against the LAST set logged for it this session
    // and write the result back to this workout's program (every occurrence of that
    // exercise within the program resolves to the new weight going forward; other
    // programs keep their own).
    // Historical CompletedSet records above are never touched.
    // Remembered on the session so deleting it can restore the weights it changed. An
    // exercise appearing twice writes twice from the same start, so keep the first
    // `before` and the last `after`.
    const changes = new Map<string, ProgressionChange>();
    try {
      for (const exercise of session.workout.exercises) {
        // A warm-up is lighter than the work set by design; it must never move a weight.
        if (exercise.phase === "warmup") continue;
        const setsForExercise = sets.filter((s) => s.exerciseOrder === exercise.order);
        if (setsForExercise.length === 0) continue;
        const finalSet = setsForExercise.reduce((a, b) => (b.setNumber > a.setNumber ? b : a));
        const previousAt = session.previousPerformances?.[exercise.id]?.performedAt;
        const daysSincePrevious = previousAt === undefined
          ? undefined
          : Math.floor((session.startTime.getTime() - previousAt) / 86_400_000);
        const result = computeNextWeight(exercise, finalSet, equipmentConfigRef.current, daysSincePrevious);
        if (result.currentWeight === exercise.currentWeight && result.hardStreak === exercise.hardStreak) continue;
        await updateProgramExerciseWeight(userId, session.workout.programId, exercise.definitionId, result.currentWeight, result.hardStreak);
        const after = { currentWeight: result.currentWeight, hardStreak: result.hardStreak };
        const earlier = changes.get(exercise.definitionId);
        changes.set(exercise.definitionId, {
          definitionId: exercise.definitionId,
          before: earlier?.before ?? { currentWeight: exercise.currentWeight, hardStreak: exercise.hardStreak },
          after,
        });
      }
    } catch (err) {
      showError(err); // Show but proceed — progression failure must not block the save
    }

    const duration = Math.round((Date.now() - session.startTime.getTime()) / 1000);
    const saveDate = Timestamp.now();
    const progressionChanges = [...changes.values()];
    pendingSaveRef.current = { sets, prs: allPRs, duration, date: saveDate, progressionChanges };

    try {
      await saveSession(userId, {
        programId: session.workout.programId,
        programName: session.workout.programName,
        week: session.workout.week,
        dayOfWeek: session.workout.dayOfWeek,
        date: saveDate,
        completed: true,
        durationSeconds: duration,
        sets,
        progressionChanges,
      });
      pendingSaveRef.current = null;
      clearPersistedSession();
      setIsSaving(false);
      setSession((prev) => prev ? { ...prev, prsAchieved: allPRs } : prev);
    } catch (err) {
      showError(err); // Show full error in modal
      // Don't clear localStorage — session survives for retry
      setIsSaving(false);
      setSaveError("Save failed — use Retry Save to try again.");
    }
  }

  const endWorkout = useCallback(async () => {
    notificationGenerationRef.current++;
    restEndRef.current = null;
    if (!session) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await endWorkoutInternal(session.completedSets);
  }, [session, userId]);

  const dismissWorkout = useCallback(() => {
    notificationGenerationRef.current++;
    restEndRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    clearPersistedSession();
    endingRef.current = false;
    setPausedSession(null);
    setSession(null);
  }, []);

  const pauseWorkout = useCallback(() => {
    notificationGenerationRef.current++;
    if (!session) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    restEndRef.current = null;
    // Save session without resting state so resume starts cleanly at current set
    const paused = { ...session, isResting: false };
    try {
      localStorage.setItem(STORAGE_KEY, serializeSession(paused));
      localStorage.removeItem(REST_END_KEY);
      localStorage.setItem(PAUSED_KEY, "1");
    } catch { /* localStorage unavailable */ }
    setPausedSession(paused);
    setSession(null);
  }, [session]);

  const resumeWorkout = useCallback(() => {
    if (!pausedSession) return;
    try {
      localStorage.removeItem(PAUSED_KEY);
    } catch { /* localStorage unavailable */ }
    setSession(pausedSession);
    setPausedSession(null);
  }, [pausedSession]);

  const updateWeight = useCallback((exerciseId: string, newWeight: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      // During a custom set the weight editor changes that set, not the plan.
      if (prev.insertedSet?.exerciseId === exerciseId) {
        return { ...prev, insertedSet: { ...prev.insertedSet, weight: newWeight } };
      }
      return { ...prev, resolvedWeights: { ...prev.resolvedWeights, [exerciseId]: newWeight } };
    });
  }, []);

  // One more set of the exercise just finished (e.g. working up to a work weight), done before
  // the next exercise. Only offered until the next exercise's first set is logged; a rest
  // that's already running keeps running.
  const canAddAnotherSet = Boolean(
    session && !session.insertedSet && session.currentExerciseIndex > 0 && session.currentSetNumber === 1 &&
    !session.completedSets.some((s) => s.exerciseOrder === session.workout.exercises[session.currentExerciseIndex].order)
  );
  const addAnotherSet = useCallback((reps: number, weight: number) => {
    setSession((prev) => {
      if (!prev || prev.insertedSet || prev.currentExerciseIndex === 0 || prev.currentSetNumber !== 1) return prev;
      const current = prev.workout.exercises[prev.currentExerciseIndex];
      if (prev.completedSets.some((s) => s.exerciseOrder === current.order)) return prev;
      const index = prev.currentExerciseIndex - 1;
      const finished = prev.workout.exercises[index];
      const exercises = prev.workout.exercises.map((e, i) => (i === index ? { ...e, sets: e.sets + 1 } : e));
      return {
        ...prev,
        workout: { ...prev.workout, exercises },
        currentExerciseIndex: index,
        currentSetNumber: finished.sets + 1,
        insertedSet: { exerciseId: finished.id, reps, weight },
      };
    });
  }, []);

  // Adds a custom set at the current position; the planned current set becomes the next one.
  const insertSet = useCallback((reps: number, weight: number) => {
    setSession((prev) => {
      if (!prev || prev.insertedSet) return prev;
      const exercise = prev.workout.exercises[prev.currentExerciseIndex];
      if (!exercise) return prev;
      const exercises = prev.workout.exercises.map((e) => (e.id === exercise.id ? { ...e, sets: e.sets + 1 } : e));
      return {
        ...prev,
        workout: { ...prev.workout, exercises },
        insertedSet: { exerciseId: exercise.id, reps, weight },
      };
    });
  }, []);

  const retrySave = useCallback(async () => {
    if (!session || !userId || !pendingSaveRef.current) return;
    const { sets, prs, duration, date, progressionChanges } = pendingSaveRef.current;
    setSaveError(null);
    setIsSaving(true);
    try {
      await saveSession(userId, {
        programId: session.workout.programId,
        programName: session.workout.programName,
        week: session.workout.week,
        dayOfWeek: session.workout.dayOfWeek,
        date,
        completed: true,
        durationSeconds: duration,
        sets,
        progressionChanges,
      });
      pendingSaveRef.current = null;
      clearPersistedSession();
      setIsSaving(false);
      setSession((prev) => prev ? { ...prev, prsAchieved: prs } : prev);
    } catch (err) {
      showError(err);
      setIsSaving(false);
      setSaveError("Save failed — use Retry Save to try again.");
    }
  }, [session, userId]);

  const updateSets = useCallback((exerciseId: string, newSets: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.workout.exercises.map((e) =>
        e.id === exerciseId ? { ...e, sets: newSets } : e
      );
      const updated = { ...prev, workout: { ...prev.workout, exercises } };

      // If the current exercise's set count drops below the current set number,
      // advance to the next exercise immediately (no rest timer).
      const isCurrent = prev.workout.exercises[prev.currentExerciseIndex]?.id === exerciseId;
      if (isCurrent && newSets < prev.currentSetNumber) {
        if (prev.currentExerciseIndex < prev.workout.exercises.length - 1) {
          return {
            ...updated,
            currentExerciseIndex: prev.currentExerciseIndex + 1,
            currentSetNumber: 1,
            isResting: false,
          };
        }
      }

      return updated;
    });
  }, []);

  return {
    session,
    pausedSession,
    isSaving,
    saveError,
    currentExercise,
    currentWeight,
    setsCompletedForCurrent,
    isCurrentSetAmrap,
    startWorkout,
    completeSet,
    skipSet,
    skipRest,
    endWorkout,
    dismissWorkout,
    pauseWorkout,
    resumeWorkout,
    retrySave,
    updateWeight,
    updateSets,
    insertSet,
    isInsertedSet: onInsertedSet,
    canAddAnotherSet,
    addAnotherSet,
  };
}
