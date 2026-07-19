"use client";

import { useState } from "react";
import type { Exercise, Phase, EquipmentType, ProgressionRule, WeightSpec, RepTarget, UserEquipmentConfig } from "@/lib/types";
import { DEFAULT_EQUIPMENT_CONFIG } from "@/lib/equipment-calculator";
import { EquipmentWeightInput, defaultWeightForType } from "./EquipmentWeightInput";

const PHASES: { value: Phase; label: string }[] = [
  { value: "warmup", label: "Warmup" },
  { value: "main", label: "Main" },
  { value: "finisher", label: "Finisher" },
  { value: "cooldown", label: "Cooldown" },
  { value: "mobility", label: "Mobility" },
];

const PROGRESSION_RULES: { value: ProgressionRule; label: string }[] = [
  { value: "none", label: "None" },
  { value: "add_5lb", label: "Add 5 lbs" },
  { value: "add_2.5lb", label: "Add 2.5 lbs" },
  { value: "add_10lb", label: "Add 10 lbs" },
  { value: "add_reps", label: "Add Reps" },
  { value: "add_time", label: "Add Time" },
  { value: "reduce_assistance", label: "Reduce Assistance" },
  { value: "maintain", label: "Maintain" },
  { value: "deload", label: "Deload" },
  { value: "progress_gripper", label: "Progress Gripper" },
];

interface ExerciseEditorProps {
  exercise: Exercise | null;
  maxOrder: number;
  onSave: (exercise: Exercise) => void;
  onCancel: () => void;
  equipmentConfig?: UserEquipmentConfig;
}

export function ExerciseEditor({ exercise, maxOrder, onSave, onCancel, equipmentConfig }: ExerciseEditorProps) {
  const isNew = !exercise;

  const [name, setName] = useState(exercise?.name ?? "");
  const [phase, setPhase] = useState<Phase>(exercise?.phase ?? "main");
  const [order, setOrder] = useState(exercise?.order ?? maxOrder + 1);

  const initEquipType = exercise?.equipmentType ?? "barbell_45";
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(initEquipType);

  // equipmentDetail is only used for band color
  const [equipmentDetail, setEquipmentDetail] = useState(
    exercise?.equipmentType === "band" ? (exercise.equipmentDetail ?? "Orange") : "Orange"
  );

  const [weightValue, setWeightValue] = useState(
    exercise?.baseWeight.type === "fixed"
      ? String(exercise.baseWeight.value)
      : isNew
        ? defaultWeightForType(initEquipType)
        : String(exercise?.totalWeight ?? 0)
  );

  const [barbellError, setBarbellError] = useState<string | null>(null);

  const [sets, setSets] = useState(exercise?.sets ?? 3);
  const [repMin, setRepMin] = useState(exercise?.repMin ?? 8);
  const [repMaxType, setRepMaxType] = useState<"count" | "failure">(exercise?.repMax.type ?? "count");
  const [repMaxValue, setRepMaxValue] = useState(exercise?.repMax.type === "count" ? exercise.repMax.value : 12);
  const [restSeconds, setRestSeconds] = useState(exercise?.restSeconds ?? 120);
  const [progressionRule, setProgressionRule] = useState<ProgressionRule>(exercise?.progressionRule ?? "none");
  const [timeBased, setTimeBased] = useState(exercise?.isTimeBased ?? false);
  const [isUnilateral, setIsUnilateral] = useState(exercise?.isUnilateral ?? false);
  const [finalSetAmrap, setFinalSetAmrap] = useState(exercise?.repMax.type === "failure");
  const [notes, setNotes] = useState(exercise?.notes ?? "");

  const isBarbellType = equipmentType === "barbell_45" || equipmentType === "barbell_35" || equipmentType === "barbell_ez";

  function handleEquipmentChange(newType: EquipmentType) {
    setEquipmentType(newType);
    setBarbellError(null);
    setWeightValue(defaultWeightForType(newType));
  }

  const powerBlockMin = equipmentConfig?.powerBlock?.minLbs ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock.minLbs;
  const powerBlockMax = equipmentConfig?.powerBlock?.maxLbs ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock.maxLbs;

  function handleSave() {
    if (!name.trim()) return;
    if (isBarbellType && barbellError) return;

    const baseWeight: WeightSpec = (() => {
      if (equipmentType === "band" || equipmentType === "bodyweight") return { type: "fixed", value: 0 };
      return { type: "fixed", value: parseFloat(weightValue) || 0 };
    })();

    const repMax: RepTarget = finalSetAmrap
      ? { type: "failure" }
      : { type: "count", value: repMaxValue };

    const result: Exercise = {
      id: exercise?.id ?? crypto.randomUUID(),
      order,
      name: name.trim(),
      phase,
      equipmentType,
      equipmentDetail: equipmentType === "band" ? (equipmentDetail || "Orange") : null,
      baseWeight,
      sets,
      repMin,
      repMax,
      restSeconds,
      progressionRule,
      isUnilateral,
      isTimeBased: timeBased,
      notes: notes.trim() || null,
    };

    onSave(result);
  }

  const hasBlockingError = isBarbellType && !!barbellError;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center overflow-y-auto">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 border border-gray-800 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-5">{isNew ? "Add Exercise" : "Edit Exercise"}</h3>

        {/* Name */}
        <Field label="Exercise Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bench Press"
            className="input-field"
          />
        </Field>

        {/* Phase & Order */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Phase" noMargin>
            <select value={phase} onChange={(e) => setPhase(e.target.value as Phase)} className="input-field">
              {PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Order" noMargin>
            <input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 1)} min={1} className="input-field" />
          </Field>
        </div>

        {/* Equipment + Weight */}
        <Field label="Equipment + Weight">
          <div className="space-y-2">
            {/* Equipment selector */}
            <select
              value={equipmentType}
              onChange={(e) => handleEquipmentChange(e.target.value as EquipmentType)}
              className="input-field"
            >
              {(!equipmentConfig || equipmentConfig.barbells.hasEZBar || equipmentType === "barbell_ez") && (
                <option value="barbell_ez">EZ Bar (15 lbs)</option>
              )}
              {(!equipmentConfig || equipmentConfig.barbells.has35lb || equipmentType === "barbell_35") && (
                <option value="barbell_35">35 lb Bar</option>
              )}
              {(!equipmentConfig || equipmentConfig.barbells.has45lb || equipmentType === "barbell_45") && (
                <option value="barbell_45">Olympic Bar (45 lbs)</option>
              )}
              <option value="powerblock">PowerBlock ({powerBlockMin}–{powerBlockMax} lbs)</option>
              <option value="dumbbell">Dumbbell</option>
              <option value="band">Serious Steel Band</option>
              <option value="assisted_pullup">Pull-Up Assist (Bands)</option>
              <option value="kettlebell">Kettlebell</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="gripper">Gripper</option>
            </select>

            {/* Equipment-specific weight input */}
            <EquipmentWeightInput
              equipmentType={equipmentType}
              weightValue={weightValue}
              onWeightValueChange={setWeightValue}
              equipmentDetail={equipmentDetail}
              onEquipmentDetailChange={setEquipmentDetail}
              equipmentConfig={equipmentConfig}
              onBarbellErrorChange={setBarbellError}
            />
          </div>
        </Field>

        {/* Sets */}
        <Field label="Sets">
          <div className="flex items-center gap-3">
            <button onClick={() => setSets(Math.max(1, sets - 1))} className="btn-stepper">-</button>
            <span className="text-xl font-bold w-8 text-center">{sets}</span>
            <button onClick={() => setSets(sets + 1)} className="btn-stepper">+</button>
          </div>
        </Field>

        {/* Time Based toggle */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">Time Based (seconds)</span>
          <button
            onClick={() => {
              const next = !timeBased;
              setTimeBased(next);
              if (next && progressionRule !== "add_time") {
                setProgressionRule("add_time");
              } else if (!next && progressionRule === "add_time") {
                setProgressionRule("none");
              }
            }}
            className={`w-12 h-7 rounded-full transition relative ${timeBased ? "bg-indigo-600" : "bg-gray-700"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${timeBased ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Reps / Duration */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label={timeBased ? "Duration Min (s)" : "Rep Min"} noMargin>
            <input type="number" value={repMin} onChange={(e) => setRepMin(parseInt(e.target.value) || 0)} min={0} step={timeBased ? 5 : 1} className="input-field" />
          </Field>
          <Field label={timeBased ? "Duration Max (s)" : "Rep Max"} noMargin>
            <input type="number" value={repMaxValue} onChange={(e) => setRepMaxValue(parseInt(e.target.value) || 0)} min={0} step={timeBased ? 5 : 1} className="input-field" />
          </Field>
        </div>

        {/* Final Set AMRAP */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">Final Set AMRAP</span>
          <button
            onClick={() => setFinalSetAmrap(!finalSetAmrap)}
            className={`w-12 h-7 rounded-full transition relative ${finalSetAmrap ? "bg-indigo-600" : "bg-gray-700"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${finalSetAmrap ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Rest */}
        <Field label={`Rest (${restSeconds}s = ${restSeconds >= 60 ? `${Math.floor(restSeconds / 60)}:${(restSeconds % 60).toString().padStart(2, "0")}` : `${restSeconds}s`})`}>
          <input
            type="number"
            value={restSeconds}
            onChange={(e) => setRestSeconds(parseInt(e.target.value) || 0)}
            step={15}
            min={0}
            className="input-field"
          />
        </Field>

        {/* Progression */}
        <Field label="Progression Rule">
          <select value={progressionRule} onChange={(e) => setProgressionRule(e.target.value as ProgressionRule)} className="input-field">
            {PROGRESSION_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>

        {/* Unilateral */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">Each Side (Unilateral)</span>
          <button
            onClick={() => setIsUnilateral(!isUnilateral)}
            className={`w-12 h-7 rounded-full transition relative ${isUnilateral ? "bg-indigo-600" : "bg-gray-700"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${isUnilateral ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Notes */}
        <Field label="Notes">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
            className="input-field"
          />
        </Field>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || hasBlockingError}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNew ? "Add" : "Save"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .input-field {
          width: 100%;
          background: rgb(31 41 55);
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(55 65 81);
          outline: none;
          color: white;
        }
        .input-field:focus {
          border-color: rgb(99 102 241);
        }
        select.input-field {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='2' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          background-size: 1.25rem;
          padding-right: 2rem;
        }
        .btn-stepper {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.75rem;
          background: rgb(31 41 55);
          font-size: 1.125rem;
          font-weight: 700;
          transition: background 0.15s;
        }
        .btn-stepper:hover {
          background: rgb(55 65 81);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, noMargin }: { label: string; children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className={noMargin ? "" : "mb-4"}>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}
