"use client";

import { useState } from "react";
import type { PRResult } from "@/lib/types";
import { cleanWeight, formatTimeValue } from "@/lib/types";
import { estimate1RM } from "@/lib/one-rep-max";
import type { CustomSetEntry } from "@/lib/custom-workout";
import { exerciseKey } from "@/lib/custom-workout";
import type { WeightSuggestion } from "@/lib/custom-workout";
import { useError } from "@/components/providers/ErrorProvider";
import { EquipmentPhotoButton } from "./EquipmentPhotoButton";
import { SetTimer } from "./SetTimer";
import type { EquipmentAnalysis } from "@/lib/equipment-photo";

interface CustomWorkoutProps {
  exerciseNames: string[]; // library names offered as suggestions; any other name is accepted too
  onFinish: (entries: CustomSetEntry[]) => Promise<PRResult[]>;
  onClose: () => void;
  suggestWeight?: (exerciseName: string) => WeightSuggestion | null; // next weight from this exercise's history
  onScanPhoto?: (file: File) => Promise<EquipmentAnalysis>; // photo of equipment → exercise name + suggested weight
}

const RATINGS = [
  { value: "easy", label: "Easy", active: "bg-green-600 text-white" },
  { value: "normal", label: "Normal", active: "bg-indigo-600 text-white" },
  { value: "hard", label: "Hard", active: "bg-red-600 text-white" },
] as const;

const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500";

export function CustomWorkout({ exerciseNames, onFinish, onClose, onScanPhoto, suggestWeight }: CustomWorkoutProps) {
  const { showError } = useError();
  const [entries, setEntries] = useState<CustomSetEntry[]>([]);
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rating, setRating] = useState<"easy" | "normal" | "hard">("normal");
  const [timed, setTimed] = useState(false);
  const [bodyweight, setBodyweight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prs, setPrs] = useState<PRResult[] | null>(null);
  const [lastSetAt, setLastSetAt] = useState<number | null>(null);

  const repsNum = Number(reps);
  const weightNum = bodyweight || weight === "" ? 0 : Number(weight);
  const canAdd = exercise.trim() !== "" && reps !== "" && repsNum > 0 && weightNum >= 0 && !Number.isNaN(weightNum);

  const suggestion = !timed && !bodyweight && weight === "" && exercise.trim() !== ""
    ? (suggestWeight?.(exercise.trim()) ?? null)
    : null;

  function addSet() {
    if (!canAdd) return;
    setEntries((prev) => [...prev, { exerciseName: exercise.trim(), weight: weightNum, reps: repsNum, isTimeBased: timed, rating }]);
    setLastSetAt(Date.now());
    // Exercise and weight carry over to the next set; reps are re-entered.
    setReps("");
    setRating("normal");
  }

  function changeExercise() {
    setExercise("");
    setWeight("");
    setReps("");
    setTimed(false);
    setBodyweight(false);
    setRating("normal");
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
      <div className="max-w-lg mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mt-8 mb-2">Workout saved</h1>
        <p className="text-gray-400 mb-4">{entries.length} {entries.length === 1 ? "set" : "sets"} logged</p>
        {prs.length > 0 && (
          <ul className="mb-4 text-yellow-400 text-sm space-y-1">
            {prs.map((p) => <li key={`${p.exerciseName}-${p.type}`}>New {p.type} PR: {p.exerciseName}</li>)}
          </ul>
        )}
        <span data-testid="saved-payload" className="sr-only">
          {entries.map((e) => `${e.exerciseName}:${e.weight > 0 ? cleanWeight(e.weight) : "BW"}x${e.isTimeBased ? formatTimeValue(e.reps) : e.reps}`).join(",")}
        </span>
        <button onClick={onClose} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Custom Workout</h1>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200">Cancel</button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
        {onScanPhoto && (
          <EquipmentPhotoButton
            onScan={onScanPhoto}
            onResult={(a) => {
              setExercise(a.name);
              setWeight(a.suggestedWeight !== null ? String(a.suggestedWeight) : "");
              setReps("");
              setTimed(a.isTimeBased);
              setBodyweight(false);
            }}
          />
        )}
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
        <div className="flex gap-2" role="group" aria-label="Set type">
          {([false, true] as const).map((isTime) => (
            <button key={String(isTime)} type="button" aria-pressed={timed === isTime}
              onClick={() => { setTimed(isTime); setReps(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${timed === isTime ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
              {isTime ? "Time" : "Reps"}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span id="cw-bw-label" className="text-sm text-gray-400">Bodyweight</span>
          <button type="button" role="switch" aria-checked={bodyweight} aria-labelledby="cw-bw-label"
            onClick={() => { setBodyweight((v) => !v); setWeight(""); }}
            className={`relative w-11 h-6 rounded-full transition ${bodyweight ? "bg-indigo-600" : "bg-gray-700"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${bodyweight ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="cw-weight" className="block text-sm text-gray-400 mb-1">Weight</label>
            <input id="cw-weight" type="number" inputMode="decimal" min="0" step="any" value={weight} disabled={bodyweight}
              onChange={(e) => setWeight(e.target.value)} placeholder={bodyweight ? "BW" : "lbs"} className={`${inputCls} disabled:opacity-50`} />
          </div>
          <div className="flex-1">
            <label htmlFor="cw-reps" className="block text-sm text-gray-400 mb-1">{timed ? "Time (sec)" : "Reps"}</label>
            <input id="cw-reps" type="number" inputMode="numeric" min="1" step="1" value={reps}
              onChange={(e) => setReps(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSet(); }}
              className={inputCls} />
          </div>
        </div>
        <div>
          <span id="cw-rating-label" className="block text-sm text-gray-400 mb-1">Difficulty</span>
          <div role="group" aria-labelledby="cw-rating-label" className="flex rounded-xl overflow-hidden border border-gray-700">
            {RATINGS.map((opt) => (
              <button key={opt.value} type="button" aria-pressed={rating === opt.value} onClick={() => setRating(opt.value)}
                className={`flex-1 py-2 text-sm font-semibold transition ${rating === opt.value ? opt.active : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {suggestion && (
          <div data-testid="weight-suggestion" className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-3 py-2 text-sm">
            <span className="text-gray-300">
              Suggested {cleanWeight(suggestion.weight)} lb
              <span className="block text-xs text-gray-500">
                last time {cleanWeight(suggestion.lastWeight)} lb × {suggestion.lastReps}
                {suggestion.daysAgo === 0 ? ", today" : `, ${suggestion.daysAgo} day${suggestion.daysAgo === 1 ? "" : "s"} ago`}
              </span>
            </span>
            <button type="button" onClick={() => setWeight(String(suggestion.weight))}
              className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500">
              Use {cleanWeight(suggestion.weight)} lb
            </button>
          </div>
        )}
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

      {lastSetAt !== null && (
        <div className="mb-4">
          <SetTimer startedAt={lastSetAt} />
        </div>
      )}

      <div className="space-y-3 mb-6">
        {groups.map((group) => (
          <div key={exerciseKey(group.name)} data-testid="exercise-group" className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="font-semibold mb-2">{group.name}</div>
            <ul className="space-y-1">
              {group.sets.map(({ entry, index }, n) => (
                <li key={index} data-testid="logged-set" className="flex items-center justify-between text-sm text-gray-300">
                  <span>
                    Set {n + 1}: {entry.weight > 0 ? `${cleanWeight(entry.weight)} lb` : "BW"} × {entry.isTimeBased ? formatTimeValue(entry.reps) : entry.reps}
                    {entry.rating && entry.rating !== "normal" && (
                      <span className={`ml-2 text-xs ${entry.rating === "easy" ? "text-green-400" : "text-red-400"}`}>{entry.rating}</span>
                    )}
                    {!entry.isTimeBased && estimate1RM(entry.weight, entry.reps) !== null && (
                      <span data-testid="set-e1rm" className="ml-2 text-xs text-gray-500">
                        est. 1RM {Math.round(estimate1RM(entry.weight, entry.reps)!)} lb
                      </span>
                    )}
                  </span>
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
