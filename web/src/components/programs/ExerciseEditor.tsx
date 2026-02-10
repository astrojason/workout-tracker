"use client";

import { useState } from "react";
import type { Exercise, Phase, EquipmentType, ProgressionRule, WeightSpec, RepTarget } from "@/lib/types";

const PHASES: { value: Phase; label: string }[] = [
  { value: "warmup", label: "Warmup" },
  { value: "main", label: "Main" },
  { value: "finisher", label: "Finisher" },
  { value: "cooldown", label: "Cooldown" },
  { value: "mobility", label: "Mobility" },
];

const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: "barbell_45", label: "Barbell (45lb)" },
  { value: "barbell_35", label: "Barbell (35lb)" },
  { value: "barbell_ez", label: "EZ Bar (15lb)" },
  { value: "powerblock", label: "PowerBlock" },
  { value: "band", label: "Band" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "assisted_pullup", label: "Assisted Pullup" },
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
}

export function ExerciseEditor({ exercise, maxOrder, onSave, onCancel }: ExerciseEditorProps) {
  const isNew = !exercise;

  const [name, setName] = useState(exercise?.name ?? "");
  const [phase, setPhase] = useState<Phase>(exercise?.phase ?? "main");
  const [order, setOrder] = useState(exercise?.order ?? maxOrder + 1);
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(exercise?.equipmentType ?? "barbell_45");
  const [equipmentDetail, setEquipmentDetail] = useState(exercise?.equipmentDetail ?? "");
  const [weightType, setWeightType] = useState<"fixed" | "progressive">(exercise?.baseWeight.type ?? "fixed");
  const [weightValue, setWeightValue] = useState(exercise?.baseWeight.type === "fixed" ? exercise.baseWeight.value : 0);
  const [sets, setSets] = useState(exercise?.sets ?? 3);
  const [repMin, setRepMin] = useState(exercise?.repMin ?? 8);
  const [repMaxType, setRepMaxType] = useState<"count" | "failure">(exercise?.repMax.type ?? "count");
  const [repMaxValue, setRepMaxValue] = useState(exercise?.repMax.type === "count" ? exercise.repMax.value : 12);
  const [restSeconds, setRestSeconds] = useState(exercise?.restSeconds ?? 120);
  const [progressionRule, setProgressionRule] = useState<ProgressionRule>(exercise?.progressionRule ?? "none");
  const [isUnilateral, setIsUnilateral] = useState(exercise?.isUnilateral ?? false);
  const [notes, setNotes] = useState(exercise?.notes ?? "");

  function handleSave() {
    if (!name.trim()) return;

    const baseWeight: WeightSpec = weightType === "progressive"
      ? { type: "progressive" }
      : { type: "fixed", value: weightValue };

    const repMax: RepTarget = repMaxType === "failure"
      ? { type: "failure" }
      : { type: "count", value: repMaxValue };

    const result: Exercise = {
      id: exercise?.id ?? crypto.randomUUID(),
      order,
      name: name.trim(),
      phase,
      equipmentType,
      equipmentDetail: equipmentDetail.trim() || null,
      baseWeight,
      sets,
      repMin,
      repMax,
      restSeconds,
      progressionRule,
      isUnilateral,
      notes: notes.trim() || null,
    };

    onSave(result);
  }

  const detailHint = equipmentType === "band" ? "e.g. Orange, Purple, Red, Blue"
    : equipmentType === "bodyweight" ? "e.g. table, rack, lacrosse_ball"
    : equipmentType === "powerblock" ? "e.g. 2lb (for regular dumbbell)"
    : "Optional";

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

        {/* Equipment */}
        <Field label="Equipment Type">
          <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value as EquipmentType)} className="input-field">
            {EQUIPMENT_TYPES.map((eq) => <option key={eq.value} value={eq.value}>{eq.label}</option>)}
          </select>
        </Field>

        <Field label={`Equipment Detail (${detailHint})`}>
          <input
            type="text"
            value={equipmentDetail}
            onChange={(e) => setEquipmentDetail(e.target.value)}
            placeholder={detailHint}
            className="input-field"
          />
        </Field>

        {/* Base Weight */}
        <Field label="Base Weight">
          <div className="flex gap-2 items-center">
            <select value={weightType} onChange={(e) => setWeightType(e.target.value as "fixed" | "progressive")} className="input-field flex-1">
              <option value="fixed">Fixed</option>
              <option value="progressive">Progressive</option>
            </select>
            {weightType === "fixed" && (
              <input
                type="number"
                value={weightValue}
                onChange={(e) => setWeightValue(parseFloat(e.target.value) || 0)}
                step="2.5"
                min={0}
                className="input-field w-24"
                placeholder="lbs"
              />
            )}
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

        {/* Reps */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Rep Min" noMargin>
            <input type="number" value={repMin} onChange={(e) => setRepMin(parseInt(e.target.value) || 0)} min={0} className="input-field" />
          </Field>
          <Field label="Rep Max" noMargin>
            <div className="flex gap-2 items-center">
              <select value={repMaxType} onChange={(e) => setRepMaxType(e.target.value as "count" | "failure")} className="input-field flex-1">
                <option value="count">Count</option>
                <option value="failure">AMRAP</option>
              </select>
              {repMaxType === "count" && (
                <input
                  type="number"
                  value={repMaxValue}
                  onChange={(e) => setRepMaxValue(parseInt(e.target.value) || 0)}
                  min={0}
                  className="input-field w-16"
                />
              )}
            </div>
          </Field>
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
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNew ? "Add" : "Save"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          background: rgb(31 41 55);
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(55 65 81);
          outline: none;
        }
        .input-field:focus {
          border-color: rgb(99 102 241);
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
