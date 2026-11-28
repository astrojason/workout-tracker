"use client";

import { useEffect, useState } from "react";
import type { Exercise, ExerciseDefinition, Workout } from "@/lib/types";
import { resolveExercise } from "@/lib/types";
import { moveExercise, type MoveDirection } from "@/lib/reorder-exercises";
import { ExerciseSummary, UnresolvedExerciseSummary } from "@/components/programs/ExerciseSummary";
import { useError } from "@/components/providers/ErrorProvider";

// One day's exercises in the program editor: edit, delete, and move up/down one place.
export function ProgramDayExercises({
  workout,
  definitions,
  editingExerciseId,
  onEdit,
  onDelete,
  onReorder,
}: {
  workout: Workout;
  definitions: Record<string, ExerciseDefinition>;
  editingExerciseId?: string;
  onEdit: (exercise: Exercise | null) => void;
  onDelete: (exerciseId: string) => void;
  /** Saves the day with its exercises in the new order; throws on failure. */
  onReorder: (exercises: Exercise[]) => Promise<void>;
}) {
  const { showError } = useError();
  const [moving, setMoving] = useState<{ id: string; direction: MoveDirection } | null>(null);
  const [saved, setSaved] = useState(false);
  const sorted = workout.exercises.slice().sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  async function move(exerciseId: string, direction: MoveDirection) {
    setMoving({ id: exerciseId, direction });
    setSaved(false);
    try {
      await onReorder(moveExercise(workout.exercises, exerciseId, direction));
      setSaved(true);
    } catch (err) {
      showError(err);
    } finally {
      setMoving(null);
    }
  }

  return (
    <div className="desk-flat bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
      <ul aria-label={`${workout.dayOfWeek} exercises`} className="divide-y divide-gray-800">
        {sorted.map((rawExercise, index) => {
          // A definitionId with no matching definition (e.g. pre-exercise-library
          // data that hasn't been through the migration script) must not crash
          // this whole list — show it as a row the user can still delete.
          let exercise;
          try {
            exercise = resolveExercise(rawExercise, definitions);
          } catch (err) {
            return (
              <li key={rawExercise.id} className="px-4 py-3 lg:px-0 lg:py-4 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <UnresolvedExerciseSummary error={err} />
                </div>
                <DeleteButton onClick={() => onDelete(rawExercise.id)} />
              </li>
            );
          }
          // The row whose editor is open stays highlighted beside the desktop panel.
          const isEditing = editingExerciseId === exercise.id;
          const isMoving = moving?.id === exercise.id;
          return (
            <li
              key={exercise.id}
              aria-current={isEditing || undefined}
              className={`px-4 py-3 lg:py-4 ${isEditing ? "bg-indigo-950/60 lg:-mx-3 lg:px-3 lg:rounded-lg" : "lg:px-0"} ${isMoving ? "opacity-70" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <ExerciseSummary exercise={exercise} />
                  {exercise.notes && (
                    <div className="text-xs text-gray-600 mt-1 truncate">{exercise.notes}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <MoveButton
                    name={exercise.name}
                    direction="up"
                    busy={isMoving && moving?.direction === "up"}
                    disabled={moving !== null || index === 0}
                    onClick={() => move(exercise.id, "up")}
                  />
                  <MoveButton
                    name={exercise.name}
                    direction="down"
                    busy={isMoving && moving?.direction === "down"}
                    disabled={moving !== null || index === sorted.length - 1}
                    onClick={() => move(exercise.id, "down")}
                  />
                  <button
                    onClick={() => onEdit(exercise)}
                    className="text-gray-600 hover:text-indigo-400 transition p-1"
                    title="Edit exercise"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <DeleteButton onClick={() => onDelete(exercise.id)} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Add Exercise */}
      <div className="px-4 py-3 lg:px-0 lg:py-4 flex items-center justify-between">
        <button
          onClick={() => onEdit(null)}
          className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition"
        >
          + Add Exercise
        </button>
        {moving && <span className="text-xs text-gray-400">Saving order…</span>}
        {!moving && saved && <span role="status" className="text-xs text-green-400">✓ Saved order</span>}
      </div>
    </div>
  );
}

function MoveButton({ name, direction, busy, disabled, onClick }: {
  name: string;
  direction: MoveDirection;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={busy ? `Moving ${name}…` : `Move ${name} ${direction}`}
      title={`Move ${direction}`}
      className="text-gray-600 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-gray-600 transition p-1"
    >
      {busy ? (
        <span className="block w-4 h-4 animate-spin rounded-full border-2 border-gray-500 border-t-indigo-400" />
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={direction === "up" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      )}
    </button>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-gray-600 hover:text-red-400 transition p-1 shrink-0" title="Delete exercise">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}
