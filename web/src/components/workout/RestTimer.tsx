"use client";

import type { ActiveSession, UserEquipmentConfig } from "@/lib/types";
import { getEquipmentDisplay, equipmentDisplayText } from "@/lib/equipment-calculator";
import { RestNotificationControl } from "./RestNotificationControl";
import { currentSetView } from "@/lib/inserted-set";
import { nextSetSummary } from "@/lib/next-set";

interface RestTimerProps {
  session: ActiveSession;
  onSkipRest: () => void;
  equipmentConfig?: UserEquipmentConfig;
  anotherSetOf?: string;          // name of the exercise just finished, when one more set of it can be added
  onAddAnotherSet?: () => void;
}

export function RestTimer({ session, onSkipRest, equipmentConfig, anotherSetOf, onAddAnotherSet }: RestTimerProps) {
  const exercise = session.workout.exercises[session.currentExerciseIndex];
  const totalRest = exercise.restSeconds || 120;
  const progress = session.restTimeRemaining / totalRest;

  const minutes = Math.floor(session.restTimeRemaining / 60);
  const seconds = session.restTimeRemaining % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // What comes after this rest: the session has already moved on to it.
  const next = nextSetSummary(session);
  const view = currentSetView(session);
  const equipText = view ? equipmentDisplayText(getEquipmentDisplay(view.exercise, view.weight, equipmentConfig)) : "";

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
        {next && (
          <div className="bg-gray-800/80 rounded-xl p-4 mb-8 backdrop-blur">
            <p className="text-xs text-gray-400">{next.label}</p>
            <p className="font-semibold">{next.detail}</p>
            <p className="text-lg font-bold mt-1">{next.reps}</p>
            {equipText && (
              <p className="text-sm text-indigo-300 mt-1">{equipText}</p>
            )}
          </div>
        )}

        {anotherSetOf && onAddAnotherSet && (
          <button
            onClick={onAddAnotherSet}
            className="block mx-auto mb-4 px-6 py-3 rounded-full border border-gray-700 text-indigo-300 hover:bg-gray-800 font-semibold transition"
          >
            + Another set of {anotherSetOf}
          </button>
        )}

        {/* Skip */}
        <button
          onClick={onSkipRest}
          aria-label="Skip Rest"
          className="px-8 py-3 rounded-full bg-gray-800 hover:bg-gray-700 font-semibold transition"
        >
          Skip
        </button>
        <RestNotificationControl />
      </div>
    </div>
  );
}
