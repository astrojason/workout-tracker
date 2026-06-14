"use client";

import type { Exercise, EquipmentDisplay } from "@/lib/types";
import { repTargetDisplay, formatRestTime, PHASE_COLORS, isTimeBased } from "@/lib/types";
import { equipmentDisplayText } from "@/lib/equipment-calculator";

interface ExerciseCardProps {
  exercise: Exercise;
  setNumber: number;
  weight: number;
  equipmentDisplay: EquipmentDisplay;
  onEditWeight?: () => void;
  onEditSets?: () => void;
}

function EquipmentContent({ equipmentDisplay, editable }: { equipmentDisplay: EquipmentDisplay; editable: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-indigo-300 font-semibold">
          {equipmentDisplayText(equipmentDisplay)}
        </div>
        {equipmentDisplay.type === "powerblock" && equipmentDisplay.weight > 0 && (
          <div className="text-indigo-400/70 text-xs mt-0.5">
            {equipmentDisplay.instructions.label}
          </div>
        )}
      </div>
      {editable && <span className="text-indigo-400 text-xs">Edit weight</span>}
    </div>
  );
}

export function ExerciseCard({ exercise, setNumber, weight, equipmentDisplay, onEditWeight, onEditSets }: ExerciseCardProps) {
  const phaseColor = PHASE_COLORS[exercise.phase] || "bg-gray-600";

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      {/* Exercise Name */}
      <h2 className="text-2xl font-bold mb-4">{exercise.name}</h2>

      {/* Phase badge */}
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${phaseColor} mb-4`}>
        {exercise.phase.charAt(0).toUpperCase() + exercise.phase.slice(1)}
      </span>

      {/* Set / Rep / Rest info */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div
          className={`bg-gray-800 rounded-xl p-3 text-center ${onEditSets ? "cursor-pointer active:bg-gray-700" : ""}`}
          onClick={onEditSets}
        >
          <div className="text-xs text-gray-400">{onEditSets ? <span className="text-indigo-400">Edit</span> : null}</div>
          <div className="text-lg font-bold">Set {setNumber} of {exercise.sets}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-400">{isTimeBased(exercise) ? "Duration" : "Reps"}</div>
          <div className="text-lg font-bold">{repTargetDisplay(exercise.repMin, exercise.repMax, exercise, setNumber)}</div>
        </div>
        {exercise.restSeconds > 0 && (
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400">Recovery</div>
            <div className="text-lg font-bold">{formatRestTime(exercise.restSeconds)}</div>
          </div>
        )}
      </div>

      {/* Equipment */}
      {onEditWeight ? (
        <button
          type="button"
          onClick={onEditWeight}
          className="bg-indigo-950/50 border border-indigo-800/50 rounded-xl p-4 mb-4 w-full text-left cursor-pointer active:bg-indigo-950/80"
        >
          <EquipmentContent equipmentDisplay={equipmentDisplay} editable />
        </button>
      ) : (
        <div className="bg-indigo-950/50 border border-indigo-800/50 rounded-xl p-4 mb-4">
          <EquipmentContent equipmentDisplay={equipmentDisplay} editable={false} />
        </div>
      )}

      {/* Unilateral */}
      {exercise.isUnilateral && (
        <div className="text-orange-400 font-semibold text-sm mb-2">
          &#x2194; Each Side
        </div>
      )}

      {/* Notes */}
      {exercise.notes && (
        <div className="bg-gray-800/50 rounded-xl p-3 text-sm text-gray-400">
          {exercise.notes}
        </div>
      )}

      {/* Progression */}
      {exercise.progressionRule !== "none" && exercise.progressionRule !== "maintain" && (
        <div className="text-green-400 text-xs mt-3">
          &#x2197; Progression: {exercise.progressionRule.replace(/_/g, " ")}
        </div>
      )}
    </div>
  );
}
