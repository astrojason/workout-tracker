"use client";

import { useState } from "react";
import type { EquipmentType, UserEquipmentConfig } from "@/lib/types";
import { barWeight as getBarWeight, ALL_LOOP_BAND_SIZES } from "@/lib/types";
import {
  calculateBarbell,
  calculateLandmine,
  getPowerBlockInstructions,
  nearestPowerBlock,
  plateDisplayString,
  KETTLEBELL_WEIGHTS,
  DEFAULT_EQUIPMENT_CONFIG,
} from "@/lib/equipment-calculator";

export const BAND_OPTIONS = [
  { value: "Orange", label: "Orange (2–12 lbs)" },
  { value: "Purple", label: "Purple (5–35 lbs)" },
  { value: "Red", label: "Red (10–50 lbs)" },
  { value: "Blue", label: "Blue (20–80 lbs)" },
  { value: "Green", label: "Green (50–120 lbs)" },
  { value: "Black", label: "Black (60–150 lbs)" },
];

export function defaultWeightForType(t: EquipmentType): string {
  switch (t) {
    case "barbell_45": return "45";
    case "barbell_35": return "35";
    case "barbell_ez": return "15";
    case "powerblock": return "25";
    case "dumbbell": return "10";
    case "kettlebell": return String(KETTLEBELL_WEIGHTS[0]);
    case "assisted_pullup": return "1";
    case "gripper": return "10";
    case "pulley": return "0";
    default: return "0";
  }
}

interface EquipmentWeightInputProps {
  equipmentType: EquipmentType;
  weightValue: string;
  onWeightValueChange: (value: string) => void;
  equipmentDetail: string;
  onEquipmentDetailChange: (value: string) => void;
  equipmentConfig?: UserEquipmentConfig;
  onBarbellErrorChange: (error: string | null) => void;
}

export function EquipmentWeightInput({
  equipmentType, weightValue, onWeightValueChange, equipmentDetail, onEquipmentDetailChange, equipmentConfig, onBarbellErrorChange,
}: EquipmentWeightInputProps) {
  switch (equipmentType) {
    case "barbell_45":
    case "barbell_35":
    case "barbell_ez":
      return (
        <BarbellWeightInput
          equipmentType={equipmentType}
          value={weightValue}
          onChange={onWeightValueChange}
          equipmentConfig={equipmentConfig}
          onErrorChange={onBarbellErrorChange}
        />
      );
    case "powerblock":
      return <PowerBlockWeightInput value={weightValue} onChange={onWeightValueChange} equipmentConfig={equipmentConfig} />;
    case "dumbbell":
      return <DumbbellWeightInput value={weightValue} onChange={onWeightValueChange} />;
    case "band":
      return <BandColorSelect value={equipmentDetail} onChange={onEquipmentDetailChange} equipmentConfig={equipmentConfig} />;
    case "loop_band":
      return <LoopBandSizeSelect value={equipmentDetail} onChange={onEquipmentDetailChange} equipmentConfig={equipmentConfig} />;
    case "assisted_pullup":
      return <PullupAssistWeightInput value={weightValue} onChange={onWeightValueChange} equipmentConfig={equipmentConfig} />;
    case "kettlebell":
      return <KettlebellWeightSelect value={weightValue} onChange={onWeightValueChange} equipmentConfig={equipmentConfig} />;
    case "gripper":
      return <GripperWeightInput value={weightValue} onChange={onWeightValueChange} />;
    case "pulley":
      return <PulleyWeightInput value={weightValue} onChange={onWeightValueChange} equipmentConfig={equipmentConfig} />;
    default:
      return null;
  }
}

function BarbellWeightInput({
  equipmentType, value, onChange, equipmentConfig, onErrorChange,
}: {
  equipmentType: EquipmentType;
  value: string;
  onChange: (value: string) => void;
  equipmentConfig?: UserEquipmentConfig;
  onErrorChange: (error: string | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const barWeightLbs = getBarWeight(equipmentType);

  function setErrorAndNotify(next: string | null) {
    setError(next);
    onErrorChange(next);
  }

  function handleBlur() {
    if (!barWeightLbs) return;
    const target = parseFloat(value);
    if (isNaN(target)) return;

    if (target < barWeightLbs) {
      setErrorAndNotify(`Minimum weight for this bar is ${barWeightLbs} lbs.`);
      setWarning(null);
      return;
    }

    setErrorAndNotify(null);
    const config = calculateBarbell(target, barWeightLbs, equipmentConfig);

    if (config.achievedWeight !== target) {
      onChange(String(config.achievedWeight));
      const plateStr = config.perSide.length > 0
        ? `${barWeightLbs} lb bar + ${plateDisplayString(config)}/side`
        : `${barWeightLbs} lb bar only`;
      setWarning(
        `${target} lbs isn't possible with available plates. Adjusted to ${config.achievedWeight} lbs.\n${plateStr}`
      );
    } else {
      setWarning(null);
    }
  }

  let hint: string | null = null;
  if (!error && barWeightLbs) {
    const target = parseFloat(value);
    if (!isNaN(target) && target >= barWeightLbs) {
      const plateConfig = calculateBarbell(target, barWeightLbs, equipmentConfig);
      hint = plateConfig.perSide.length === 0
        ? `${barWeightLbs} lb bar only`
        : `${barWeightLbs} lb bar + ${plateDisplayString(plateConfig)}/side → ${plateConfig.achievedWeight} lbs`;
    }
  }

  return (
    <div>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setErrorAndNotify(null);
            setWarning(null);
          }}
          onBlur={handleBlur}
          step="2.5"
          min={0}
          className={`input-field w-24 ${error ? "border-red-500" : ""}`}
          placeholder="lbs"
        />
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-1">⚠ {error}</p>
      )}
      {warning && !error && warning.split("\n").map((line, i) => (
        <p key={i} className="text-yellow-400 text-xs mt-1">{i === 0 ? `⚠ ${line}` : line}</p>
      ))}
      {!error && !warning && hint && (
        <p className="text-gray-500 text-xs mt-1">{hint}</p>
      )}
    </div>
  );
}

function PowerBlockWeightInput({
  value, onChange, equipmentConfig,
}: {
  value: string;
  onChange: (value: string) => void;
  equipmentConfig?: UserEquipmentConfig;
}) {
  const [warning, setWarning] = useState<string | null>(null);
  const min = equipmentConfig?.powerBlock?.minLbs ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock.minLbs;
  const max = equipmentConfig?.powerBlock?.maxLbs ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock.maxLbs;

  function handleBlur() {
    const val = parseFloat(value);
    if (isNaN(val)) {
      onChange(String(min));
      setWarning(null);
      return;
    }
    const clamped = nearestPowerBlock(val, equipmentConfig);
    if (clamped !== val) {
      setWarning(`Clamped to ${clamped} lbs (PowerBlock range: ${min}–${max} lbs).`);
    } else {
      setWarning(null);
    }
    onChange(String(clamped));
  }

  let hint: string | null = null;
  const val = parseFloat(value);
  if (!isNaN(val)) {
    const snapped = nearestPowerBlock(val, equipmentConfig);
    const inst = getPowerBlockInstructions(snapped);
    hint = `${snapped} lbs — ${inst.label}`;
  }

  return (
    <div>
      <input
        type="number"
        value={value}
        onChange={(e) => { onChange(e.target.value); setWarning(null); }}
        onBlur={handleBlur}
        step="2.5"
        min={min}
        max={max}
        className="input-field"
        placeholder="lbs"
      />
      {warning && <p className="text-yellow-400 text-xs mt-1">⚠ {warning}</p>}
      {hint && <p className="text-gray-500 text-xs mt-1">{hint}</p>}
    </div>
  );
}

function DumbbellWeightInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      step="2.5"
      min={0}
      className="input-field"
      placeholder="lbs"
    />
  );
}

function BandColorSelect({
  value, onChange, equipmentConfig,
}: {
  value: string;
  onChange: (value: string) => void;
  equipmentConfig?: UserEquipmentConfig;
}) {
  const colors = equipmentConfig?.bands?.length ? equipmentConfig.bands : BAND_OPTIONS.map((b) => b.value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
      {colors.map((color) => {
        const opt = BAND_OPTIONS.find((b) => b.value === color);
        return <option key={color} value={color}>{opt?.label ?? color}</option>;
      })}
    </select>
  );
}

function LoopBandSizeSelect({
  value, onChange, equipmentConfig,
}: {
  value: string;
  onChange: (value: string) => void;
  equipmentConfig?: UserEquipmentConfig;
}) {
  const sizes = equipmentConfig?.loopBands?.length ? equipmentConfig.loopBands : ALL_LOOP_BAND_SIZES;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
      {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
    </select>
  );
}

function PullupAssistWeightInput({
  value, onChange, equipmentConfig,
}: {
  value: string;
  onChange: (value: string) => void;
  equipmentConfig?: UserEquipmentConfig;
}) {
  const cap = equipmentConfig?.assistedPullupBands ?? DEFAULT_EQUIPMENT_CONFIG.assistedPullupBands;
  const min = cap > 0 ? 1 : 0;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value);
    onChange(isNaN(val) || val < min ? String(min) : String(val));
  }

  let hint: string | null = null;
  const bands = parseInt(value);
  if (!isNaN(bands) && bands >= 1) {
    hint = `${bands} ${bands === 1 ? "band" : "bands"} (~${bands * 80} lbs assistance)`;
  }

  return (
    <div>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        step="1"
        min={min}
        max={cap}
        className="input-field"
        placeholder="number of bands"
      />
      {hint && <p className="text-gray-500 text-xs mt-1">{hint}</p>}
    </div>
  );
}

function KettlebellWeightSelect({
  value, onChange, equipmentConfig,
}: {
  value: string;
  onChange: (value: string) => void;
  equipmentConfig?: UserEquipmentConfig;
}) {
  const weights = equipmentConfig?.kettlebells?.length ? equipmentConfig.kettlebells : KETTLEBELL_WEIGHTS;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
      {weights.map((w) => (
        <option key={w} value={String(w)}>{w} lbs</option>
      ))}
    </select>
  );
}

function GripperWeightInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      step="5"
      min={0}
      className="input-field"
      placeholder="lbs"
    />
  );
}

// Plate-loaded pulley/cable attachment (e.g. Spud Pulley System): no bar weight,
// no per-side split — reuses the single-sided ("landmine") plate finder with
// bWeight=0 so the hint shows exactly which plates to load on the pin.
function PulleyWeightInput({
  value, onChange, equipmentConfig,
}: {
  value: string;
  onChange: (value: string) => void;
  equipmentConfig?: UserEquipmentConfig;
}) {
  const [warning, setWarning] = useState<string | null>(null);

  function handleBlur() {
    const target = parseFloat(value);
    if (isNaN(target) || target <= 0) {
      setWarning(null);
      return;
    }
    const config = calculateLandmine(target, 0, equipmentConfig);
    if (config.achievedWeight !== target) {
      onChange(String(config.achievedWeight));
      const plateStr = config.perSide.length > 0 ? `Load: ${plateDisplayString(config)}` : "No plates achievable";
      setWarning(
        `${target} lbs isn't possible with available plates. Adjusted to ${config.achievedWeight} lbs.\n${plateStr}`
      );
    } else {
      setWarning(null);
    }
  }

  let hint: string | null = null;
  const target = parseFloat(value);
  if (!isNaN(target) && target > 0) {
    const config = calculateLandmine(target, 0, equipmentConfig);
    hint = config.perSide.length === 0
      ? "No plates needed"
      : `Load: ${plateDisplayString(config)} → ${config.achievedWeight} lbs`;
  }

  return (
    <div>
      <input
        type="number"
        value={value}
        onChange={(e) => { onChange(e.target.value); setWarning(null); }}
        onBlur={handleBlur}
        step="2.5"
        min={0}
        className="input-field"
        placeholder="lbs"
      />
      {warning && warning.split("\n").map((line, i) => (
        <p key={i} className="text-yellow-400 text-xs mt-1">{i === 0 ? `⚠ ${line}` : line}</p>
      ))}
      {!warning && hint && (
        <p className="text-gray-500 text-xs mt-1">{hint}</p>
      )}
    </div>
  );
}
