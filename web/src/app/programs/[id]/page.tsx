"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePrograms } from "@/hooks/usePrograms";
import { useEquipmentConfig } from "@/hooks/useEquipmentConfig";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { useHistory } from "@/hooks/useHistory";
import { scanEquipmentPhoto, identifyEquipment } from "@/lib/equipment-scan";
import { ExerciseEditor, type ExerciseEditorResult } from "@/components/programs/ExerciseEditor";
import { createExerciseDefinition, updateProgramExerciseWeight } from "@/lib/firestore";
import type { Exercise, Workout } from "@/lib/types";
import { scopeDefinitions, DAY_ORDER, isChecklistWorkout, resolveWorkout } from "@/lib/types";
import { ProgramDayExercises } from "@/components/programs/ProgramDayExercises";
import { formatWeekAsText } from "@/lib/week-export";
import Link from "next/link";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useError } from "@/components/providers/ErrorProvider";

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: programId } = use(params);
  const { user } = useAuth();
  const { sessions } = useHistory(user?.uid ?? null); // evidence for the equipment-photo weight suggestion
  const { programs, loading: programsLoading, loadWorkoutsForWeek, updateWorkout, refreshPrograms } = usePrograms(user?.uid ?? null);
  const { config: equipmentConfig } = useEquipmentConfig(user?.uid ?? null);
  const { definitions: libraryDefinitions, machines, loading: definitionsLoading, reload: reloadDefinitions } = useExerciseDefinitions(user?.uid ?? null);
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
  // Weights are per program: show and edit this program's, falling back to the library's.
  const definitions = scopeDefinitions(libraryDefinitions, program);
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
        await updateProgramExerciseWeight(user.uid, programId, result.definitionId, result.weight, def.hardStreak);
      }
    }
    await Promise.all([reloadDefinitions(), refreshPrograms()]);

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
    <div className="max-w-lg mx-auto p-4 lg:max-w-[1280px] lg:p-8">
      {/* Header: title, then week tabs below it on phones and beside it on desktop */}
      <div className="lg:flex lg:items-center lg:justify-between lg:gap-4 lg:mb-6">
      <div className="flex items-center gap-3 mb-6 lg:mb-0">
        <Link href="/settings" className="text-gray-400 hover:text-white transition">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{program.name}</h1>
      </div>

      {/* Week Tabs */}
      <div className="flex items-center justify-between gap-2 mb-6 lg:mb-0">
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

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-14 lg:gap-y-12 lg:items-start">
      {!loadingWorkouts && !definitionsLoading && sortedWorkouts.map((workout) => (
        <div key={workout.id} className="mb-6 lg:mb-0">
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

          <ProgramDayExercises
            workout={workout}
            definitions={definitions}
            editingExerciseId={editingExercise?.exercise?.id}
            onEdit={(exercise) => setEditingExercise({ workout, exercise })}
            onDelete={(exerciseId) => setConfirmDelete({ workoutId: workout.id, exerciseId })}
            onReorder={async (exercises) => {
              const updatedWorkout = { ...workout, exercises };
              await updateWorkout(updatedWorkout);
              setWorkouts((prev) => prev.map((w) => w.id === workout.id ? updatedWorkout : w));
            }}
          />
        </div>
      ))}
      </div>

      {/* Exercise Editor Modal */}
      {editingExercise && (
        <ExerciseEditor
          exercise={editingExercise.exercise}
          maxOrder={Math.max(0, ...editingExercise.workout.exercises.map((e) => e.order))}
          definitions={Object.values(definitions)}
          machines={machines}
          onSave={handleSaveExercise}
          onCancel={() => setEditingExercise(null)}
          equipmentConfig={equipmentConfig}
          onScanPhoto={(file, hint) => scanEquipmentPhoto(file, sessions, hint)}
          onIdentify={(hint) => identifyEquipment(sessions, hint)}
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

    </div>
  );
}
