"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Workout, Exercise, ActiveSession, CompletedSet, PRResult } from "@/lib/types";
import { resolveWeight } from "@/lib/progression-service";
import { getEquipmentDisplay } from "@/lib/equipment-calculator";
import { checkForPRs } from "@/lib/pr-detector";
import { saveSession } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useSound } from "./useSound";

export function useWorkout(userId: string | null) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restEndRef = useRef<Date | null>(null);
  const { playTimerComplete, playSetComplete, initAudio } = useSound();

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

  function startRestTimer(seconds: number) {
    const endDate = new Date(Date.now() + seconds * 1000);
    restEndRef.current = endDate;

    setSession((prev) => prev ? { ...prev, isResting: true, restTimeRemaining: seconds } : prev);

    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endDate.getTime() - Date.now()) / 1000));
      setSession((prev) => prev ? { ...prev, restTimeRemaining: remaining } : prev);

      if (remaining <= 0) {
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

  const completeSet = useCallback((actualReps: number, actualWeight: number, failed: boolean, notes?: string) => {
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
    };

    playSetComplete();

    const newSets = [...session.completedSets, completedSet];
    const setsCompletedNow = newSets.filter((s) => s.exerciseOrder === currentExercise.order).length;
    const setsRemaining = currentExercise.sets - setsCompletedNow;

    if (setsRemaining > 0) {
      if (currentExercise.restSeconds > 0) {
        setSession({ ...session, completedSets: newSets });
        startRestTimer(currentExercise.restSeconds);
      } else {
        setSession({ ...session, completedSets: newSets, currentSetNumber: session.currentSetNumber + 1 });
      }
    } else if (session.currentExerciseIndex < session.workout.exercises.length - 1) {
      if (currentExercise.restSeconds > 0) {
        setSession({ ...session, completedSets: newSets });
        startRestTimer(currentExercise.restSeconds);
      } else {
        setSession({ ...session, completedSets: newSets, currentExerciseIndex: session.currentExerciseIndex + 1, currentSetNumber: 1 });
      }
    } else {
      // Last exercise, last set
      setSession({ ...session, completedSets: newSets });
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
    setSession(null);
  }, []);

  return {
    session,
    currentExercise,
    currentWeight,
    setsCompletedForCurrent,
    startWorkout,
    completeSet,
    skipSet,
    skipRest,
    endWorkout,
    dismissWorkout,
  };
}
