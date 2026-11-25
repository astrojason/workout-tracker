"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProgramRow } from "@/lib/library-index";

const shortDay = (d: string) => (d === "Daily" ? "Daily" : d.slice(0, 3));
const date = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never");

// Desktop Programs page: every program at a glance, each linking to its editor. Importing,
// archiving and deleting stay in Settings.
export function ProgramsIndex({ rows, sessionLimit }: { rows: ProgramRow[]; sessionLimit: number }) {
  const [showArchived, setShowArchived] = useState(false);
  const shown = rows.filter((r) => showArchived || !r.archived);
  const archivedCount = rows.filter((r) => r.archived).length;

  return (
    <section aria-labelledby="programs-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="programs-title" className="text-3xl font-bold">Programs</h1>
          <p className="text-gray-400">Sessions and last trained come from your latest {sessionLimit} sessions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {archivedCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
              Show archived ({archivedCount})
            </label>
          )}
          <Link href="/settings" className="text-sm text-indigo-400 hover:text-indigo-300">Import or manage programs in Settings →</Link>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400">No programs yet. Import one in Settings.</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                <th scope="col" className="px-5 py-2.5 font-semibold">Program</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Week</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Training days</th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-right">Exercises</th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-right">Sessions</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Last trained</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className={`border-t border-gray-800 whitespace-nowrap ${r.archived ? "text-gray-400" : ""}`}>
                  <td className="px-5 py-3">
                    <Link href={`/programs/${r.id}`} className="font-semibold text-indigo-400 hover:text-indigo-300">{r.name}</Link>
                    {r.archived && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Archived</span>}
                  </td>
                  <td className="px-3 py-3">Week {r.currentWeek} of {r.totalWeeks}</td>
                  <td className="px-3 py-3 text-gray-300">{r.days.length > 0 ? r.days.map(shortDay).join(" · ") : "—"}</td>
                  <td className="px-3 py-3 text-right">{r.exercises}</td>
                  <td className="px-3 py-3 text-right">{r.sessions}</td>
                  <td className="px-5 py-3 text-gray-300">{date(r.lastTrained)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
