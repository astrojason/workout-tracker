"use client";

import { useState, useEffect, useCallback } from "react";
import type { Workout, CompletedSet, WorkoutSessionDoc, Exercise } from "@/lib/types";
import { repTargetDisplay, isTimeBased, formatTimeValue } from "@/lib/types";
import { getTodayChecklistSession, upsertChecklistSession } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useSound } from "@/hooks/useSound";
import { useError } from "@/components/providers/ErrorProvider";

interface ChecklistWorkoutProps {
  workout: Workout;
  userId: string;
  onClose: () => void;
}

export function ChecklistWorkout({ workout, userId, onClose }: ChecklistWorkoutProps) {
  const [completedOrders, setCompletedOrders] = useState<Set<number>>(new Set());
  const [firestoreId, setFirestoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimer, setActiveTimer] = useState<Exercise | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerTotal, setTimerTotal] = useState(0);
  const [timerSide, setTimerSide] = useState<1 | 2>(1);
  const [showSwitchSides, setShowSwitchSides] = useState(false);

  const { playTimerComplete, initAudio } = useSound();
  const { showError } = useError();

  // Load today's session on mount
  useEffect(() => {
    async function load() {
      try {
        const existing = await getTodayChecklistSession(userId, workout.programName, workout.dayOfWeek);
        if (existing) {
          setFirestoreId(existing.firestoreId);
          const orders = new Set(existing.sets.filter((s) => s.completed).map((s) => s.exerciseOrder));
          setCompletedOrders(orders);
        }
      } catch (err) {
        showError(err);
      }
      setLoading(false);
    }
    load();
  }, [userId, workout.programName, workout.dayOfWeek]);

  // Countdown tick
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimerRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const saveToFirestore = useCallback(async (orders: Set<number>) => {
    const sets: CompletedSet[] = [];
    for (const exercise of workout.exercises) {
      if (!orders.has(exercise.order)) continue;
      for (let s = 1; s <= exercise.sets; s++) {
        const targetReps = exercise.repMax.type === "count" ? exercise.repMax.value : exercise.repMin;
        sets.push({
          id: `${exercise.id}-${s}`,
          exerciseName: exercise.name,
          exerciseOrder: exercise.order,
          setNumber: s,
          targetWeight: 0,
          actualWeight: 0,
          targetReps,
          actualReps: targetReps,
          completed: true,
          timestamp: Timestamp.now(),
          notes: null,
          rating: "normal",
        });
      }
    }

    const session: Omit<WorkoutSessionDoc, "id"> = {
      programName: workout.programName,
      week: workout.week,
      dayOfWeek: workout.dayOfWeek,
      date: Timestamp.now(),
      completed: orders.size === workout.exercises.length,
      durationSeconds: 0,
      sets,
    };

    try {
      const id = await upsertChecklistSession(userId, firestoreId, session);
      if (!firestoreId) setFirestoreId(id);
    } catch (err) {
      showError(err);
    }
  }, [workout, userId, firestoreId, showError]);

  const toggleExercise = useCallback(async (order: number) => {
    const next = new Set(completedOrders);
    if (next.has(order)) {
      next.delete(order);
    } else {
      next.add(order);
    }
    setCompletedOrders(next);
    await saveToFirestore(next);
  }, [completedOrders, saveToFirestore]);

  // Handle timer completion — placed after toggleExercise to avoid TDZ error
  const timerCompleteRef = useCallback(() => {
    if (!activeTimer) return;
    setTimerRunning(false);
    playTimerComplete();
    if (activeTimer.isUnilateral && timerSide === 1) {
      setTimerSide(2);
      setShowSwitchSides(true);
    } else {
      const order = activeTimer.order;
      setTimerSide(1);
      setShowSwitchSides(false);
      setActiveTimer(null);
      toggleExercise(order);
    }
  }, [activeTimer, playTimerComplete, toggleExercise, timerSide]);

  useEffect(() => {
    if (timerRunning && timerRemaining === 0 && activeTimer) {
      timerCompleteRef();
    }
  }, [timerRemaining, timerRunning, activeTimer, timerCompleteRef]);

  const handleExerciseTap = useCallback((exercise: Exercise) => {
    const isChecked = completedOrders.has(exercise.order);
    if (isChecked || !isTimeBased(exercise) || exercise.repMin <= 0) {
      toggleExercise(exercise.order);
    } else {
      initAudio();
      setTimerSide(1);
      setShowSwitchSides(false);
      setTimerTotal(exercise.repMin);
      setTimerRemaining(exercise.repMin);
      setTimerRunning(true);
      setActiveTimer(exercise);
    }
  }, [completedOrders, toggleExercise, initAudio]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const checkedCount = completedOrders.size;
  const totalCount = workout.exercises.length;
  const progress = (checkedCount / totalCount) * 100;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div>
          <div className="font-bold">{workout.programName}</div>
          <div className="text-sm text-gray-400">{workout.dayOfWeek}</div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-2 transition"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 pt-2">
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {checkedCount} of {totalCount} completed
        </p>
      </div>

      {/* Exercise List */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {workout.exercises.map((exercise) => {
          const checked = completedOrders.has(exercise.order);
          return (
            <button
              key={exercise.id}
              onClick={() => handleExerciseTap(exercise)}
              className={`w-full text-left p-4 rounded-xl border transition ${
                checked
                  ? "bg-green-950/30 border-green-800/50"
                  : "bg-gray-900 border-gray-800 hover:border-gray-700"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition ${
                  checked ? "bg-green-600 border-green-600" : "border-gray-600"
                }`}>
                  {checked && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Exercise Info */}
                <div className={`flex-1 ${checked ? "opacity-50" : ""}`}>
                  <div className="font-semibold flex items-center gap-2">
                    {exercise.name}
                    {exercise.isUnilateral && (
                      <span className="text-orange-400 text-sm">ES</span>
                    )}
                    {isTimeBased(exercise) && !checked && (
                      <span className="text-teal-400 text-xs">⏱</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {exercise.sets > 1 && `${exercise.sets} sets × `}
                    {repTargetDisplay(exercise.repMin, exercise.repMax, exercise)}
                  </div>
                  {exercise.notes && (
                    <div className="text-xs text-gray-500 mt-1">{exercise.notes}</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Exercise Timer Overlay */}
      {activeTimer && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
          <div className="text-center px-6 w-full max-w-sm">
            <p className="text-lg font-semibold mb-1">{activeTimer.name}</p>

            {showSwitchSides ? (
              <>
                <p className="text-teal-400 text-xs font-bold tracking-widest mb-6">SWITCH SIDES</p>
                <p className="text-6xl mb-4">↔</p>
                <p className="text-gray-300 mb-10">Side 1 done — get set for Side 2</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowSwitchSides(false); setTimerSide(1); setActiveTimer(null); toggleExercise(activeTimer.order); }}
                    className="flex-1 px-6 py-3 rounded-full bg-gray-800 hover:bg-gray-700 font-semibold transition"
                  >
                    Skip Side 2
                  </button>
                  <button
                    onClick={() => { setShowSwitchSides(false); setTimerRemaining(timerTotal); setTimerRunning(true); }}
                    className="flex-1 px-6 py-3 rounded-full bg-teal-600 hover:bg-teal-500 font-bold transition"
                  >
                    Start Side 2
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-teal-400 text-xs font-bold tracking-widest mb-1">EXERCISE TIMER</p>
                {activeTimer.isUnilateral && (
                  <p className="text-gray-400 text-xs mb-4">Side {timerSide} of 2</p>
                )}

                <div className="text-7xl font-bold font-mono mb-8">
                  {formatTimeValue(timerRemaining)}
                </div>

                <div className="flex justify-center mb-10">
                  <svg width="140" height="140" className="-rotate-90">
                    <circle cx="70" cy="70" r="62" fill="none" stroke="#1f2937" strokeWidth="7" />
                    <circle
                      cx="70" cy="70" r="62" fill="none"
                      stroke="#14b8a6" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 62}`}
                      strokeDashoffset={`${2 * Math.PI * 62 * (1 - timerRemaining / timerTotal)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setTimerRunning(false); setActiveTimer(null); setTimerSide(1); }}
                    className="flex-1 px-6 py-3 rounded-full bg-gray-800 hover:bg-gray-700 font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setTimerRunning(false);
                      const order = activeTimer.order;
                      setActiveTimer(null);
                      setTimerSide(1);
                      toggleExercise(order);
                    }}
                    className="flex-1 px-6 py-3 rounded-full bg-teal-600 hover:bg-teal-500 font-semibold transition"
                  >
                    Done Early
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
