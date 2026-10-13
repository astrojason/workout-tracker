"use client";

import { useState } from "react";
import type { PRResult } from "@/lib/types";
import { cleanWeight } from "@/lib/types";
import type { CustomSetEntry } from "@/lib/custom-workout";
import { exerciseKey } from "@/lib/custom-workout";
import { useError } from "@/components/providers/ErrorProvider";

interface CustomWorkoutProps {
  exerciseNames: string[]; // library names offered as suggestions; any other name is accepted too
  onFinish: (entries: CustomSetEntry[]) => Promise<PRResult[]>;
  onClose: () => void;
}

const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500";

export function CustomWorkout({ exerciseNames, onFinish, onClose }: CustomWorkoutProps) {
  const { showError } = useError();
  const [entries, setEntries] = useState<CustomSetEntry[]>([]);
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [saving, setSaving] = useState(false);
  const [prs, setPrs] = useState<PRResult[] | null>(null);

  const repsNum = Number(reps);
  const weightNum = weight === "" ? 0 : Number(weight);
  const canAdd = exercise.trim() !== "" && reps !== "" && repsNum > 0 && weightNum >= 0 && !Number.isNaN(weightNum);

  function addSet() {
    if (!canAdd) return;
    setEntries((prev) => [...prev, { exerciseName: exercise.trim(), weight: weightNum, reps: repsNum }]);
    // Exercise and weight carry over to the next set; reps are re-entered.
    setReps("");
  }

  function changeExercise() {
    setExercise("");
    setWeight("");
    setReps("");
  }

  async function finish() {
    if (entries.length === 0 || saving) return;
    setSaving(true);
    try {
      setPrs(await onFinish(entries));
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  // Group by exercise (first appearance) but keep each set's index for removal.
  const groups: { name: string; sets: { entry: CustomSetEntry; index: number }[] }[] = [];
  entries.forEach((entry, index) => {
    const key = exerciseKey(entry.exerciseName);
    let group = groups.find((g) => exerciseKey(g.name) === key);
    if (!group) {
      group = { name: entry.exerciseName, sets: [] };
      groups.push(group);
    }
    group.sets.push({ entry, index });
  });

  if (prs) {
    return (
      <div className="max-w-lg mx-auto p-4 pb-24 text-center">
        <h1 className="text-2xl font-bold mt-8 mb-2">Workout saved</h1>
        <p className="text-gray-400 mb-4">{entries.length} {entries.length === 1 ? "set" : "sets"} logged</p>
        {prs.length > 0 && (
          <ul className="mb-4 text-yellow-400 text-sm space-y-1">
            {prs.map((p) => <li key={`${p.exerciseName}-${p.type}`}>New {p.type} PR: {p.exerciseName}</li>)}
          </ul>
        )}
        <span data-testid="saved-payload" className="sr-only">
          {entries.map((e) => `${e.exerciseName}:${cleanWeight(e.weight)}x${e.reps}`).join(",")}
        </span>
        <button onClick={onClose} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Custom Workout</h1>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200">Cancel</button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
        <div>
          <label htmlFor="cw-exercise" className="block text-sm text-gray-400 mb-1">Exercise</label>
          <input
            id="cw-exercise"
            list="cw-exercise-options"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            placeholder="Pick or type an exercise"
            className={inputCls}
          />
          <datalist id="cw-exercise-options">
            {exerciseNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="cw-weight" className="block text-sm text-gray-400 mb-1">Weight</label>
            <input id="cw-weight" type="number" inputMode="decimal" min="0" step="any" value={weight}
              onChange={(e) => setWeight(e.target.value)} placeholder="lbs" className={inputCls} />
          </div>
          <div className="flex-1">
            <label htmlFor="cw-reps" className="block text-sm text-gray-400 mb-1">Reps</label>
            <input id="cw-reps" type="number" inputMode="numeric" min="1" step="1" value={reps}
              onChange={(e) => setReps(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSet(); }}
              className={inputCls} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={addSet} disabled={!canAdd}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-bold transition">
            Add set
          </button>
          {exercise !== "" && entries.length > 0 && (
            <button onClick={changeExercise} className="px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition">
              Change exercise
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {groups.map((group) => (
          <div key={exerciseKey(group.name)} data-testid="exercise-group" className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="font-semibold mb-2">{group.name}</div>
            <ul className="space-y-1">
              {group.sets.map(({ entry, index }, n) => (
                <li key={index} data-testid="logged-set" className="flex items-center justify-between text-sm text-gray-300">
                  <span>Set {n + 1}: {entry.weight > 0 ? `${cleanWeight(entry.weight)} lb` : "BW"} × {entry.reps}</span>
                  <button aria-label={`Remove set ${n + 1} of ${group.name}`}
                    onClick={() => setEntries((prev) => prev.filter((_, i) => i !== index))}
                    className="text-gray-500 hover:text-red-400 px-2">✕</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button onClick={finish} disabled={entries.length === 0 || saving}
        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:hover:bg-green-600 text-white font-bold transition">
        {saving ? "Saving…" : "Finish workout"}
      </button>
    </div>
  );
}
