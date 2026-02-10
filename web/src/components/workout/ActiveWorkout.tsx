"use client";

import { useState } from "react";
import type { ActiveSession } from "@/lib/types";
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
  onHardWeightDecision?: (action: "keep" | "reduce") => void;
  showHardPrompt?: boolean;
}

export function ActiveWorkout({
  session, onCompleteSet, onSkipSet, onSkipRest, onEndWorkout,
  onHardWeightDecision, showHardPrompt,
}: ActiveWorkoutProps) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const exercise = session.workout.exercises[session.currentExerciseIndex];
  const weight = session.resolvedWeights[exercise.id] ?? 0;
  const equipDisplay = getEquipmentDisplay(exercise, weight);
  const progress = (session.currentExerciseIndex / session.workout.exercises.length) * 100;

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
      <div className="flex-1 overflow-auto p-4">
        <ExerciseCard
          exercise={exercise}
          setNumber={session.currentSetNumber}
          weight={weight}
          equipmentDisplay={equipDisplay}
        />
      </div>

      {/* Screen lock indicator */}
      <div className="text-center text-xs text-gray-600 py-1">
        Screen lock disabled during workout
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

      {/* End Workout Confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm mx-4 border border-gray-800">
            <h3 className="text-lg font-bold mb-2">End Workout?</h3>
            <p className="text-gray-400 text-sm mb-6">Your progress will be saved.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); onEndWorkout(); }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold transition"
              >
                End Workout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
