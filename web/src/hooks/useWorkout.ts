"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Workout, ActiveSession, CompletedSet, PRResult } from "@/lib/types";
import { resolveWeightWithMeta, getProgressionIncrement, adjustForEquipment } from "@/lib/progression-service";
import { checkForPRs } from "@/lib/pr-detector";
import { saveSession } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useSound } from "./useSound";

export interface MissReductionPrompt {
  exerciseId: string;
  exerciseName: string;
  fromWeight: number;
  toWeight: number;
}

export interface EasyPromptData {
  exerciseId: string;
  exerciseName: string;
  /** Weight used for set 1 of this exercise (the session base weight). */
  fromWeight: number;
  /** Proposed next-session weight (2x increment). */
  toWeight: number;
}

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
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [pausedSession, setPausedSession] = useState<ActiveSession | null>(null);
  const [showHardPrompt, setShowHardPrompt] = useState(false);
  const [missReductionQueue, setMissReductionQueue] = useState<MissReductionPrompt[]>([]);
  const [easyPrompt, setEasyPrompt] = useState<EasyPromptData | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restEndRef = useRef<Date | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pendingHardRef = useRef<{ exerciseId: string } | null>(null);
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
              // Timer expired while away — advance state
              setSession((prev) => {
                if (!prev) return prev;
                const exercise = prev.workout.exercises[prev.currentExerciseIndex];
                const setsRemaining = exercise.sets - prev.currentSetNumber;

                if (setsRemaining > 0) {
                  return { ...prev, isResting: false, currentSetNumber: prev.currentSetNumber + 1 };
                } else if (prev.currentExerciseIndex < prev.workout.exercises.length - 1) {
                  return { ...prev, isResting: false, currentExerciseIndex: prev.currentExerciseIndex + 1, currentSetNumber: 1 };
                }
                return { ...prev, isResting: false };
              });
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
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // WakeLock request can fail (e.g., low battery)
      }
    }

    async function releaseWakeLock() {
      try {
        await wakeLockRef.current?.release();
        wakeLockRef.current = null;
      } catch {
        // Ignore release errors
      }
    }

    if (session) {
      requestWakeLock();

      // Re-acquire on visibility change (WakeLock is released when tab is hidden)
      function handleVisibilityChange() {
        if (document.visibilityState === "visible" && session) {
          requestWakeLock();
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

    // Resolve all progressive weights, collecting any auto-reductions to prompt about
    const resolvedWeights: Record<string, number> = {};
    const reductions: MissReductionPrompt[] = [];
    for (const exercise of workout.exercises) {
      const meta = await resolveWeightWithMeta(userId, exercise);
      resolvedWeights[exercise.id] = meta.weight;
      if (meta.reason === "reduced_2x_miss" && meta.prevWeight !== null) {
        reductions.push({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          fromWeight: meta.prevWeight,
          toWeight: meta.weight,
        });
      }
    }

    setMissReductionQueue(reductions);
    setEasyPrompt(null);
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
    const remaining = Math.max(0, Math.round((endDate.getTime() - Date.now()) / 1000));
    restEndRef.current = endDate;

    setSession((prev) => prev ? { ...prev, isResting: true, restTimeRemaining: remaining } : prev);

    timerRef.current = setInterval(() => {
      const rem = Math.max(0, Math.round((endDate.getTime() - Date.now()) / 1000));
      setSession((prev) => prev ? { ...prev, restTimeRemaining: rem } : prev);

      if (rem <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        restEndRef.current = null;
        playTimerComplete();

        setSession((prev) => {
          if (!prev) return prev;
          const exercise = prev.workout.exercises[prev.currentExerciseIndex];
          const setsRemaining = exercise.sets - prev.currentSetNumber;

          if (setsRemaining > 0) {
            return { ...prev, isResting: false, currentSetNumber: prev.currentSetNumber + 1 };
          } else if (prev.currentExerciseIndex < prev.workout.exercises.length - 1) {
            return { ...prev, isResting: false, currentExerciseIndex: prev.currentExerciseIndex + 1, currentSetNumber: 1 };
          } else {
            return { ...prev, isResting: false };
          }
        });
      }
    }, 1000);
  }

  function startRestTimer(seconds: number) {
    const endDate = new Date(Date.now() + seconds * 1000);
    startRestTimerFromEnd(endDate);
  }

  const completeSet = useCallback((actualReps: number, actualWeight: number, failed: boolean, rating: "easy" | "normal" | "hard", notes?: string) => {
    if (!session || !currentExercise) return;

    const targetReps = currentExercise.repMax.type === "count" ? currentExercise.repMax.value : currentExercise.repMin;

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
    };

    playSetComplete();

    const newSets = [...session.completedSets, completedSet];
    const setsCompletedNow = session.currentSetNumber; // set N was just completed
    const setsRemaining = currentExercise.sets - setsCompletedNow;

    // Mid-workout weight adjustments based on rating
    let updatedWeights = session.resolvedWeights;
    if (rating === "easy" && setsRemaining > 0) {
      const increment = getProgressionIncrement(currentExercise);
      if (increment > 0) {
        const newWeight = adjustForEquipment(currentWeight + increment, currentExercise);
        updatedWeights = { ...updatedWeights, [currentExercise.id]: newWeight };
      }
    }

    const updatedSession = { ...session, completedSets: newSets, resolvedWeights: updatedWeights };

    // If rated hard, show prompt before proceeding (only if sets remain)
    if (rating === "hard" && setsRemaining > 0) {
      pendingHardRef.current = { exerciseId: currentExercise.id };
      // Between-set rest uses restSeconds; restAfter only governs the transition to the next exercise.
      const betweenSetRest = currentExercise.restSeconds;
      if (betweenSetRest > 0) {
        setSession(updatedSession);
        startRestTimer(betweenSetRest);
      } else {
        setSession({ ...updatedSession, currentSetNumber: session.currentSetNumber + 1 });
      }
      setShowHardPrompt(true);
      return;
    }

    // After last set of exercise: prompt if all reps met and rated easy
    if (setsRemaining === 0 && rating === "easy" && !failed && actualReps >= currentExercise.repMin) {
      const exerciseSetsInSession = newSets.slice(newSets.length - currentExercise.sets);
      const allRepsMet = exerciseSetsInSession.every(
        (s) => s.completed && s.actualReps >= currentExercise.repMin
      );
      const increment = getProgressionIncrement(currentExercise);
      if (allRepsMet && increment > 0) {
        const baseWeight = exerciseSetsInSession[0]?.actualWeight ?? currentWeight;
        const proposed = adjustForEquipment(baseWeight + increment * 2, currentExercise);
        setEasyPrompt({
          exerciseId: currentExercise.id,
          exerciseName: currentExercise.name,
          fromWeight: baseWeight,
          toWeight: proposed,
        });
      }
    }

    // Between-set rest uses restSeconds directly; restAfter only applies to the
    // transition between exercises (it may suppress or override that timer).
    const betweenSetRest = currentExercise.restSeconds;
    const betweenExerciseRest = effectiveRestSeconds(currentExercise);
    if (setsRemaining > 0) {
      if (betweenSetRest > 0) {
        setSession(updatedSession);
        startRestTimer(betweenSetRest);
      } else {
        setSession({ ...updatedSession, currentSetNumber: session.currentSetNumber + 1 });
      }
    } else if (session.currentExerciseIndex < session.workout.exercises.length - 1) {
      if (betweenExerciseRest > 0) {
        setSession(updatedSession);
        startRestTimer(betweenExerciseRest);
      } else {
        setSession({ ...updatedSession, currentExerciseIndex: session.currentExerciseIndex + 1, currentSetNumber: 1 });
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
      targetReps: currentExercise.repMax.type === "count" ? currentExercise.repMax.value : currentExercise.repMin,
      actualReps: 0,
      completed: false,
      timestamp: Timestamp.now(),
      notes: "Skipped",
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

    setSession((prev) => {
      if (!prev) return prev;
      const exercise = prev.workout.exercises[prev.currentExerciseIndex];
      const setsRemaining = exercise.sets - prev.currentSetNumber;

      if (setsRemaining > 0) {
        return { ...prev, isResting: false, currentSetNumber: prev.currentSetNumber + 1 };
      } else if (prev.currentExerciseIndex < prev.workout.exercises.length - 1) {
        return { ...prev, isResting: false, currentExerciseIndex: prev.currentExerciseIndex + 1, currentSetNumber: 1 };
      }
      return { ...prev, isResting: false };
    });
  }, []);

  async function endWorkoutInternal(sets: CompletedSet[]) {
    if (!session || !userId) return;

    // Check PRs
    const exerciseNames = [...new Set(sets.map((s) => s.exerciseName))];
    const allPRs: PRResult[] = [];
    for (const name of exerciseNames) {
      const setsForExercise = sets.filter((s) => s.exerciseName === name);
      const prs = await checkForPRs(userId, name, setsForExercise);
      allPRs.push(...prs);
    }

    const duration = Math.round((Date.now() - session.startTime.getTime()) / 1000);

    await saveSession(userId, {
      programName: session.workout.programName,
      week: session.workout.week,
      dayOfWeek: session.workout.dayOfWeek,
      date: Timestamp.now(),
      completed: true,
      durationSeconds: duration,
      sets,
    });

    clearPersistedSession();
    setSession((prev) => prev ? { ...prev, prsAchieved: allPRs } : prev);
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

  const updateSets = useCallback((exerciseId: string, newSets: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const exercises = prev.workout.exercises.map((e) =>
        e.id === exerciseId ? { ...e, sets: newSets } : e
      );
      return { ...prev, workout: { ...prev.workout, exercises } };
    });
  }, []);

  /** User responds to the "felt easy, increase next session?" prompt. */
  const handleEasyDecision = useCallback((action: "increase" | "standard") => {
    setEasyPrompt(null);
    if (action === "standard") {
      // Downgrade the last easy-rated set for this exercise to "normal"
      // so resolveWeight next session applies +1x instead of +2x
      if (!easyPrompt) return;
      setSession((prev) => {
        if (!prev) return prev;
        // Find the last set for this exercise rated "easy"
        const sets = [...prev.completedSets];
        for (let i = sets.length - 1; i >= 0; i--) {
          if (sets[i].exerciseName === easyPrompt.exerciseName && sets[i].rating === "easy") {
            sets[i] = { ...sets[i], rating: "normal" };
            break;
          }
        }
        return { ...prev, completedSets: sets };
      });
    }
  }, [easyPrompt]);

  /** User responds to the "missed 2x, weight reduced" prompt. */
  const handleMissReductionDecision = useCallback((action: "accept" | "keep") => {
    const prompt = missReductionQueue[0];
    if (!prompt) return;
    if (action === "keep") {
      setSession((prev) => prev ? {
        ...prev,
        resolvedWeights: { ...prev.resolvedWeights, [prompt.exerciseId]: prompt.fromWeight },
      } : prev);
    }
    setMissReductionQueue((prev) => prev.slice(1));
  }, [missReductionQueue]);

  const handleHardWeightDecision = useCallback((action: "keep" | "reduce") => {
    setShowHardPrompt(false);
    if (!session || !pendingHardRef.current) return;

    if (action === "reduce") {
      const exerciseId = pendingHardRef.current.exerciseId;
      const exercise = session.workout.exercises.find((e) => e.id === exerciseId);
      if (exercise) {
        const increment = getProgressionIncrement(exercise);
        if (increment > 0) {
          const currentWt = session.resolvedWeights[exerciseId] ?? 0;
          const reduced = adjustForEquipment(Math.max(0, currentWt - increment), exercise);
          setSession((prev) => prev ? {
            ...prev,
            resolvedWeights: { ...prev.resolvedWeights, [exerciseId]: reduced },
          } : prev);
        }
      }
    }

    pendingHardRef.current = null;
  }, [session]);

  return {
    session,
    pausedSession,
    currentExercise,
    currentWeight,
    setsCompletedForCurrent,
    isCurrentSetAmrap,
    showHardPrompt,
    missReductionQueue,
    easyPrompt,
    startWorkout,
    completeSet,
    skipSet,
    skipRest,
    endWorkout,
    dismissWorkout,
    pauseWorkout,
    resumeWorkout,
    updateWeight,
    updateSets,
    handleHardWeightDecision,
    handleEasyDecision,
    handleMissReductionDecision,
  };
}
