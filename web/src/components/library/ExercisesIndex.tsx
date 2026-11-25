"use client";

import Link from "next/link";
import { useState } from "react";
import type { EquipmentType } from "@/lib/types";
import type { ExerciseRow } from "@/lib/library-index";

const equipmentLabel = (t: EquipmentType) => {
  const s = t.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const ruleLabel = (r: string) => r.replace(/_/g, " ").replace(/(\d)lb/, "$1 lb");
const date = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never");

// Desktop Exercises page: the exercise library, searchable and filterable, each row leading to the
// exercise's report. Editing the library stays in Settings.
export function ExercisesIndex({ rows, sessionLimit }: { rows: ExerciseRow[]; sessionLimit: number }) {
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState<"" | EquipmentType>("");
  const types = [...new Set(rows.map((r) => r.equipmentType))].sort();
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => (!equipment || r.equipmentType === equipment)
    && (!q || r.name.toLowerCase().includes(q) || r.muscles.some((m) => m.toLowerCase().includes(q))));

  return (
    <section aria-labelledby="exercises-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="exercises-title" className="text-3xl font-bold">Exercises</h1>
          <p className="text-gray-400">{rows.length} in your library · sessions and last done come from your latest {sessionLimit} sessions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-3 h-9 focus-within:border-indigo-500">
            <span className="sr-only">Search exercises</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" strokeWidth={2} /><path strokeWidth={2} strokeLinecap="round" d="M20 20l-3.5-3.5" /></svg>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or muscle" className="w-48 bg-transparent text-sm outline-none" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Equipment
            <select value={equipment} onChange={(e) => setEquipment(e.target.value as "" | EquipmentType)} className="input-field !w-auto h-9 !py-0">
              <option value="">All</option>
              {types.map((t) => <option key={t} value={t}>{equipmentLabel(t)}</option>)}
            </select>
          </label>
          <Link href="/settings/exercises" className="text-sm text-indigo-400 hover:text-indigo-300">Edit the library in Settings →</Link>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400">{rows.length === 0 ? "No exercises yet. Import a program to fill the library." : "No exercises match."}</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                <th scope="col" className="px-5 py-2.5 font-semibold">Exercise</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Equipment</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Muscles</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Progression</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Programs</th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-right">Sessions</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Last done</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-gray-800 whitespace-nowrap">
                  <td className="px-5 py-3">
                    <Link href={`/exercise/${encodeURIComponent(r.name)}`} className="font-semibold text-indigo-400 hover:text-indigo-300">{r.name}</Link>
                    <Link href={`/settings/exercises?edit=${encodeURIComponent(r.id)}`} aria-label={`Edit ${r.name}`} className="ml-2 text-xs text-gray-400 hover:text-white">Edit</Link>
                  </td>
                  <td className="px-3 py-3 text-gray-300">{equipmentLabel(r.equipmentType)}{r.equipmentDetail ? ` · ${r.equipmentDetail}` : ""}</td>
                  <td className="px-3 py-3 text-gray-300">{r.muscles.length > 0 ? r.muscles.join(" · ") : "—"}</td>
                  <td className="px-3 py-3 text-gray-300">{ruleLabel(r.progressionRule)}</td>
                  <td className="px-3 py-3 text-gray-300">{r.programs.length > 0 ? r.programs.join(", ") : "—"}</td>
                  <td className="px-3 py-3 text-right">{r.sessions}</td>
                  <td className={`px-5 py-3 ${r.lastDone ? "text-gray-300" : "text-gray-500"}`}>{date(r.lastDone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
