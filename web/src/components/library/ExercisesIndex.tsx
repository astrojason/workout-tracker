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
const equipmentText = (r: ExerciseRow) => `${r.equipmentName ?? equipmentLabel(r.equipmentType)}${r.equipmentDetail ? ` · ${r.equipmentDetail}` : ""}`;

type SortKey = "name" | "equipment" | "muscles" | "progression" | "programs" | "sessions" | "lastDone";
type Dir = "ascending" | "descending";

// Each column's sort value; null sorts last whichever way (no muscles, no programs, never done).
const SORT_VALUE: Record<SortKey, (r: ExerciseRow) => string | number | null> = {
  name: (r) => r.name.toLowerCase(),
  equipment: (r) => equipmentText(r).toLowerCase(),
  muscles: (r) => (r.muscles.length > 0 ? r.muscles.join(" ").toLowerCase() : null),
  progression: (r) => ruleLabel(r.progressionRule).toLowerCase(),
  programs: (r) => (r.programs.length > 0 ? r.programs.join(" ").toLowerCase() : null),
  sessions: (r) => r.sessions,
  lastDone: (r) => r.lastDone?.getTime() ?? null,
};
// Text starts A to Z; counts and dates start with the most or the latest.
const FIRST_DIR: Record<SortKey, Dir> = {
  name: "ascending", equipment: "ascending", muscles: "ascending", progression: "ascending", programs: "ascending",
  sessions: "descending", lastDone: "descending",
};

function sortRows(rows: ExerciseRow[], key: SortKey, dir: Dir): ExerciseRow[] {
  const value = SORT_VALUE[key];
  const sign = dir === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a), vb = value(b);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else if (va !== vb) {
      return (va < vb ? -1 : 1) * sign;
    }
    return a.name.localeCompare(b.name); // ties: by name
  });
}

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: { key: SortKey; dir: Dir }; onSort: (k: SortKey) => void; className: string }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? sort.dir : undefined} className={`${className} font-semibold`}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-white ${active ? "text-white" : ""}`}>
        {label}
        {/* Up and down chevrons; the one for the current direction is lit. Drawn, not a glyph, so no emoji rendering. */}
        <svg aria-hidden="true" viewBox="0 0 8 12" className="w-2 h-3">
          <path d="M1 4.5 4 1.5 7 4.5" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={active && sort.dir === "ascending" ? "stroke-indigo-300" : "stroke-gray-600"} />
          <path d="M1 7.5 4 10.5 7 7.5" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={active && sort.dir === "descending" ? "stroke-indigo-300" : "stroke-gray-600"} />
        </svg>
      </button>
    </th>
  );
}

// Desktop Exercises page: the exercise library, searchable and filterable, each row leading to the
// exercise's report. Edit opens the exercise in the side panel (ExerciseLibraryEditor).
export function ExercisesIndex({ rows, sessionLimit, onEdit }: { rows: ExerciseRow[]; sessionLimit: number; onEdit: (definitionId: string) => void }) {
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState<"" | EquipmentType>("");
  // Most recently done first, until a column is picked. Picking it again flips the direction.
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "lastDone", dir: "descending" });
  const onSort = (key: SortKey) => setSort((s) => (s.key === key
    ? { key, dir: s.dir === "ascending" ? "descending" : "ascending" }
    : { key, dir: FIRST_DIR[key] }));
  const types = [...new Set(rows.map((r) => r.equipmentType))].sort();
  const q = query.trim().toLowerCase();
  const shown = sortRows(rows.filter((r) => (!equipment || r.equipmentType === equipment)
    && (!q || r.name.toLowerCase().includes(q) || r.muscles.some((m) => m.toLowerCase().includes(q)))), sort.key, sort.dir);

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
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400">{rows.length === 0 ? "No exercises yet. Import a program to fill the library." : "No exercises match."}</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                <SortHeader label="Exercise" k="name" sort={sort} onSort={onSort} className="px-5 py-2.5" />
                <SortHeader label="Equipment" k="equipment" sort={sort} onSort={onSort} className="px-3 py-2.5" />
                <SortHeader label="Muscles" k="muscles" sort={sort} onSort={onSort} className="px-3 py-2.5" />
                <SortHeader label="Progression" k="progression" sort={sort} onSort={onSort} className="px-3 py-2.5" />
                <SortHeader label="Programs" k="programs" sort={sort} onSort={onSort} className="px-3 py-2.5" />
                <SortHeader label="Sessions" k="sessions" sort={sort} onSort={onSort} className="px-3 py-2.5 text-right" />
                <SortHeader label="Last done" k="lastDone" sort={sort} onSort={onSort} className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-gray-800 whitespace-nowrap">
                  <td className="px-5 py-3">
                    <Link href={`/exercise/${encodeURIComponent(r.name)}`} className="font-semibold text-indigo-400 hover:text-indigo-300">{r.name}</Link>
                    <button type="button" onClick={() => onEdit(r.id)} aria-label={`Edit ${r.name}`} className="ml-2 text-xs text-gray-400 hover:text-white">Edit</button>
                  </td>
                  <td className="px-3 py-3 text-gray-300">{equipmentText(r)}</td>
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
