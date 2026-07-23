"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { updateExerciseDefinitionMeta, updateExerciseDefinitionWeight } from "@/lib/firestore";
import type { ExerciseDefinition, EquipmentType, ProgressionRule } from "@/lib/types";
import { BottomNav } from "@/components/ui/BottomNav";
import { useError } from "@/components/providers/ErrorProvider";

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
];

const PROGRESSION_OPTIONS: { value: ProgressionRule; label: string }[] = [
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

export default function ExerciseLibraryPage() {
  const { user } = useAuth();
  const { showError } = useError();
  const { definitions, loading, reload } = useExerciseDefinitions(user?.uid ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = Object.values(definitions).sort((a, b) => a.name.localeCompare(b.name));

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to manage exercises.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-gray-400 hover:text-white transition text-sm">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold">Exercise Library</h1>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Every exercise here is shared across all your programs — editing it (including its weight) affects every occurrence, in every program, going forward.
      </p>

      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading...</div>
      ) : sorted.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No exercises yet — import a program to populate your library.</p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {sorted.map((def) =>
            editingId === def.id ? (
              <ExerciseDefinitionEditRow
                key={def.id}
                definition={def}
                userId={user.uid}
                onDone={async () => {
                  setEditingId(null);
                  await reload();
                }}
                onCancel={() => setEditingId(null)}
                onError={showError}
              />
            ) : (
              <button
                key={def.id}
                onClick={() => setEditingId(def.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition"
              >
                <div className="font-semibold">{def.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {def.equipmentType.replace(/_/g, " ")}{def.equipmentDetail ? ` · ${def.equipmentDetail}` : ""} · {def.progressionRule.replace(/_/g, " ")}
                </div>
                {def.muscleGroups.length > 0 && (
                  <div className="text-xs text-gray-600 mt-0.5">{def.muscleGroups.join(", ")}</div>
                )}
                <div className="text-xs text-indigo-400 mt-1">
                  {def.currentWeight > 0 ? `${def.currentWeight} lbs` : "—"}
                </div>
              </button>
            )
          )}
        </div>
      )}

      <BottomNav active="settings" />
    </div>
  );
}

function ExerciseDefinitionEditRow({
  definition, userId, onDone, onCancel, onError,
}: {
  definition: ExerciseDefinition;
  userId: string;
  onDone: () => void;
  onCancel: () => void;
  onError: (err: unknown) => void;
}) {
  const [name, setName] = useState(definition.name);
  const [muscleGroupsText, setMuscleGroupsText] = useState(definition.muscleGroups.join(", "));
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(definition.equipmentType);
  const [equipmentDetail, setEquipmentDetail] = useState(definition.equipmentDetail ?? "");
  const [progressionRule, setProgressionRule] = useState<ProgressionRule>(definition.progressionRule);
  const [isUnilateral, setIsUnilateral] = useState(definition.isUnilateral);
  const [isTimeBased, setIsTimeBased] = useState(definition.isTimeBased);
  const [currentWeight, setCurrentWeight] = useState(String(definition.currentWeight));
  const [hardStreak, setHardStreak] = useState(String(definition.hardStreak));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateExerciseDefinitionMeta(userId, definition.id, {
        name: name.trim(),
        muscleGroups: muscleGroupsText.split(",").map((m) => m.trim()).filter(Boolean),
        equipmentType,
        equipmentDetail: equipmentType === "band" ? (equipmentDetail.trim() || null) : null,
        progressionRule,
        isUnilateral,
        isTimeBased,
      });
      const weight = parseFloat(currentWeight) || 0;
      const streak = parseInt(hardStreak, 10) || 0;
      if (weight !== definition.currentWeight || streak !== definition.hardStreak) {
        await updateExerciseDefinitionWeight(userId, definition.id, weight, streak);
      }
      onDone();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-4 space-y-3 bg-gray-800/30">
      <Field label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Equipment" noMargin>
          <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value as EquipmentType)} className="input-field">
            {EQUIPMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Progression Rule" noMargin>
          <select value={progressionRule} onChange={(e) => setProgressionRule(e.target.value as ProgressionRule)} className="input-field">
            {PROGRESSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      {equipmentType === "band" && (
        <Field label="Band Color">
          <input
            type="text"
            value={equipmentDetail}
            onChange={(e) => setEquipmentDetail(e.target.value)}
            placeholder="e.g. Blue"
            className="input-field"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Current Weight (lbs)" noMargin>
          <input type="number" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} step="2.5" className="input-field" />
        </Field>
        <Field label="Hard Streak (0-2)" noMargin>
          <input type="number" value={hardStreak} onChange={(e) => setHardStreak(e.target.value)} min={0} max={2} className="input-field" />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Each Side (Unilateral)</span>
        <Toggle checked={isUnilateral} onChange={setIsUnilateral} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Time Based</span>
        <Toggle checked={isTimeBased} onChange={setIsTimeBased} />
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition text-sm">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full transition relative ${checked ? "bg-indigo-600" : "bg-gray-700"}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Field({ label, children, noMargin }: { label: string; children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className={noMargin ? "" : ""}>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}
