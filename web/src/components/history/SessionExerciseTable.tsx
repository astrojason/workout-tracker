import Link from "next/link";
import { formatTimeValue, isSkippedSet, setLoadLabel } from "@/lib/types";
import type { CompletedSet } from "@/lib/types";

const RATING_STYLES: Record<string, string> = {
  easy: "text-green-400",
  normal: "text-gray-400",
  hard: "text-red-400",
};

export function SessionExerciseTable({ name, sets, hasRatings }: { name: string; sets: CompletedSet[]; hasRatings: boolean }) {
  const exerciseTimeBased = sets[0]?.isTimeBased === true;
  const colCount = 2 + (exerciseTimeBased ? 0 : 1) + (hasRatings ? 1 : 0) + 1;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <span className="font-semibold">{name}</span>
        <Link
          href={`/exercise/${encodeURIComponent(name)}`}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          Progress &rarr;
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 uppercase">
            <th className="px-4 py-2 text-left">Set</th>
            {!exerciseTimeBased && <th className="px-4 py-2 text-right">Weight</th>}
            <th className="px-4 py-2 text-right">{exerciseTimeBased ? "Time" : "Reps"}</th>
            {hasRatings && <th className="px-4 py-2 text-right">Feel</th>}
            <th className="px-4 py-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {sets.map((s) => (
            <SetRows key={s.id} s={s} exerciseTimeBased={exerciseTimeBased} hasRatings={hasRatings} colCount={colCount} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SetRows({ s, exerciseTimeBased, hasRatings, colCount }: { s: CompletedSet; exerciseTimeBased: boolean; hasRatings: boolean; colCount: number }) {
  const dim = s.completed ? "" : "opacity-40";
  const skipped = isSkippedSet(s);
  // A skipped set's only note is the automatic "Skipped", already shown in the row.
  const note = skipped && s.notes === "Skipped" ? null : s.notes;
  return (
    <>
      <tr className={dim}>
        <td className="px-4 py-2 text-gray-400">{s.setNumber}</td>
        {skipped ? (
          <td colSpan={exerciseTimeBased ? 1 : 2} className="px-4 py-2 text-right text-gray-500">Skipped</td>
        ) : (
          <>
            {!exerciseTimeBased && (
              <td className="px-4 py-2 text-right font-mono">{setLoadLabel(s)}</td>
            )}
            <td className="px-4 py-2 text-right font-mono">
              {exerciseTimeBased ? formatTimeValue(s.actualReps) : s.actualReps}
            </td>
          </>
        )}
        {hasRatings && (
          <td className={`px-4 py-2 text-right capitalize ${s.rating ? RATING_STYLES[s.rating] : "text-gray-500"}`}>
            {s.rating ?? "—"}
          </td>
        )}
        <td className="px-4 py-2 text-right">
          {s.completed ? (
            <span className="text-green-400">&#x2713;</span>
          ) : (
            <span className="text-gray-600">&#x2013;</span>
          )}
        </td>
      </tr>
      {note && (
        <tr className={dim}>
          <td colSpan={colCount} data-testid="set-note" className="px-4 pb-2 text-xs text-gray-400 italic">
            {note}
          </td>
        </tr>
      )}
    </>
  );
}
