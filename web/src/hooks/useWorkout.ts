"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Workout, ActiveSession, CompletedSet, PRResult } from "@/lib/types";
import { resolveWeightWithMeta } from "@/lib/progression-service";
import { checkForPRs } from "@/lib/pr-detector";
import { saveSession } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useSound } from "./useSound";
import { useError } from "@/components/providers/ErrorProvider";

// Returns the effective rest duration in seconds for an exercise.
// restAfter === false → 0 (no rest timer); restAfter is a number → use it;
// otherwise fall back to restSeconds.
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
  const [pausedSession, setPausedSession] = useState<ActiveSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingSaveRef = useRef<{ sets: CompletedSet[]; prs: PRResult[]; duration: number; date: import("firebase/firestore").Timestamp } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restEndRef = useRef<Date | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
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
          // in an active, visible session.
          sentinel.addEventListener("release", () => {
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
      try {
        await wakeLockRef.current?.release();
        wakeLockRef.current = null;
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startWorkout = useCallback(async (workout: Workout) => {
    if (!userId) return;
    initAudio();

    const resolvedWeights: Record<string, number> = {};
    for (const exercise of workout.exercises) {
      const { weight } = await resolveWeightWithMeta(userId, exercise);
      resolvedWeights[exercise.id] = weight;
    }

    setSession({
      workout,
      resolvedWeights,
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      completedSets: [],
      isResting: false,
      restTimeRemaining: 0,
      startTime: new Date(),
      prsAchieved: [],
    });
  }, [userId, initAudio]);

  const currentExercise = session?.workout.exercises[session.currentExerciseIndex] ?? null;
  const currentWeight = currentExercise ? (session?.resolvedWeights[currentExercise.id] ?? 0) : 0;

  const setsCompletedForCurrent = session ? session.currentSetNumber - 1 : 0;

  // True when the current set is the final AMRAP set of an exercise flagged with lastSetAmrap
  const isCurrentSetAmrap = Boolean(
    currentExercise?.lastSetAmrap &&
    session &&
    session.currentSetNumber === currentExercise.sets
  );

  function startRestTimerFromEnd(endDate: Date) {
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
        // Only flip the resting flag — position in the workout is already correct.
        setSession((prev) => prev ? { ...prev, isResting: false, restTimeRemaining: 0 } : prev);
      }
    }, 1000);
  }

  function startRestTimer(seconds: number) {
    const endDate = new Date(Date.now() + seconds * 1000);
    startRestTimerFromEnd(endDate);
  }

  const completeSet = useCallback((actualReps: number, actualWeight: number, failed: boolean, rating: "easy" | "normal" | "hard", notes?: string) => {
    if (!session || !currentExercise) return;

    const targetReps =
      currentExercise.repMax.type === "count" &&
      !(currentExercise.lastSetAmrap && session.currentSetNumber === currentExercise.sets)
        ? currentExercise.repMax.value
        : currentExercise.repMin;

    const completedSet: CompletedSet = {
      id: crypto.randomUUID(),
      exerciseName: currentExercise.name,
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
    };

    playSetComplete();

    const newSets = [...session.completedSets, completedSet];
    const setsCompletedNow = session.currentSetNumber; // set N was just completed
    const setsRemaining = currentExercise.sets - setsCompletedNow;

    const updatedSession = { ...session, completedSets: newSets };

    // restAfter controls only the between-exercise rest (after the final set).
    // restAfter === false suppresses it; a number overrides the duration.
    // Between-set rest always uses restSeconds regardless of restAfter.
    // IMPORTANT: always advance the position in state FIRST, then start the
    // rest timer. The timer only flips isResting → false; it never moves
    // currentSetNumber or currentExerciseIndex. This prevents double-advance
    // bugs caused by stale closures or rapid state updates.
    const betweenSetRest = currentExercise.restSeconds;
    const betweenExerciseRest = effectiveRestSeconds(currentExercise);
    if (setsRemaining > 0) {
      const nextSession = { ...updatedSession, currentSetNumber: session.currentSetNumber + 1 };
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
  }, [session, currentExercise, currentWeight, playSetComplete]);

  const skipSet = useCallback(() => {
    if (!session || !currentExercise) return;

    const skipped: CompletedSet = {
      id: crypto.randomUUID(),
      exerciseName: currentExercise.name,
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
  }, [session, currentExercise, currentWeight]);

  const skipRest = useCallback(() => {
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
    if (!session || !userId) return;

    setSaveError(null);
    setIsSaving(true);

    // PR detection is best-effort — don't let it block the save
    let allPRs: PRResult[] = [];
    try {
      const exerciseNames = [...new Set(sets.map((s) => s.exerciseName))];
      for (const name of exerciseNames) {
        const setsForExercise = sets.filter((s) => s.exerciseName === name);
        const prs = await checkForPRs(userId, name, setsForExercise);
        allPRs.push(...prs);
      }
    } catch (err) {
      showError(err); // Show but proceed — PR failure must not block the save
    }

    const duration = Math.round((Date.now() - session.startTime.getTime()) / 1000);
    const saveDate = Timestamp.now();
    pendingSaveRef.current = { sets, prs: allPRs, duration, date: saveDate };

    try {
      await saveSession(userId, {
        programName: session.workout.programName,
        week: session.workout.week,
        dayOfWeek: session.workout.dayOfWeek,
        date: saveDate,
        completed: true,
        durationSeconds: duration,
        sets,
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
    if (!session) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await endWorkoutInternal(session.completedSets);
  }, [session, userId]);

  const dismissWorkout = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    clearPersistedSession();
    setPausedSession(null);
    setSession(null);
  }, []);

  const pauseWorkout = useCallback(() => {
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
    setSession((prev) => prev ? {
      ...prev,
      resolvedWeights: { ...prev.resolvedWeights, [exerciseId]: newWeight },
    } : prev);
  }, []);

  const retrySave = useCallback(async () => {
    if (!session || !userId || !pendingSaveRef.current) return;
    const { sets, prs, duration, date } = pendingSaveRef.current;
    setSaveError(null);
    setIsSaving(true);
    try {
      await saveSession(userId, {
        programName: session.workout.programName,
        week: session.workout.week,
        dayOfWeek: session.workout.dayOfWeek,
        date,
        completed: true,
        durationSeconds: duration,
        sets,
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
  };
}