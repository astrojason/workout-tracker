"use client";

import { useId, useState } from "react";
import type { ExerciseDefinition, EquipmentItem, EquipmentType, GymMachine, ProgressionRule } from "@/lib/types";
import type { DefinitionSave } from "@/lib/firestore";
import { parseWeightOptions } from "@/lib/types";
import { GymMachineSelect } from "@/components/programs/GymMachineSelect";

const EQUIPMENT_OPTIONS: { value: EquipmentType; label: string }[] = [
  { value: "barbell_45", label: "Olympic Bar (45 lbs)" },
  { value: "barbell_35", label: "35 lb Bar" },
  { value: "barbell_ez", label: "EZ Bar (15 lbs)" },
  { value: "powerblock", label: "PowerBlock" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "band", label: "Serious Steel Band" },
  { value: "assisted_pullup", label: "Pull-Up Assist (Bands)" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "gripper", label: "Gripper" },
  { value: "machine", label: "Machine (weight stack)" },
];

const PROGRESSION_OPTIONS: { value: ProgressionRule; label: string }[] = [
  { value: "none", label: "None" },
  { value: "add_5lb", label: "Add 5 lbs" },
  { value: "add_2.5lb", label: "Add 2.5 lbs" },
  { value: "add_10lb", label: "Add 10 lbs" },
  { value: "add_weight", label: "Next weight step (machine / kettlebell)" },
  { value: "add_reps", label: "Add Reps" },
  { value: "add_time", label: "Add Time" },
  { value: "reduce_assistance", label: "Reduce Assistance" },
  { value: "maintain", label: "Maintain" },
  { value: "deload", label: "Deload" },
  { value: "progress_gripper", label: "Progress Gripper" },
];

interface Props {
  definition: ExerciseDefinition;
  machines: GymMachine[];
  items: EquipmentItem[];
  // "inline": the phone library's expanded row. "panel": the desktop side panel, two columns with
  // Save/Cancel pinned to the bottom while the fields scroll.
  variant: "inline" | "panel";
  // Throws on failure; the form reports it through onError and stays open.
  onSave: (save: DefinitionSave) => Promise<void>;
  onSaved: (save: DefinitionSave) => void;
  onCancel: () => void;
  onError: (err: unknown) => void;
}

// Edits one exercise in the library. Shared by the phone library and the desktop Exercises panel.
export function ExerciseDefinitionForm({ definition, machines, items, variant, onSave, onSaved, onCancel, onError }: Props) {
  const [name, setName] = useState(definition.name);
  const [brand, setBrand] = useState(definition.brand ?? "");
  const [weightOptionsText, setWeightOptionsText] = useState(definition.weightOptions?.join(", ") ?? "");
  // A linked machine's weights replace the typed list (definition.weightOptions already holds them).
  const [machineId, setMachineId] = useState(definition.machineId ?? "");
  // One of the user's own equipment items; an item that has since been removed counts as none.
  const [itemId, setItemId] = useState(items.some((i) => i.id === definition.equipmentItemId) ? definition.equipmentItemId! : "");
  const [muscleGroupsText, setMuscleGroupsText] = useState(definition.muscleGroups.join(", "));
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(definition.equipmentType);
  const [equipmentDetail, setEquipmentDetail] = useState(definition.equipmentDetail ?? "");
  const [progressionRule, setProgressionRule] = useState<ProgressionRule>(definition.progressionRule);
  const [isUnilateral, setIsUnilateral] = useState(definition.isUnilateral);
  const [isTimeBased, setIsTimeBased] = useState(definition.isTimeBased);
  const [currentWeight, setCurrentWeight] = useState(String(definition.currentWeight));
  const [hardStreak, setHardStreak] = useState(String(definition.hardStreak));
  const [saving, setSaving] = useState(false);

  const linkedMachine = equipmentType === "machine" ? machines.find((m) => m.id === machineId) ?? null : null;
  const panel = variant === "panel";
  // Paired fields sit side by side in the panel and stack in the phone row.
  const pair = panel ? "col-span-1" : "col-span-2";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const weight = parseFloat(currentWeight) || 0;
      const streak = parseInt(hardStreak, 10) || 0;
      const save: DefinitionSave = {
        meta: {
          name: name.trim(),
          brand: brand.trim() || null,
          weightOptions: equipmentType === "machine" ? (linkedMachine?.plates ?? parseWeightOptions(weightOptionsText)) : null,
          machineId: linkedMachine?.id ?? null,
          equipmentItemId: itemId || null,
          muscleGroups: muscleGroupsText.split(",").map((m) => m.trim()).filter(Boolean),
          equipmentType,
          equipmentDetail: equipmentType === "band" ? (equipmentDetail.trim() || null) : null,
          progressionRule,
          isUnilateral,
          isTimeBased,
        },
        weight: weight !== definition.currentWeight || streak !== definition.hardStreak ? { currentWeight: weight, hardStreak: streak } : null,
      };
      await onSave(save);
      setSaving(false);
      onSaved(save);
    } catch (err) {
      setSaving(false);
      onError(err);
    }
  }

  const fields = (
    <div className={`grid grid-cols-2 ${panel ? "gap-x-4 gap-y-4" : "gap-3"}`}>
      <Field label="Name" className={pair}>
        {(id) => <input id={id} type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />}
      </Field>
      <Field label="Brand (optional)" className={pair}>
        {(id) => <input id={id} type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Lifecycle" className="input-field" />}
      </Field>
      <Field label="Muscle Groups (comma-separated)" className="col-span-2">
        {(id) => <input id={id} type="text" value={muscleGroupsText} onChange={(e) => setMuscleGroupsText(e.target.value)} placeholder="e.g. Chest, Triceps" className="input-field" />}
      </Field>
      <Field label="Equipment">
        {(id) => (
          <select id={id} value={equipmentType} onChange={(e) => setEquipmentType(e.target.value as EquipmentType)} className="input-field">
            {EQUIPMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </Field>
      <Field label="Progression Rule">
        {(id) => (
          <select id={id} value={progressionRule} onChange={(e) => setProgressionRule(e.target.value as ProgressionRule)} className="input-field">
            {PROGRESSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </Field>
      <Field label="Your own equipment item (optional)" className="col-span-2">
        {(id) => (
          <>
            <select id={id} aria-label="Equipment item" value={itemId} onChange={(e) => setItemId(e.target.value)} className="input-field">
              <option value="">None — use the equipment type above</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            {items.length === 0 && <p className="mt-1 text-xs text-gray-500">Add items under Equipment → Your own equipment.</p>}
          </>
        )}
      </Field>
      {equipmentType === "machine" && machines.length > 0 && (
        <div className="col-span-2"><GymMachineSelect machines={machines} value={machineId} onChange={setMachineId} /></div>
      )}
      {equipmentType === "machine" && !linkedMachine && (
        <Field label="Weights the machine can be set to (comma-separated)" className="col-span-2">
          {(id) => <input id={id} type="text" value={weightOptionsText} onChange={(e) => setWeightOptionsText(e.target.value)} placeholder="e.g. 50, 75, 100, 150" className="input-field" />}
        </Field>
      )}
      {equipmentType === "band" && (
        <Field label="Band Color" className="col-span-2">
          {(id) => <input id={id} type="text" value={equipmentDetail} onChange={(e) => setEquipmentDetail(e.target.value)} placeholder="e.g. Blue" className="input-field" />}
        </Field>
      )}
      <Field label="Default Weight (lbs)">
        {(id) => (
          <>
            <input id={id} type="number" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} step="2.5" className="input-field" />
            <p className="mt-1 text-xs text-gray-500">Each program tracks its own working weight.</p>
          </>
        )}
      </Field>
      <Field label="Hard Streak (0-2)">
        {(id) => <input id={id} type="number" value={hardStreak} onChange={(e) => setHardStreak(e.target.value)} min={0} max={2} className="input-field" />}
      </Field>
      <div className={`${pair} flex items-center justify-between gap-3`}>
        <span className="text-sm text-gray-400">Each Side (Unilateral)</span>
        <Toggle label="Each Side (Unilateral)" checked={isUnilateral} onChange={setIsUnilateral} />
      </div>
      <div className={`${pair} flex items-center justify-between gap-3`}>
        <span className="text-sm text-gray-400">Time Based</span>
        <Toggle label="Time Based" checked={isTimeBased} onChange={setIsTimeBased} />
      </div>
    </div>
  );

  const buttons = (
    <div className="flex gap-3">
      <button type="button" onClick={onCancel} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition text-sm disabled:opacity-50">
        Cancel
      </button>
      <button type="submit" disabled={!name.trim() || saving} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition text-sm disabled:opacity-50">
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );

  if (panel) {
    return (
      <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <p className="text-xs text-gray-500 mb-4">Shared by every program that uses it: changes apply everywhere, going forward.</p>
          {fields}
        </div>
        <div className="border-t border-gray-800 px-6 py-4">{buttons}</div>
      </form>
    );
  }
  return (
    <form onSubmit={handleSave} className="px-4 py-4 space-y-4 bg-gray-800/30">
      {fields}
      <div className="pt-2">{buttons}</div>
    </form>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`shrink-0 w-12 h-7 rounded-full transition relative ${checked ? "bg-indigo-600" : "bg-gray-700"}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Field({ label, children, className = "col-span-1" }: { label: string; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs text-gray-400 block mb-1">{label}</label>
      {children(id)}
    </div>
  );
}
