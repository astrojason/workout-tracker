import Link from "next/link";
import type { WorkoutSessionDoc } from "@/lib/types";
import { SessionSummary } from "@/components/history/SessionSummary";

const SHOWN = 3;

// Desktop Home side column: the latest few sessions (newest first, as loaded) and a link to History.
export function RecentWorkouts({ sessions }: { sessions: WorkoutSessionDoc[] }) {
  return (
    <section aria-labelledby="recent-workouts-heading">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="recent-workouts-heading" className="text-sm font-bold uppercase tracking-wider text-gray-400">Recent Workouts</h2>
        <Link href="/history" className="text-sm text-indigo-400 hover:text-indigo-300">View history</Link>
      </div>
      {sessions.length === 0 ? (
        <p className="border-t border-gray-800 py-4 text-sm text-gray-500">No workouts in the last week.</p>
      ) : (
        sessions.slice(0, SHOWN).map((session) => (
          <SessionSummary key={session.id} session={session} className="border-t border-gray-800 py-3.5 text-sm hover:text-gray-300" />
        ))
      )}
    </section>
  );
}
