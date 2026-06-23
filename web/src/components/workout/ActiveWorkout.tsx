"use client";

import { useState, useEffect } from "react";
import type { ActiveSession, Exercise } from "@/lib/types";
import { isTimeBased, formatTimeValue } from "@/lib/types";
import { getEquipmentDisplay } from "@/lib/equipment-calculator";
import { ExerciseCard } from "./ExerciseCard";
import { RestTimer } from "./RestTimer";
import { SetCompletionModal } from "./SetCompletionModal";
import { useSound } from "@/hooks/useSound";

interface ActiveWorkoutProps {
  session: ActiveSession;
  onCompleteSet: (actualReps: number, actualWeight: number, failed: boolean, rating: "easy" | "normal" | "hard", notes?: string) => void;
  onSkipSet: () => void;
  onSkipRest: () => void;
  onEndWorkout: () => void;
  onUpdateWeight: (exerciseId: string, newWeight: number) => void;
  onUpdateSets: (exerciseId: string, newSets: number) => void;
  onDismiss: () => void;
  onPause: () => void;
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
          <div>
            <label htmlFor="weight-editor-input" className="sr-only">Weight (lbs)</label>
            <input
              id="weight-editor-input"
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              step={step}
              className="w-28 bg-gray-800 rounded-xl px-4 py-3 text-2xl font-bold text-center border border-gray-700 focus:border-indigo-500 outline-none"
            />
          </div>
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function ActiveWorkout({
  session, onCompleteSet, onSkipSet, onSkipRest, onEndWorkout,
  onUpdateWeight, onUpdateSets, onDismiss, onPause,
}: ActiveWorkoutProps) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showWeightEditor, setShowWeightEditor] = useState(false);
  const [showSetsEditor, setShowSetsEditor] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerSide, setTimerSide] = useState<1 | 2>(1);
  const [showSwitchSides, setShowSwitchSides] = useState(false);

  const { playTimerComplete, initAudio } = useSound();
  const exercise = session.workout.exercises[session.currentExerciseIndex];
  const timedExercise = isTimeBased(exercise);
  const timerDuration = exercise.repMin;

  // Reset timer when exercise changes
  useEffect(() => {
    setTimerRunning(false);
    setTimerRemaining(0);
    setTimerSide(1);
    setShowSwitchSides(false);
  }, [session.currentExerciseIndex]);

  // Countdown tick
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimerRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  // Handle timer completion
  useEffect(() => {
    if (timerRunning && timerRemaining === 0) {
      setTimerRunning(false);
      playTimerComplete();
      if (exercise.isUnilateral && timerSide === 1) {
        setTimerSide(2);
        setShowSwitchSides(true);
      } else {
        setTimerSide(1);
        setShowCompletion(true);
      }
    }
  }, [timerRemaining, timerRunning, playTimerComplete, exercise.isUnilateral, timerSide]);

  const startTimer = () => {
    initAudio();
    setTimerSide(1);
    setTimerRemaining(timerDuration);
    setTimerRunning(true);
  };

  const startSide2 = () => {
    setShowSwitchSides(false);
    setTimerRemaining(timerDuration);
    setTimerRunning(true);
  };
  const weight = session.resolvedWeights[exercise.id] ?? 0;
  const equipDisplay = getEquipmentDisplay(exercise, weight);
  const progress = (session.currentExerciseIndex / session.workout.exercises.length) * 100;

  // Next exercise preview — show when on the last set of the current exercise
  const setsRemainingForCurrent = exercise.sets - (session.currentSetNumber - 1);
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
        <div className="flex items-center gap-3">
          <button
            onClick={onPause}
            className="text-gray-400 hover:text-white transition p-1 -ml-1"
            aria-label="Pause and go home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="font-bold">{session.workout.programName}</div>
            <div className="text-sm text-gray-400">{session.workout.dayOfWeek}</div>
          </div>
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

        {/* Exercise Timer */}
        {timedExercise && (timerRunning || showSwitchSides) && (
          <div className="bg-gray-900 rounded-2xl p-5 border border-teal-800/50 text-center">
            {showSwitchSides ? (
              <>
                <p className="text-teal-400 text-xs font-bold tracking-widest mb-3">SWITCH SIDES</p>
                <p className="text-4xl mb-2">↔</p>
                <p className="text-gray-300 text-sm">Side 1 done — get set for Side 2</p>
              </>
            ) : (
              <>
                <p className="text-teal-400 text-xs font-bold tracking-widest mb-1">EXERCISE TIMER</p>
                {exercise.isUnilateral && (
                  <p className="text-gray-400 text-xs mb-3">Side {timerSide} of 2</p>
                )}
                <div className="text-6xl font-bold font-mono mb-4">{formatTimeValue(timerRemaining)}</div>
                <div className="flex justify-center">
                  <svg width="100" height="100" className="-rotate-90">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#1f2937" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="44" fill="none"
                      stroke="#14b8a6" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 44}`}
                      strokeDashoffset={`${2 * Math.PI * 44 * (1 - timerRemaining / timerDuration)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                </div>
              </>
            )}
          </div>
        )}

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
          {timedExercise && timerRunning ? (
            <button
              onClick={() => { setTimerRunning(false); setShowSwitchSides(false); setTimerSide(1); setShowCompletion(true); }}
              className="flex-1 py-4 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition text-lg"
            >
              Done Early
            </button>
          ) : timedExercise && showSwitchSides ? (
            <>
              <button
                onClick={() => { setShowSwitchSides(false); setTimerSide(1); setShowCompletion(true); }}
                className="flex-1 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition text-lg"
              >
                Skip Side 2
              </button>
              <button
                onClick={startSide2}
                className="flex-[2] py-4 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold transition text-lg"
              >
                Start Side 2
              </button>
            </>
          ) : timedExercise && !timerRunning ? (
            <>
              <button
                onClick={onSkipSet}
                className="flex-1 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition text-lg"
              >
                Skip
              </button>
              <button
                onClick={startTimer}
                className="flex-1 py-4 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold transition text-lg"
              >
                Start Timer
              </button>
              <button
                onClick={() => setShowCompletion(true)}
                className="flex-1 py-4 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition text-lg"
              >
                Complete Set
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
          completedSets={session.currentSetNumber - 1}
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
