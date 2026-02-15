"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/types";
import { isTimeBased } from "@/lib/types";

interface SetCompletionModalProps {
  exercise: Exercise;
  setNumber: number;
  targetWeight: number;
  onSave: (actualReps: number, actualWeight: number, failed: boolean, rating: "easy" | "normal" | "hard", notes?: string) => void;
  onCancel: () => void;
}

export function SetCompletionModal({
  exercise, setNumber, targetWeight, onSave, onCancel,
}: SetCompletionModalProps) {
  const defaultReps = exercise.repMax.type === "count" ? exercise.repMax.value : exercise.repMin;
  const [reps, setReps] = useState(defaultReps);
  const [weight, setWeight] = useState(targetWeight);
  const [failed, setFailed] = useState(false);
  const [rating, setRating] = useState<"easy" | "normal" | "hard">("normal");
  const [notes, setNotes] = useState("");

  const timeBased = isTimeBased(exercise);
  const increment = timeBased ? 5 : 1;

  const ratingOptions: { value: "easy" | "normal" | "hard"; label: string; color: string; activeColor: string }[] = [
    { value: "easy", label: "Easy", color: "text-gray-400", activeColor: "bg-green-600 text-white" },
    { value: "normal", label: "Normal", color: "text-gray-400", activeColor: "bg-indigo-600 text-white" },
    { value: "hard", label: "Hard", color: "text-gray-400", activeColor: "bg-red-600 text-white" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 border border-gray-800">
        <h3 className="text-lg font-bold mb-6">Set {setNumber}</h3>

        {/* Reps / Duration */}
        <div className="mb-5">
          <label className="text-sm text-gray-400 block mb-2">
            {timeBased ? "Duration Completed" : "Reps Completed"}
          </label>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setReps(Math.max(0, reps - increment))}
              className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-bold transition"
            >
              -
            </button>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 bg-gray-800 rounded-xl px-2 py-1 text-4xl font-bold text-center font-mono border border-gray-700 focus:border-indigo-500 outline-none"
            />
            <button
              onClick={() => setReps(reps + increment)}
              className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-bold transition"
            >
              +
            </button>
          </div>
        </div>

        {/* Weight */}
        {targetWeight > 0 && (
          <div className="mb-5">
            <label className="text-sm text-gray-400 block mb-2">Weight (lbs)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              step="2.5"
              className="w-full bg-gray-800 rounded-xl px-4 py-3 text-xl font-bold text-center border border-gray-700 focus:border-indigo-500 outline-none"
            />
          </div>
        )}

        {/* Rating */}
        <div className="mb-5">
          <label className="text-sm text-gray-400 block mb-2">Difficulty</label>
          <div className="flex rounded-xl overflow-hidden border border-gray-700">
            {ratingOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRating(opt.value)}
                className={`flex-1 py-2.5 text-sm font-semibold transition ${
                  rating === opt.value ? opt.activeColor : "bg-gray-800 " + opt.color + " hover:bg-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Failed toggle */}
        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm text-gray-400">Failed Set</span>
          <button
            onClick={() => setFailed(!failed)}
            className={`w-12 h-7 rounded-full transition ${
              failed ? "bg-red-500" : "bg-gray-700"
            } relative`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                failed ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="text-sm text-gray-400 block mb-2">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it feel?"
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(reps, weight, failed, rating, notes || undefined)}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 font-bold transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
