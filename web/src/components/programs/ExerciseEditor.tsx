"use client";

import { useState } from "react";
import type {
  Exercise, ExerciseDefinition, Phase, EquipmentType, ProgressionRule, RepTarget, UserEquipmentConfig,
} from "@/lib/types";
import { DEFAULT_EQUIPMENT_CONFIG } from "@/lib/equipment-calculator";
import { EquipmentWeightInput, defaultWeightForType } from "./EquipmentWeightInput";
import Link from "next/link";

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

// Result handed back to the parent, which owns all Firestore persistence (this
// component stays a pure form). "existing" reuses a definition already in the
// library — only the occurrence and (optionally) the shared weight change.
// "new" creates a brand-new definition; the parent fills in its id afterward.
export type ExerciseEditorResult =
  | { kind: "existing"; definitionId: string; occurrence: Exercise; weight: number }
  | { kind: "new"; definition: Omit<ExerciseDefinition, "id" | "createdAt" | "updatedAt">; occurrence: Omit<Exercise, "definitionId"> };

interface ExerciseEditorProps {
  exercise: (Exercise & { definitionName?: string }) | null;
  maxOrder: number;
  definitions: ExerciseDefinition[];
  onSave: (result: ExerciseEditorResult) => void;
  onCancel: () => void;
  equipmentConfig?: UserEquipmentConfig;
}

const NEW_SENTINEL = "__new__";

export function ExerciseEditor({ exercise, maxOrder, definitions, onSave, onCancel, equipmentConfig }: ExerciseEditorProps) {
  const isNewOccurrence = !exercise;
  const sortedDefinitions = [...definitions].sort((a, b) => a.name.localeCompare(b.name));

  const [selectedId, setSelectedId] = useState<string>(exercise?.definitionId ?? NEW_SENTINEL);
  const selectedDef = selectedId === NEW_SENTINEL ? null : sortedDefinitions.find((d) => d.id === selectedId) ?? null;
  const creatingNew = selectedId === NEW_SENTINEL;

  // Fields for a brand-new definition (only used when creatingNew)
  const [name, setName] = useState(exercise?.definitionName ?? "");
  const [muscleGroupsText, setMuscleGroupsText] = useState("");
  const [equipmentType, setEquipmentType] = useState<EquipmentType>("barbell_45");
  const [equipmentDetail, setEquipmentDetail] = useState("Orange");
  const [progressionRule, setProgressionRule] = useState<ProgressionRule>("none");
  const [timeBased, setTimeBased] = useState(false);
  const [isUnilateral, setIsUnilateral] = useState(false);

  const effectiveEquipmentType = selectedDef?.equipmentType ?? equipmentType;
  const effectiveTimeBased = selectedDef?.isTimeBased ?? timeBased;

  const [weightValue, setWeightValue] = useState(
    selectedDef ? String(selectedDef.currentWeight) : defaultWeightForType(effectiveEquipmentType)
  );
  const [barbellError, setBarbellError] = useState<string | null>(null);

  function handleSelectDefinition(id: string) {
    setSelectedId(id);
    setBarbellError(null);
    if (id === NEW_SENTINEL) {
      setWeightValue(defaultWeightForType(equipmentType));
    } else {
      const def = sortedDefinitions.find((d) => d.id === id);
      setWeightValue(String(def?.currentWeight ?? 0));
    }
  }

  function handleEquipmentChange(newType: EquipmentType) {
    setEquipmentType(newType);
    setBarbellError(null);
    setWeightValue(defaultWeightForType(newType));
  }

  // Occurrence (scheduling) fields — always editable, regardless of picker mode
  const [phase, setPhase] = useState<Phase>(exercise?.phase ?? "main");
  const [order, setOrder] = useState(exercise?.order ?? maxOrder + 1);
  const [sets, setSets] = useState(exercise?.sets ?? 3);
  const [repMin, setRepMin] = useState(exercise?.repMin ?? 8);
  const [repMaxValue, setRepMaxValue] = useState(exercise?.repMax.type === "count" ? exercise.repMax.value : 12);
  const [restSeconds, setRestSeconds] = useState(exercise?.restSeconds ?? 120);
  const [finalSetAmrap, setFinalSetAmrap] = useState(exercise?.repMax.type === "failure");
  const [notes, setNotes] = useState(exercise?.notes ?? "");

  const isBarbellType = effectiveEquipmentType === "barbell_45" || effectiveEquipmentType === "barbell_35" || effectiveEquipmentType === "barbell_ez";
  const powerBlockMin = equipmentConfig?.powerBlock?.minLbs ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock.minLbs;
  const powerBlockMax = equipmentConfig?.powerBlock?.maxLbs ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock.maxLbs;

  function handleSave() {
    if (creatingNew && !name.trim()) return;
    if (isBarbellType && barbellError) return;

    const repMax: RepTarget = finalSetAmrap
      ? { type: "failure" }
      : { type: "count", value: repMaxValue };

    const occurrenceBase = {
      id: exercise?.id ?? crypto.randomUUID(),
      order,
      phase,
      sets,
      repMin,
      repMax,
      restSeconds,
      notes: notes.trim() || null,
      ...(finalSetAmrap ? { lastSetAmrap: true as const } : {}),
    };

    if (creatingNew) {
      onSave({
        kind: "new",
        definition: {
          name: name.trim(),
          muscleGroups: muscleGroupsText.split(",").map((m) => m.trim()).filter(Boolean),
          equipmentType,
          equipmentDetail: equipmentType === "band" ? (equipmentDetail || "Orange") : null,
          progressionRule,
          isUnilateral,
          isTimeBased: timeBased,
          currentWeight: parseFloat(weightValue) || 0,
          hardStreak: 0,
        },
        occurrence: occurrenceBase,
      });
    } else if (selectedDef) {
      onSave({
        kind: "existing",
        definitionId: selectedDef.id,
        occurrence: { ...occurrenceBase, definitionId: selectedDef.id },
        weight: parseFloat(weightValue) || 0,
      });
    }
  }

  const hasBlockingError = isBarbellType && !!barbellError;
  const canSave = creatingNew ? !!name.trim() && !hasBlockingError : !!selectedDef && !hasBlockingError;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center overflow-y-auto">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 border border-gray-800 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-5">{isNewOccurrence ? "Add Exercise" : "Edit Exercise"}</h3>

        {/* Exercise picker */}
        <Field label="Exercise">
          <select value={selectedId} onChange={(e) => handleSelectDefinition(e.target.value)} className="input-field">
            <option value={NEW_SENTINEL}>+ New Exercise</option>
            {sortedDefinitions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>

        {creatingNew ? (
          <Field label="Exercise Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bench Press"
              className="input-field"
            />
          </Field>
        ) : selectedDef ? (
          <div className="mb-4 bg-gray-800/50 rounded-xl p-3 text-xs text-gray-400 space-y-1">
            <div>{selectedDef.equipmentType.replace(/_/g, " ")}{selectedDef.equipmentDetail ? ` · ${selectedDef.equipmentDetail}` : ""} · {selectedDef.progressionRule.replace(/_/g, " ")}</div>
            {selectedDef.muscleGroups.length > 0 && <div>{selectedDef.muscleGroups.join(", ")}</div>}
            <Link href="/settings/exercises" className="text-indigo-400 hover:text-indigo-300 inline-block">
              Edit in Exercise Library →
            </Link>
          </div>
        ) : null}

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

        {/* Equipment (new only) */}
        {creatingNew && (
          <Field label="Equipment">
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
          </Field>
        )}

        {/* Weight — always editable; for an existing exercise this is the shared
            currentWeight, so the change affects every occurrence in every program. */}
        <Field label={selectedDef ? "Weight (updates every occurrence of this exercise)" : "Starting Weight"}>
          <EquipmentWeightInput
            equipmentType={effectiveEquipmentType}
            weightValue={weightValue}
            onWeightValueChange={setWeightValue}
            equipmentDetail={creatingNew ? equipmentDetail : (selectedDef?.equipmentDetail ?? "")}
            onEquipmentDetailChange={setEquipmentDetail}
            equipmentConfig={equipmentConfig}
            onBarbellErrorChange={setBarbellError}
          />
        </Field>

        {/* Sets */}
        <Field label="Sets">
          <div className="flex items-center gap-3">
            <button onClick={() => setSets(Math.max(1, sets - 1))} className="btn-stepper">-</button>
            <span className="text-xl font-bold w-8 text-center">{sets}</span>
            <button onClick={() => setSets(sets + 1)} className="btn-stepper">+</button>
          </div>
        </Field>

        {/* Time Based toggle (new only — otherwise inherited from the definition) */}
        {creatingNew && (
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
        )}

        {/* Reps / Duration */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label={effectiveTimeBased ? "Duration Min (s)" : "Rep Min"} noMargin>
            <input type="number" value={repMin} onChange={(e) => setRepMin(parseInt(e.target.value) || 0)} min={0} step={effectiveTimeBased ? 5 : 1} className="input-field" />
          </Field>
          <Field label={effectiveTimeBased ? "Duration Max (s)" : "Rep Max"} noMargin>
            <input type="number" value={repMaxValue} onChange={(e) => setRepMaxValue(parseInt(e.target.value) || 0)} min={0} step={effectiveTimeBased ? 5 : 1} className="input-field" />
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

        {/* Progression + Muscle Groups + Unilateral (new only) */}
        {creatingNew && (
          <>
            <Field label="Progression Rule">
              <select value={progressionRule} onChange={(e) => setProgressionRule(e.target.value as ProgressionRule)} className="input-field">
                {PROGRESSION_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>

            <Field label="Muscle Groups (comma-separated)">
              <input
                type="text"
                value={muscleGroupsText}
                onChange={(e) => setMuscleGroupsText(e.target.value)}
                placeholder="e.g. Chest, Triceps"
                className="input-field"
              />
            </Field>

            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-400">Each Side (Unilateral)</span>
              <button
                onClick={() => setIsUnilateral(!isUnilateral)}
                className={`w-12 h-7 rounded-full transition relative ${isUnilateral ? "bg-indigo-600" : "bg-gray-700"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${isUnilateral ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </>
        )}

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
            disabled={!canSave}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNewOccurrence ? "Add" : "Save"}
          </button>
        </div>
      </div>
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
