"use client";

import { useId, useState } from "react";
import type { ExerciseDefinition, GymMachine, ProgressionRule, UserEquipmentConfig } from "@/lib/types";
import type { DefinitionSave } from "@/lib/firestore";
import { cleanWeight, parseWeightOptions } from "@/lib/types";
import { applyEquipmentChoice, equipmentChoiceValue, equipmentOptionGroups } from "@/lib/equipment-choices";
import { progressionOptionGroups } from "@/lib/progression-choices";

interface Props {
  definition: ExerciseDefinition;
  machines: GymMachine[];
  // What you own: the Equipment dropdown and band colours come from it.
  equipment: UserEquipmentConfig;
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
export function ExerciseDefinitionForm({ definition, machines, equipment, variant, onSave, onSaved, onCancel, onError }: Props) {
  const [name, setName] = useState(definition.name);
  const [brand, setBrand] = useState(definition.brand ?? "");
  const [weightOptionsText, setWeightOptionsText] = useState(definition.weightOptions?.join(", ") ?? "");
  const [muscleGroupsText, setMuscleGroupsText] = useState(definition.muscleGroups.join(", "));
  // One choice covers built-in equipment, your own items and gym machines (see equipment-choices).
  const [choice, setChoice] = useState(() => equipmentChoiceValue(definition, equipment));
  const [equipmentDetail, setEquipmentDetail] = useState(definition.equipmentDetail ?? "");
  const [progressionRule, setProgressionRule] = useState<ProgressionRule>(definition.progressionRule);
  const [isUnilateral, setIsUnilateral] = useState(definition.isUnilateral);
  const [warmup, setWarmup] = useState<"" | "none">(definition.warmup === "none" ? "none" : "");
  const [isTimeBased, setIsTimeBased] = useState(definition.isTimeBased);
  const [currentWeight, setCurrentWeight] = useState(String(definition.currentWeight));
  const [hardStreak, setHardStreak] = useState(String(definition.hardStreak));
  const [saving, setSaving] = useState(false);

  const groups = equipmentOptionGroups(equipment, machines, choice);
  const linkedMachine = choice.startsWith("machine:") ? machines.find((m) => `machine:${m.id}` === choice) ?? null : null;
  const isBand = choice === "type:band";
  // Weight rules are offered from what the chosen equipment can make (one plate on a FitArc, a pair
  // on a barbell, the next bell on kettlebells).
  const picked = applyEquipmentChoice(choice, equipment);
  const ruleGroups = progressionOptionGroups({
    name,
    ...picked,
    weightOptions: choice === "machine:" ? parseWeightOptions(weightOptionsText) : linkedMachine?.plates ?? null,
  }, equipment, progressionRule);
  // Band colours you own, plus the exercise's current colour if you no longer have it.
  const bandColours = [...equipment.bands, ...(definition.equipmentDetail && !equipment.bands.includes(definition.equipmentDetail as never) ? [definition.equipmentDetail] : [])];
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
          weightOptions: choice === "machine:" ? parseWeightOptions(weightOptionsText) : linkedMachine ? linkedMachine.plates : null,
          machineId: picked.machineId,
          equipmentItemId: picked.equipmentItemId,
          muscleGroups: muscleGroupsText.split(",").map((m) => m.trim()).filter(Boolean),
          equipmentType: picked.equipmentType,
          equipmentDetail: isBand ? (equipmentDetail || bandColours[0] || null) : null,
          progressionRule,
          isUnilateral,
          isTimeBased,
          warmup: warmup || null,
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
          <>
            <select id={id} value={choice} onChange={(e) => setChoice(e.target.value)} className="input-field">
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
            {linkedMachine && <p className="mt-1 text-xs text-gray-500">Weights from the machine: {linkedMachine.plates.map(cleanWeight).join(", ")}</p>}
          </>
        )}
      </Field>
      <Field label="Progression Rule">
        {(id) => (
          <select id={id} value={progressionRule} onChange={(e) => setProgressionRule(e.target.value as ProgressionRule)} className="input-field">
            {ruleGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            ))}
          </select>
        )}
      </Field>
      <p className="col-span-2 -mt-2 text-xs text-gray-500">Missing something? Add it on the Equipment page (bars, weights, bands, your own items) or as a gym machine.</p>
      {choice === "machine:" && (
        <Field label="Weights the machine can be set to (comma-separated)" className="col-span-2">
          {(id) => <input id={id} type="text" value={weightOptionsText} onChange={(e) => setWeightOptionsText(e.target.value)} placeholder="e.g. 50, 75, 100, 150" className="input-field" />}
        </Field>
      )}
      {isBand && (
        <Field label="Band colour" className="col-span-2">
          {(id) => (
            <select id={id} value={equipmentDetail || bandColours[0] || ""} onChange={(e) => setEquipmentDetail(e.target.value)} className="input-field">
              {bandColours.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </Field>
      )}
      <Field label="Warm-up" className="col-span-2">
        {(id) => (
          <>
            <select id={id} value={warmup} onChange={(e) => setWarmup(e.target.value as "" | "none")} className="input-field">
              <option value="">Follow its equipment&apos;s warm-up rule</option>
              <option value="none">None: never warm up this exercise</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">The rules for each kind of equipment are in Settings → Warm-ups.</p>
          </>
        )}
      </Field>
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
