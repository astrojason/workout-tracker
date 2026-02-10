"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Workout, Exercise, ActiveSession, CompletedSet, PRResult } from "@/lib/types";
import { resolveWeight, getProgressionIncrement, adjustForEquipment } from "@/lib/progression-service";
import { checkForPRs } from "@/lib/pr-detector";
import { saveSession } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useSound } from "./useSound";

const STORAGE_KEY = "activeWorkout";
const REST_END_KEY = "activeWorkoutRestEnd";

// Serialization helpers for sessionStorage
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
      sessionStorage.setItem(STORAGE_KEY, serializeSession(session));
      if (restEnd) {
        sessionStorage.setItem(REST_END_KEY, restEnd.toISOString());
      } else {
        sessionStorage.removeItem(REST_END_KEY);
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(REST_END_KEY);
    }
  } catch {
    // sessionStorage may be unavailable
  }
}

function clearPersistedSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(REST_END_KEY);
  } catch {
    // sessionStorage may be unavailable
  }
}

export function useWorkout(userId: string | null) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [showHardPrompt, setShowHardPrompt] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restEndRef = useRef<Date | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pendingHardRef = useRef<{ exerciseId: string } | null>(null);
  const { playTimerComplete, playSetComplete, initAudio } = useSound();

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const restored = deserializeSession(saved);
        if (restored) {
          setSession(restored);

          // Restore rest timer if active
          const restEndStr = sessionStorage.getItem(REST_END_KEY);
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
                const completed = prev.completedSets.filter((s) => s.exerciseOrder === exercise.order).length;
                const setsRemaining = exercise.sets - completed;

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
      // sessionStorage unavailable
    }
  }, []);

  // Persist session to sessionStorage on every change
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

    // Resolve all progressive weights
    const resolvedWeights: Record<string, number> = {};
    for (const exercise of workout.exercises) {
      resolvedWeights[exercise.id] = await resolveWeight(userId, exercise);
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

  const setsCompletedForCurrent = session
    ? session.completedSets.filter((s) => s.exerciseOrder === currentExercise?.order).length
    : 0;

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
          const completed = prev.completedSets.filter((s) => s.exerciseOrder === exercise.order).length;
          const setsRemaining = exercise.sets - completed;

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
    const setsCompletedNow = newSets.filter((s) => s.exerciseOrder === currentExercise.order).length;
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
      if (currentExercise.restSeconds > 0) {
        setSession(updatedSession);
        startRestTimer(currentExercise.restSeconds);
      } else {
        setSession({ ...updatedSession, currentSetNumber: session.currentSetNumber + 1 });
      }
      setShowHardPrompt(true);
      return;
    }

    if (setsRemaining > 0) {
      if (currentExercise.restSeconds > 0) {
        setSession(updatedSession);
        startRestTimer(currentExercise.restSeconds);
      } else {
        setSession({ ...updatedSession, currentSetNumber: session.currentSetNumber + 1 });
      }
    } else if (session.currentExerciseIndex < session.workout.exercises.length - 1) {
      if (currentExercise.restSeconds > 0) {
        setSession(updatedSession);
        startRestTimer(currentExercise.restSeconds);
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
    const setsCompletedNow = newSets.filter((s) => s.exerciseOrder === currentExercise.order).length;
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
      const completed = prev.completedSets.filter((s) => s.exerciseOrder === exercise.order).length;
      const setsRemaining = exercise.sets - completed;

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
    setSession(null);
  }, []);

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
    currentExercise,
    currentWeight,
    setsCompletedForCurrent,
    showHardPrompt,
    startWorkout,
    completeSet,
    skipSet,
    skipRest,
    endWorkout,
    dismissWorkout,
    handleHardWeightDecision,
  };
}
