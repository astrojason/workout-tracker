import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import type { WorkoutSessionDoc } from "@/lib/types";
import { formatDuration } from "@/lib/types";

// A logged session as a link to its detail page: program, day and week on the left; date,
// duration and a done/skipped mark on the right. Used by History and Home's recent workouts.
export function SessionSummary({ session, className = "" }: { session: WorkoutSessionDoc; className?: string }) {
  const date = session.date instanceof Timestamp
    ? session.date.toDate()
    : new Date(session.date as unknown as string);

  return (
    <Link href={`/session/${session.id}`} className={`flex items-center justify-between ${className}`}>
      <div>
        <div className="font-semibold">{session.programName}</div>
        <div className="text-sm text-gray-400">
          {session.dayOfWeek} &middot; Week {session.week}
        </div>
      </div>
      <div className="flex items-center">
        <div className="text-right">
          <div className="text-sm">
            {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
          <div className="text-xs text-gray-500">
            {session.skipped ? "Skipped" : formatDuration(session.durationSeconds)}
          </div>
        </div>
        {session.skipped ? (
          <span className="ml-3 text-amber-500 text-xs font-semibold">Skipped</span>
        ) : session.completed ? (
          <span className="ml-3 text-green-400">&#x2713;</span>
        ) : null}
      </div>
    </Link>
  );
}
