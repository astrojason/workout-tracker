"use client";

import { useState, useEffect, useCallback } from "react";
import type { Workout, CompletedSet, WorkoutSessionDoc } from "@/lib/types";
import { repTargetDisplay, isTimeBased } from "@/lib/types";
import { getTodayChecklistSession, upsertChecklistSession } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";

interface ChecklistWorkoutProps {
  workout: Workout;
  userId: string;
  onClose: () => void;
}

export function ChecklistWorkout({ workout, userId, onClose }: ChecklistWorkoutProps) {
  const [completedOrders, setCompletedOrders] = useState<Set<number>>(new Set());
  const [firestoreId, setFirestoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load today's session on mount
  useEffect(() => {
    async function load() {
      const existing = await getTodayChecklistSession(userId, workout.programName, workout.dayOfWeek);
      if (existing) {
        setFirestoreId(existing.firestoreId);
        const orders = new Set(existing.sets.filter((s) => s.completed).map((s) => s.exerciseOrder));
        setCompletedOrders(orders);
      }
      setLoading(false);
    }
    load();
  }, [userId, workout.programName, workout.dayOfWeek]);

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

    const id = await upsertChecklistSession(userId, firestoreId, session);
    if (!firestoreId) setFirestoreId(id);
  }, [workout, userId, firestoreId]);

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
              onClick={() => toggleExercise(exercise.order)}
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
                  <div className="font-semibold">
                    {exercise.name}
                    {exercise.isUnilateral && (
                      <span className="text-orange-400 text-sm ml-2">ES</span>
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
    </div>
  );
}
