"use client";

import { useMemo, useState } from "react";
import type { ExerciseMatchDecision, ExerciseMatchRequest } from "@/lib/exercise-import";

const stem = (w: string) => w.replace(/s$/, "");
const tokens = (name: string) => new Set(name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem));

/** Library exercises ordered by how much their name overlaps the imported one. */
function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export function ExerciseMatchModal({
  request,
  onDecide,
}: {
  request: ExerciseMatchRequest;
  onDecide: (decision: ExerciseMatchDecision) => void;
}) {
  const { exercise, index, total, candidates } = request;
  const ranked = useMemo(
    () => [...candidates].sort((a, b) =>
      similarity(exercise.name, b.name) - similarity(exercise.name, a.name) || a.name.localeCompare(b.name)),
    [candidates, exercise.name],
  );
  const [search, setSearch] = useState("");
  // Pre-select the closest match, but only when it shares at least one word with the new name.
  const [selected, setSelected] = useState<string | null>(
    ranked.length > 0 && similarity(exercise.name, ranked[0].name) > 0 ? ranked[0].id : null,
  );

  const query = search.trim().toLowerCase();
  const visible = query ? ranked.filter((d) => d.name.toLowerCase().includes(query)) : ranked;
  const selectedVisible = selected !== null && visible.some((d) => d.id === selected);

  const reps = exercise.repMax.type === "failure" ? `${exercise.repMin}+` : `${exercise.repMin}–${exercise.repMax.value}`;
  const summary = [
    `${exercise.sets} × ${reps}${exercise.isTimeBased ? " s" : ""}`,
    exercise.equipmentType.replace(/_/g, " "),
    exercise.seedWeight !== undefined ? `${exercise.seedWeight} lb` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Match imported exercise"
        className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 border border-gray-800 max-h-[90vh] flex flex-col"
      >
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Exercise {index} of {total}</p>
        <h3 className="text-lg font-bold">{exercise.name}</h3>
        <p className="text-sm text-gray-400 mb-1">{summary}</p>
        <p className="text-sm text-gray-400 mb-4">
          This isn&apos;t in your exercise library. Use an existing exercise, or create a new one.
        </p>

        <input
          type="search"
          aria-label="Search library"
          placeholder="Search library…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
        />
        <div role="radiogroup" aria-label="Library exercises" className="overflow-y-auto min-h-[8rem] max-h-64 mb-4 space-y-1">
          {visible.length === 0 ? (
            <p className="text-sm text-gray-500 p-2">No exercises match “{search.trim()}”.</p>
          ) : visible.map((d) => (
            <label
              key={d.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm ${
                selected === d.id ? "bg-blue-900/50 border border-blue-600" : "bg-gray-800 border border-transparent hover:bg-gray-700"
              }`}
            >
              <input
                type="radio"
                name="library-exercise"
                value={d.id}
                checked={selected === d.id}
                onChange={() => setSelected(d.id)}
              />
              <span className="flex-1">{d.name}</span>
              <span className="text-xs text-gray-500">{d.equipmentType.replace(/_/g, " ")}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onDecide({ action: "use", definitionId: selected! })}
            disabled={!selectedVisible}
            className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold transition disabled:opacity-40"
          >
            Use selected exercise
          </button>
          <button
            onClick={() => onDecide({ action: "create" })}
            className="py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition"
          >
            Create new exercise
          </button>
          <button
            onClick={() => onDecide({ action: "cancel" })}
            className="py-2 text-sm text-gray-400 hover:text-gray-200 transition"
          >
            Cancel import
          </button>
        </div>
      </div>
    </div>
  );
}
