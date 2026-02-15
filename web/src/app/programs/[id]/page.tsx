"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePrograms } from "@/hooks/usePrograms";
import { ExerciseEditor } from "@/components/programs/ExerciseEditor";
import type { Exercise, Workout } from "@/lib/types";
import { PHASE_COLORS, DAY_ORDER, repTargetDisplay, formatRestTime, cleanWeight } from "@/lib/types";
import Link from "next/link";

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: programId } = use(params);
  const { user } = useAuth();
  const { programs, loadWorkoutsForWeek, updateWorkout } = usePrograms(user?.uid ?? null);

  const program = programs.find((p) => p.id === programId);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{ workout: Workout; exercise: Exercise | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ workoutId: string; exerciseId: string } | null>(null);

  useEffect(() => {
    if (!program) return;
    setLoadingWorkouts(true);
    loadWorkoutsForWeek(program.name, selectedWeek).then((wks) => {
      setWorkouts(wks);
      setLoadingWorkouts(false);
    });
  }, [program, selectedWeek, loadWorkoutsForWeek]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to access this page.</p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-400">Program not found.</p>
        <Link href="/settings" className="text-indigo-400 hover:text-indigo-300 text-sm">Back to Settings</Link>
      </div>
    );
  }

  // Sort workouts by DAY_ORDER
  const sortedWorkouts = [...workouts].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
  );

  async function handleSaveExercise(exercise: Exercise) {
    if (!editingExercise) return;
    const workout = editingExercise.workout;
    const isNew = !editingExercise.exercise;

    let updatedExercises: Exercise[];
    if (isNew) {
      updatedExercises = [...workout.exercises, exercise];
    } else {
      updatedExercises = workout.exercises.map((e) => e.id === exercise.id ? exercise : e);
    }

    // Sort by order
    updatedExercises.sort((a, b) => a.order - b.order);

    const updatedWorkout = { ...workout, exercises: updatedExercises };
    await updateWorkout(updatedWorkout);

    // Update local state
    setWorkouts((prev) => prev.map((w) => w.id === workout.id ? updatedWorkout : w));
    setEditingExercise(null);
  }

  async function handleDeleteExercise(workout: Workout, exerciseId: string) {
    const updatedExercises = workout.exercises.filter((e) => e.id !== exerciseId);
    const updatedWorkout = { ...workout, exercises: updatedExercises };
    await updateWorkout(updatedWorkout);
    setWorkouts((prev) => prev.map((w) => w.id === workout.id ? updatedWorkout : w));
    setConfirmDelete(null);
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-gray-400 hover:text-white transition">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{program.name}</h1>
      </div>

      {/* Week Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {Array.from({ length: program.totalWeeks }, (_, i) => i + 1).map((week) => (
          <button
            key={week}
            onClick={() => setSelectedWeek(week)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
              selectedWeek === week
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Week {week}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loadingWorkouts && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      )}

      {/* Workouts by Day */}
      {!loadingWorkouts && sortedWorkouts.length === 0 && (
        <p className="text-gray-500 text-center py-8">No workouts for this week.</p>
      )}

      {!loadingWorkouts && sortedWorkouts.map((workout) => (
        <div key={workout.id} className="mb-6">
          {/* Day Header */}
          <h2 className="text-lg font-bold text-gray-300 mb-3">{workout.dayOfWeek}</h2>

          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {workout.exercises
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((exercise) => {
                const phaseColor = PHASE_COLORS[exercise.phase] || "bg-gray-600";
                const weightDisplay = exercise.baseWeight.type === "progressive"
                  ? "Progressive"
                  : exercise.baseWeight.value > 0
                    ? `${cleanWeight(exercise.baseWeight.value)} lbs`
                    : exercise.equipmentType === "bodyweight"
                      ? "BW"
                      : exercise.equipmentDetail || exercise.equipmentType.replace(/_/g, " ");

                return (
                  <div key={exercise.id} className="px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${phaseColor}`} />
                          <span className="font-semibold truncate">{exercise.name}</span>
                          {exercise.isUnilateral && (
                            <span className="text-orange-400 text-xs">ES</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {exercise.sets} x {repTargetDisplay(exercise.repMin, exercise.repMax, exercise)}
                          {" | "}{weightDisplay}
                          {exercise.restSeconds > 0 && <> | {formatRestTime(exercise.restSeconds)} rest</>}
                        </div>
                        {exercise.notes && (
                          <div className="text-xs text-gray-600 mt-1 truncate">{exercise.notes}</div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => setEditingExercise({ workout, exercise })}
                          className="text-gray-600 hover:text-indigo-400 transition p-1"
                          title="Edit exercise"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ workoutId: workout.id, exerciseId: exercise.id })}
                          className="text-gray-600 hover:text-red-400 transition p-1"
                          title="Delete exercise"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Delete Confirmation */}
                    {confirmDelete?.workoutId === workout.id && confirmDelete?.exerciseId === exercise.id && (
                      <div className="mt-2 bg-red-950/30 border border-red-800/40 rounded-lg p-2">
                        <p className="text-xs text-gray-300 mb-2">Remove {exercise.name}?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteExercise(workout, exercise.id)}
                            className="px-2 py-1 text-xs bg-red-600 rounded hover:bg-red-500 font-semibold transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Add Exercise */}
            <div className="px-4 py-3">
              <button
                onClick={() => setEditingExercise({ workout, exercise: null })}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition"
              >
                + Add Exercise
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Exercise Editor Modal */}
      {editingExercise && (
        <ExerciseEditor
          exercise={editingExercise.exercise}
          maxOrder={Math.max(0, ...editingExercise.workout.exercises.map((e) => e.order))}
          onSave={handleSaveExercise}
          onCancel={() => setEditingExercise(null)}
        />
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-around">
          <Link href="/" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/history" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-xs mt-1">History</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
