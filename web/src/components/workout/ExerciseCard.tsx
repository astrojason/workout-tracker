"use client";

import type { ResolvedExercise, EquipmentDisplay } from "@/lib/types";
import { repTargetDisplay, formatRestTime, PHASE_COLORS, isTimeBased, cleanWeight } from "@/lib/types";
import { equipmentDisplayText } from "@/lib/equipment-calculator";

interface ExerciseCardProps {
  exercise: ResolvedExercise;
  setNumber: number;
  weight: number;
  equipmentDisplay: EquipmentDisplay;
  onEditWeight?: () => void;
  onEditSets?: () => void;
}

function PlateLoadGuide({ equipmentDisplay }: { equipmentDisplay: EquipmentDisplay }) {
  if (equipmentDisplay.type !== "barbell" && equipmentDisplay.type !== "pulley") return null;

  const { config } = equipmentDisplay;
  const loadLocation = equipmentDisplay.type === "pulley"
    ? "Load on pin"
    : config.isLandmine
      ? "Load one end"
      : "Load each side";

  return (
    <div
      role="group"
      aria-label="Plate loading instructions"
      className="mt-3 border-t border-indigo-800/50 pt-3"
    >
      {config.perSide.length === 0 ? (
        <p className="text-sm font-medium text-indigo-200">
          {equipmentDisplay.type === "pulley"
            ? "No plates needed"
            : `No plates — use the ${cleanWeight(config.barWeight)} lb bar`}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
            {loadLocation}
          </p>
          <div className="flex flex-wrap gap-2">
            {config.perSide.map(({ plate, count }) => (
              <span
                key={plate}
                className="rounded-lg border border-indigo-700/60 bg-indigo-900/60 px-2.5 py-1.5 text-sm font-semibold text-indigo-100"
              >
                {cleanWeight(plate)} lb plate &times; {count}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EquipmentContent({ equipmentDisplay, editable }: { equipmentDisplay: EquipmentDisplay; editable: boolean }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
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
        {editable && <span className="shrink-0 text-indigo-400 text-xs">Edit weight</span>}
      </div>
      <PlateLoadGuide equipmentDisplay={equipmentDisplay} />
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

      {/* Set counter row */}
      <div
        className={`flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 mb-3 ${onEditSets ? "cursor-pointer active:bg-gray-700" : ""}`}
        onClick={onEditSets}
      >
        <div className="text-lg font-bold">Set {setNumber} of {exercise.sets}</div>
        {onEditSets && <span className="text-indigo-400 text-xs">Edit</span>}
      </div>

      {/* Rep / Rest info */}
      <div className={`grid gap-3 mb-4 ${exercise.restSeconds > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
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
