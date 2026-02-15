"use client";

import { useState } from "react";
import type { ActiveSession, Exercise } from "@/lib/types";
import { getEquipmentDisplay } from "@/lib/equipment-calculator";
import { ExerciseCard } from "./ExerciseCard";
import { RestTimer } from "./RestTimer";
import { SetCompletionModal } from "./SetCompletionModal";

interface ActiveWorkoutProps {
  session: ActiveSession;
  onCompleteSet: (actualReps: number, actualWeight: number, failed: boolean, rating: "easy" | "normal" | "hard", notes?: string) => void;
  onSkipSet: () => void;
  onSkipRest: () => void;
  onEndWorkout: () => void;
  onUpdateWeight: (exerciseId: string, newWeight: number) => void;
  onUpdateSets: (exerciseId: string, newSets: number) => void;
  onDismiss: () => void;
  onHardWeightDecision?: (action: "keep" | "reduce") => void;
  showHardPrompt?: boolean;
}

function SetsEditor({ currentSets, completedSets, onSave, onCancel }: {
  currentSets: number;
  completedSets: number;
  onSave: (sets: number) => void;
  onCancel: () => void;
}) {
  const minSets = Math.max(1, completedSets + 1);
  const [sets, setSets] = useState(Math.max(currentSets, minSets));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 border border-gray-800">
        <h3 className="text-lg font-bold mb-4">Adjust Sets</h3>
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setSets(Math.max(minSets, sets - 1))}
            className="w-14 h-14 rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl font-bold transition"
          >
            -
          </button>
          <input
            type="number"
            value={sets}
            onChange={(e) => setSets(Math.max(minSets, parseInt(e.target.value) || minSets))}
            className="w-20 bg-gray-800 rounded-xl px-2 py-1 text-4xl font-bold text-center font-mono border border-gray-700 focus:border-indigo-500 outline-none"
          />
          <button
            onClick={() => setSets(sets + 1)}
            className="w-14 h-14 rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl font-bold transition"
          >
            +
          </button>
        </div>
        {completedSets > 0 && (
          <p className="text-xs text-gray-500 text-center mb-4">{completedSets} already completed</p>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition">
            Cancel
          </button>
          <button onClick={() => onSave(sets)} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition">
            Update
          </button>
        </div>
      </div>
    </div>
  );
}

function WeightEditor({ currentWeight, exercise, onSave, onCancel }: {
  currentWeight: number;
  exercise: Exercise;
  onSave: (weight: number) => void;
  onCancel: () => void;
}) {
  const [weight, setWeight] = useState(currentWeight);
  const step = exercise.equipmentType === "powerblock" ? 2.5 : 5;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 border border-gray-800">
        <h3 className="text-lg font-bold mb-4">Adjust Weight</h3>
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setWeight(Math.max(0, weight - step))}
            className="w-14 h-14 rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl font-bold transition"
          >
            -
          </button>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            step={step}
            className="w-28 bg-gray-800 rounded-xl px-4 py-3 text-2xl font-bold text-center border border-gray-700 focus:border-indigo-500 outline-none"
          />
          <button
            onClick={() => setWeight(weight + step)}
            className="w-14 h-14 rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl font-bold transition"
          >
            +
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mb-6">lbs</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition">
            Cancel
          </button>
          <button onClick={() => onSave(weight)} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition">
            Update
          </button>
        </div>
      </div>
    </div>
  );
}

export function ActiveWorkout({
  session, onCompleteSet, onSkipSet, onSkipRest, onEndWorkout,
  onUpdateWeight, onUpdateSets, onDismiss, onHardWeightDecision, showHardPrompt,
}: ActiveWorkoutProps) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showWeightEditor, setShowWeightEditor] = useState(false);
  const [showSetsEditor, setShowSetsEditor] = useState(false);

  const exercise = session.workout.exercises[session.currentExerciseIndex];
  const weight = session.resolvedWeights[exercise.id] ?? 0;
  const equipDisplay = getEquipmentDisplay(exercise, weight);
  const progress = (session.currentExerciseIndex / session.workout.exercises.length) * 100;

  // Next exercise preview
  const completedForCurrent = session.completedSets.filter(
    (s) => s.exerciseOrder === exercise.order
  ).length;
  const setsRemainingForCurrent = exercise.sets - completedForCurrent;
  const nextExercise = setsRemainingForCurrent <= 1 && session.currentExerciseIndex < session.workout.exercises.length - 1
    ? session.workout.exercises[session.currentExerciseIndex + 1]
    : null;

  const elapsed = Math.round((Date.now() - session.startTime.getTime()) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const elapsedStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const phaseColors: Record<string, string> = {
    warmup: "bg-orange-500",
    main: "bg-blue-500",
    finisher: "bg-purple-500",
    cooldown: "bg-teal-500",
    mobility: "bg-green-500",
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div>
          <div className="font-bold">{session.workout.programName}</div>
          <div className="text-sm text-gray-400">{session.workout.dayOfWeek}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${phaseColors[exercise.phase] || "bg-gray-600"}`}>
            {exercise.phase.charAt(0).toUpperCase() + exercise.phase.slice(1)}
          </span>
          <span className="text-sm text-gray-400 font-mono">{elapsedStr}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pt-2">
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Exercise {session.currentExerciseIndex + 1} of {session.workout.exercises.length}
        </p>
      </div>

      {/* Exercise Card */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <ExerciseCard
          exercise={exercise}
          setNumber={session.currentSetNumber}
          weight={weight}
          equipmentDisplay={equipDisplay}
          onEditWeight={weight > 0 ? () => setShowWeightEditor(true) : undefined}
          onEditSets={() => setShowSetsEditor(true)}
        />

        {/* Next Exercise Preview */}
        {nextExercise && (
          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800/50">
            <p className="text-xs text-gray-500 mb-1">Up Next</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-300">{nextExercise.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${phaseColors[nextExercise.phase] || "bg-gray-600"}`}>
                {nextExercise.phase.charAt(0).toUpperCase() + nextExercise.phase.slice(1)}
              </span>
            </div>
            {(session.resolvedWeights[nextExercise.id] ?? 0) > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {session.resolvedWeights[nextExercise.id]} lbs &middot; {nextExercise.sets} sets
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 space-y-3">
        <div className="flex gap-3">
          <button
            onClick={onSkipSet}
            className="flex-1 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition text-lg"
          >
            Skip
          </button>
          <button
            onClick={() => setShowCompletion(true)}
            className="flex-[2] py-4 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition text-lg"
          >
            Complete Set
          </button>
        </div>
        <button
          onClick={() => setShowEndConfirm(true)}
          className="w-full text-red-400 hover:text-red-300 text-sm py-2 transition"
        >
          End Workout
        </button>
      </div>

      {/* Rest Timer Overlay */}
      {session.isResting && <RestTimer session={session} onSkipRest={onSkipRest} />}

      {/* Set Completion Modal */}
      {showCompletion && (
        <SetCompletionModal
          exercise={exercise}
          setNumber={session.currentSetNumber}
          targetWeight={weight}
          onSave={(reps, w, failed, rating, notes) => {
            setShowCompletion(false);
            onCompleteSet(reps, w, failed, rating, notes);
          }}
          onCancel={() => setShowCompletion(false)}
        />
      )}

      {/* Hard Weight Decision Prompt */}
      {showHardPrompt && onHardWeightDecision && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm mx-4 border border-gray-800">
            <h3 className="text-lg font-bold mb-2">That was hard</h3>
            <p className="text-gray-400 text-sm mb-6">
              Would you like to keep the same weight or reduce it for the remaining sets?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => onHardWeightDecision("keep")}
                className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition"
              >
                Keep Weight
              </button>
              <button
                onClick={() => onHardWeightDecision("reduce")}
                className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 font-bold transition"
              >
                Reduce
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weight Editor */}
      {showWeightEditor && (
        <WeightEditor
          currentWeight={weight}
          exercise={exercise}
          onSave={(newWeight) => {
            onUpdateWeight(exercise.id, newWeight);
            setShowWeightEditor(false);
          }}
          onCancel={() => setShowWeightEditor(false)}
        />
      )}

      {/* Sets Editor */}
      {showSetsEditor && (
        <SetsEditor
          currentSets={exercise.sets}
          completedSets={completedForCurrent}
          onSave={(newSets) => {
            onUpdateSets(exercise.id, newSets);
            setShowSetsEditor(false);
          }}
          onCancel={() => setShowSetsEditor(false)}
        />
      )}

      {/* End Workout Confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm mx-4 border border-gray-800">
            <h3 className="text-lg font-bold mb-2">End Workout?</h3>
            <p className="text-gray-400 text-sm mb-6">You still have exercises remaining.</p>
            <div className="space-y-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition"
              >
                Continue Workout
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); onEndWorkout(); }}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold transition"
              >
                Save &amp; End Workout
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); onDismiss(); }}
                className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition text-gray-400"
              >
                Discard &amp; Go Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
