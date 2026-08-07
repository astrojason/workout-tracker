"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePrograms } from "@/hooks/usePrograms";
import { useEquipmentConfig } from "@/hooks/useEquipmentConfig";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { ExerciseEditor, type ExerciseEditorResult } from "@/components/programs/ExerciseEditor";
import { createExerciseDefinition, updateExerciseDefinitionWeight } from "@/lib/firestore";
import type { Exercise, Workout } from "@/lib/types";
import { PHASE_COLORS, DAY_ORDER, repTargetDisplay, formatRestTime, exerciseWeightDisplay, isChecklistWorkout, resolveWorkout, resolveExercise } from "@/lib/types";
import { formatWeekAsText } from "@/lib/week-export";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useError } from "@/components/providers/ErrorProvider";

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: programId } = use(params);
  const { user } = useAuth();
  const { programs, loading: programsLoading, loadWorkoutsForWeek, updateWorkout } = usePrograms(user?.uid ?? null);
  const { config: equipmentConfig } = useEquipmentConfig(user?.uid ?? null);
  const { definitions, loading: definitionsLoading, reload: reloadDefinitions } = useExerciseDefinitions(user?.uid ?? null);
  const { showError } = useError();

  // usePrograms() and useExerciseDefinitions() fetch independently and in parallel.
  // Re-fetch definitions once usePrograms settles (including its one-time exercise-
  // library migration), so a definitions read that resolved before migration
  // finished doesn't leave this page working from stale/empty data.
  useEffect(() => {
    if (!programsLoading) reloadDefinitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programsLoading]);

  const program = programs.find((p) => p.id === programId);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{ workout: Workout; exercise: Exercise | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ workoutId: string; exerciseId: string } | null>(null);
  const [weekCopied, setWeekCopied] = useState(false);

  useEffect(() => {
    if (!program) return;
    setLoadingWorkouts(true);
    loadWorkoutsForWeek(program.id, selectedWeek).then(async (wks) => {
      const fixed = await Promise.all(
        wks.map(async (w) => {
          const sorted = [...w.exercises].sort((a, b) => a.order - b.order);
          const hasDuplicates = sorted.some((e, i) => i > 0 && sorted[i - 1].order === e.order);
          if (!hasDuplicates) return w;
          const normalized = sorted.map((e, i) => ({ ...e, order: i + 1 }));
          const updated = { ...w, exercises: normalized };
          await updateWorkout(updated);
          return updated;
        })
      );
      setWorkouts(fixed);
      setLoadingWorkouts(false);
    });
  }, [program, selectedWeek, loadWorkoutsForWeek, updateWorkout]);

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

  async function handleSaveExercise(result: ExerciseEditorResult) {
    if (!editingExercise || !user) return;
    const workout = editingExercise.workout;
    const isNew = !editingExercise.exercise;

    let exercise: Exercise;
    if (result.kind === "new") {
      const definitionId = await createExerciseDefinition(user.uid, result.definition);
      exercise = { ...result.occurrence, definitionId };
    } else {
      exercise = result.occurrence;
      const def = definitions[result.definitionId];
      if (def && result.weight !== def.currentWeight) {
        await updateExerciseDefinitionWeight(user.uid, result.definitionId, result.weight, def.hardStreak);
      }
    }
    await reloadDefinitions();

    let updatedExercises: Exercise[];
    if (isNew) {
      // Shift any existing exercises at or after the chosen order down by 1
      const hasConflict = workout.exercises.some((e) => e.order === exercise.order);
      const shifted = hasConflict
        ? workout.exercises.map((e) => e.order >= exercise.order ? { ...e, order: e.order + 1 } : e)
        : workout.exercises;
      updatedExercises = [...shifted, exercise];
    } else {
      // Shift other exercises that conflict with the new order
      const hasConflict = workout.exercises.some((e) => e.id !== exercise.id && e.order === exercise.order);
      const shifted = hasConflict
        ? workout.exercises.map((e) => e.id !== exercise.id && e.order >= exercise.order ? { ...e, order: e.order + 1 } : e)
        : workout.exercises;
      updatedExercises = shifted.map((e) => e.id === exercise.id ? exercise : e);
    }

    // Sort by order
    updatedExercises.sort((a, b) => a.order - b.order);

    const updatedWorkout = { ...workout, exercises: updatedExercises };
    await updateWorkout(updatedWorkout);

    // Update local state
    setWorkouts((prev) => prev.map((w) => w.id === workout.id ? updatedWorkout : w));
    setEditingExercise(null);
  }

  async function handleCopyWeek() {
    let text: string;
    try {
      text = formatWeekAsText(program!.name, selectedWeek, sortedWorkouts.map((w) => resolveWorkout(w, definitions)));
    } catch (err) {
      showError(err);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setWeekCopied(true);
      setTimeout(() => setWeekCopied(false), 2000);
    } catch {
      // non-critical: Clipboard API unavailable or permission denied — no fallback needed
    }
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
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
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
        <button
          onClick={handleCopyWeek}
          disabled={sortedWorkouts.length === 0}
          className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 transition"
        >
          {weekCopied ? "Copied!" : "Copy Week"}
        </button>
      </div>

      {/* Loading */}
      {(loadingWorkouts || definitionsLoading) && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      )}

      {/* Workouts by Day */}
      {!loadingWorkouts && !definitionsLoading && sortedWorkouts.length === 0 && (
        <p className="text-gray-500 text-center py-8">No workouts for this week.</p>
      )}

      {!loadingWorkouts && !definitionsLoading && sortedWorkouts.map((workout) => (
        <div key={workout.id} className="mb-6">
          {/* Day Header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-300">{workout.dayOfWeek}</h2>
            <button
              onClick={async () => {
                const updatedWorkout = { ...workout, isChecklist: !isChecklistWorkout(workout) };
                await updateWorkout(updatedWorkout);
                setWorkouts((prev) => prev.map((w) => w.id === workout.id ? updatedWorkout : w));
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                isChecklistWorkout(workout)
                  ? "bg-green-900/40 text-green-400 border border-green-800/50"
                  : "bg-gray-800 text-gray-500 border border-gray-700"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Checklist
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {workout.exercises
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((rawExercise) => {
                // A definitionId with no matching definition (e.g. pre-exercise-library
                // data that hasn't been through the migration script) must not crash
                // this whole list — show it as a row the user can still delete.
                let exercise;
                try {
                  exercise = resolveExercise(rawExercise, definitions);
                } catch (err) {
                  return (
                    <div key={rawExercise.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
                          <span className="font-semibold text-red-400">Unresolved exercise</span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {err instanceof Error ? err.message : String(err)}
                        </div>
                      </div>
                      <button
                        onClick={() => setConfirmDelete({ workoutId: workout.id, exerciseId: rawExercise.id })}
                        className="text-gray-600 hover:text-red-400 transition p-1 shrink-0"
                        title="Delete exercise"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                }
                const phaseColor = PHASE_COLORS[exercise.phase] || "bg-gray-600";
                const weightDisplay = exerciseWeightDisplay(exercise);

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
          definitions={Object.values(definitions)}
          onSave={handleSaveExercise}
          onCancel={() => setEditingExercise(null)}
          equipmentConfig={equipmentConfig}
        />
      )}

      {/* Delete Exercise Modal */}
      {confirmDelete && (() => {
        const workout = workouts.find((w) => w.id === confirmDelete.workoutId);
        const rawExercise = workout?.exercises.find((e) => e.id === confirmDelete.exerciseId);
        const exerciseName = rawExercise ? definitions[rawExercise.definitionId]?.name : undefined;
        return rawExercise && workout ? (
          <ConfirmDeleteModal
            title="Delete Exercise"
            message={`Remove "${exerciseName ?? "this exercise"}" from this workout?`}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => handleDeleteExercise(workout, rawExercise.id)}
          />
        ) : null;
      })()}

      <BottomNav active={null} />
    </div>
  );
}
