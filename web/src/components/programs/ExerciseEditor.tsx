"use client";

import { useState } from "react";
import type { Exercise, Phase, EquipmentType, ProgressionRule, WeightSpec, RepTarget, UserEquipmentConfig } from "@/lib/types";
import { barWeight as getBarWeight } from "@/lib/types";
import {
  calculateBarbell,
  getPowerBlockInstructions,
  nearestPowerBlock,
  plateDisplayString,
  KETTLEBELL_WEIGHTS,
  DEFAULT_EQUIPMENT_CONFIG,
} from "@/lib/equipment-calculator";

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

const BAND_OPTIONS = [
  { value: "Orange", label: "Orange (2–12 lbs)" },
  { value: "Purple", label: "Purple (5–35 lbs)" },
  { value: "Red", label: "Red (10–50 lbs)" },
  { value: "Blue", label: "Blue (20–80 lbs)" },
  { value: "Green", label: "Green (50–120 lbs)" },
  { value: "Black", label: "Black (60–150 lbs)" },
];

function defaultWeightForType(t: EquipmentType): string {
  switch (t) {
    case "barbell_45": return "45";
    case "barbell_35": return "35";
    case "barbell_ez": return "15";
    case "powerblock": return "25";
    case "dumbbell": return "10";
    case "kettlebell": return String(KETTLEBELL_WEIGHTS[0]);
    case "assisted_pullup": return "1";
    case "gripper": return "10";
    default: return "0";
  }
}

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
  const [weightWarning, setWeightWarning] = useState<string | null>(null);

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
  const barWeightLbs = getBarWeight(equipmentType);

  function handleEquipmentChange(newType: EquipmentType) {
    setEquipmentType(newType);
    setBarbellError(null);
    setWeightWarning(null);
    setWeightValue(defaultWeightForType(newType));
  }

  function handleBarbellBlur() {
    if (!barWeightLbs) return;
    const target = parseFloat(weightValue);
    if (isNaN(target)) return;

    if (target < barWeightLbs) {
      setBarbellError(`Minimum weight for this bar is ${barWeightLbs} lbs.`);
      setWeightWarning(null);
      return;
    }

    setBarbellError(null);
    const config = calculateBarbell(target, barWeightLbs, equipmentConfig);

    if (config.achievedWeight !== target) {
      setWeightValue(String(config.achievedWeight));
      const plateStr = config.perSide.length > 0
        ? `${barWeightLbs} lb bar + ${plateDisplayString(config)}/side`
        : `${barWeightLbs} lb bar only`;
      setWeightWarning(
        `${target} lbs isn't possible with available plates. Adjusted to ${config.achievedWeight} lbs.\n${plateStr}`
      );
    } else {
      setWeightWarning(null);
    }
  }

  function handlePowerBlockBlur() {
    const val = parseFloat(weightValue);
    if (isNaN(val)) {
      setWeightValue(String(powerBlockMin));
      setWeightWarning(null);
      return;
    }
    const clamped = nearestPowerBlock(val, equipmentConfig);
    if (clamped !== val) {
      setWeightWarning(`Clamped to ${clamped} lbs (PowerBlock range: ${powerBlockMin}–${powerBlockMax} lbs).`);
    } else {
      setWeightWarning(null);
    }
    setWeightValue(String(clamped));
  }

  function handlePullupChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value);
    const min = pullupBandsCap > 0 ? 1 : 0;
    setWeightValue(isNaN(val) || val < min ? String(min) : String(val));
  }

  // ── Inline hints (computed from current state) ──

  let barbellHint: string | null = null;
  if (isBarbellType && !barbellError && barWeightLbs) {
    const target = parseFloat(weightValue);
    if (!isNaN(target) && target >= barWeightLbs) {
      const plateConfig = calculateBarbell(target, barWeightLbs, equipmentConfig);
      if (plateConfig.perSide.length === 0) {
        barbellHint = `${barWeightLbs} lb bar only`;
      } else {
        barbellHint = `${barWeightLbs} lb bar + ${plateDisplayString(plateConfig)}/side → ${plateConfig.achievedWeight} lbs`;
      }
    }
  }

  let powerBlockHint: string | null = null;
  if (equipmentType === "powerblock") {
    const val = parseFloat(weightValue);
    if (!isNaN(val)) {
      const snapped = nearestPowerBlock(val, equipmentConfig);
      const inst = getPowerBlockInstructions(snapped);
      powerBlockHint = `${snapped} lbs — ${inst.label}`;
    }
  }

  const powerBlockMin = equipmentConfig?.powerBlock?.minLbs ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock.minLbs;
  const powerBlockMax = equipmentConfig?.powerBlock?.maxLbs ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock.maxLbs;

  // Fall back to the default cap when config is missing (so the input stays capped rather than becoming unbounded).
  // A configured cap of 0 is respected (min becomes 0 and max becomes 0).
  const pullupBandsCap = equipmentConfig?.assistedPullupBands ?? DEFAULT_EQUIPMENT_CONFIG.assistedPullupBands;

  let pullupHint: string | null = null;
  if (equipmentType === "assisted_pullup") {
    const bands = parseInt(weightValue);
    if (!isNaN(bands) && bands >= 1) {
      pullupHint = `${bands} ${bands === 1 ? "band" : "bands"} (~${bands * 80} lbs assistance)`;
    }
  }

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
              <option value="powerblock">PowerBlock (5–50 lbs)</option>
              <option value="dumbbell">Dumbbell</option>
              <option value="band">Serious Steel Band</option>
              <option value="assisted_pullup">Pull-Up Assist (Bands)</option>
              <option value="kettlebell">Kettlebell</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="gripper">Gripper</option>
            </select>

            {/* Barbell weight */}
            {isBarbellType && (
              <div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={weightValue}
                    onChange={(e) => {
                      setWeightValue(e.target.value);
                      setBarbellError(null);
                      setWeightWarning(null);
                    }}
                    onBlur={handleBarbellBlur}
                    step="2.5"
                    min={0}
                    className={`input-field w-24 ${barbellError ? "border-red-500" : ""}`}
                    placeholder="lbs"
                  />
                </div>
                {barbellError && (
                  <p className="text-red-400 text-xs mt-1">⚠ {barbellError}</p>
                )}
                {weightWarning && !barbellError && weightWarning.split("\n").map((line, i) => (
                  <p key={i} className="text-yellow-400 text-xs mt-1">{i === 0 ? `⚠ ${line}` : line}</p>
                ))}
                {!barbellError && !weightWarning && barbellHint && (
                  <p className="text-gray-500 text-xs mt-1">{barbellHint}</p>
                )}
              </div>
            )}

            {/* PowerBlock weight */}
            {equipmentType === "powerblock" && (
              <div>
                <input
                  type="number"
                  value={weightValue}
                  onChange={(e) => { setWeightValue(e.target.value); setWeightWarning(null); }}
                  onBlur={handlePowerBlockBlur}
                  step="2.5"
                  min={powerBlockMin}
                  max={powerBlockMax}
                  className="input-field"
                  placeholder="lbs"
                />
                {weightWarning && <p className="text-yellow-400 text-xs mt-1">⚠ {weightWarning}</p>}
                {powerBlockHint && <p className="text-gray-500 text-xs mt-1">{powerBlockHint}</p>}
              </div>
            )}

            {/* Dumbbell weight */}
            {equipmentType === "dumbbell" && (
              <input
                type="number"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                step="2.5"
                min={0}
                className="input-field"
                placeholder="lbs"
              />
            )}

            {/* Band select */}
            {equipmentType === "band" && (
              <select
                value={equipmentDetail}
                onChange={(e) => setEquipmentDetail(e.target.value)}
                className="input-field"
              >
                {(equipmentConfig?.bands?.length ? equipmentConfig.bands : BAND_OPTIONS.map((b) => b.value)).map((color) => {
                  const opt = BAND_OPTIONS.find((b) => b.value === color);
                  return <option key={color} value={color}>{opt?.label ?? color}</option>;
                })}
              </select>
            )}

            {/* Pull-Up Assist */}
            {equipmentType === "assisted_pullup" && (
              <div>
                <input
                  type="number"
                  value={weightValue}
                  onChange={handlePullupChange}
                  step="1"
                  min={pullupBandsCap > 0 ? 1 : 0}
                  max={pullupBandsCap}
                  className="input-field"
                  placeholder="number of bands"
                />
                {pullupHint && <p className="text-gray-500 text-xs mt-1">{pullupHint}</p>}
              </div>
            )}

            {/* Kettlebell select */}
            {equipmentType === "kettlebell" && (
              <select
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                className="input-field"
              >
                {(equipmentConfig?.kettlebells?.length ? equipmentConfig.kettlebells : KETTLEBELL_WEIGHTS).map((w) => (
                  <option key={w} value={String(w)}>{w} lbs</option>
                ))}
              </select>
            )}

            {/* Gripper weight */}
            {equipmentType === "gripper" && (
              <input
                type="number"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                step="5"
                min={0}
                className="input-field"
                placeholder="lbs"
              />
            )}

            {/* Bodyweight: no weight input */}
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

      <style jsx>{`
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
