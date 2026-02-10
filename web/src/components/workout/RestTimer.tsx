"use client";

import type { ActiveSession } from "@/lib/types";
import { getEquipmentDisplay, equipmentDisplayText } from "@/lib/equipment-calculator";

interface RestTimerProps {
  session: ActiveSession;
  onSkipRest: () => void;
}

export function RestTimer({ session, onSkipRest }: RestTimerProps) {
  const exercise = session.workout.exercises[session.currentExerciseIndex];
  const weight = session.resolvedWeights[exercise.id] ?? 0;
  const totalRest = exercise.restSeconds || 120;
  const progress = session.restTimeRemaining / totalRest;

  const minutes = Math.floor(session.restTimeRemaining / 60);
  const seconds = session.restTimeRemaining % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Next exercise preview
  const completedForCurrent = session.completedSets.filter(
    (s) => s.exerciseOrder === exercise.order
  ).length;
  const setsRemaining = exercise.sets - completedForCurrent;

  let nextLabel = "";
  let nextDetail = "";
  let equipText = "";

  if (setsRemaining > 0) {
    nextLabel = "Next Set";
    nextDetail = `${exercise.name} - Set ${session.currentSetNumber + 1}`;
    equipText = equipmentDisplayText(getEquipmentDisplay(exercise, weight));
  } else if (session.currentExerciseIndex < session.workout.exercises.length - 1) {
    const next = session.workout.exercises[session.currentExerciseIndex + 1];
    const nextWeight = session.resolvedWeights[next.id] ?? 0;
    nextLabel = "Up Next";
    nextDetail = next.name;
    equipText = equipmentDisplayText(getEquipmentDisplay(next, nextWeight));
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div className="text-center px-6">
        <p className="text-gray-400 text-sm font-bold tracking-widest mb-8">REST</p>

        {/* Timer */}
        <div className="text-7xl font-bold font-mono mb-8">{timeStr}</div>

        {/* Progress ring */}
        <div className="flex justify-center mb-8">
          <svg width="120" height="120" className="-rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#374151" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="#6366f1" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 54}`}
              strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress)}`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
        </div>

        {/* Next preview */}
        {nextLabel && (
          <div className="bg-gray-800/80 rounded-xl p-4 mb-8 backdrop-blur">
            <p className="text-xs text-gray-400">{nextLabel}</p>
            <p className="font-semibold">{nextDetail}</p>
            {equipText && (
              <p className="text-sm text-indigo-300 mt-1">{equipText}</p>
            )}
          </div>
        )}

        {/* Skip */}
        <button
          onClick={onSkipRest}
          className="px-8 py-3 rounded-full bg-gray-800 hover:bg-gray-700 font-semibold transition"
        >
          Skip Rest
        </button>
      </div>
    </div>
  );
}
