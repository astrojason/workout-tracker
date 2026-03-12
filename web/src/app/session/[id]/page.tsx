"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSession } from "@/lib/firestore";
import { cleanWeight, formatDuration } from "@/lib/types";
import type { WorkoutSessionDoc, CompletedSet } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";

const RATING_STYLES: Record<string, string> = {
  easy: "text-green-400",
  normal: "text-gray-400",
  hard: "text-red-400",
};

function groupByExercise(sets: CompletedSet[]): { name: string; sets: CompletedSet[] }[] {
  const seen = new Map<string, CompletedSet[]>();
  for (const s of sets) {
    if (!seen.has(s.exerciseName)) seen.set(s.exerciseName, []);
    seen.get(s.exerciseName)!.push(s);
  }
  return Array.from(seen.entries()).map(([name, sets]) => ({ name, sets }));
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [session, setSession] = useState<WorkoutSessionDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getSession(user.uid, id).then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, [user, id]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to view session details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Link href="/history" className="text-indigo-400 text-sm mb-4 inline-block">&larr; Back to History</Link>
        <p className="text-gray-400 text-center py-12">Session not found.</p>
      </div>
    );
  }

  const date = session.date instanceof Timestamp
    ? session.date.toDate()
    : new Date(session.date as unknown as string);

  const groups = groupByExercise(session.sets ?? []);
  const completedSets = session.sets?.filter((s) => s.completed) ?? [];
  const hasRatings = session.sets?.some((s) => s.rating) ?? false;

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <Link href="/history" className="text-indigo-400 text-sm mb-4 inline-block">&larr; Back to History</Link>

      {/* Header */}
      <h1 className="text-2xl font-bold mb-1">{session.programName}</h1>
      <p className="text-gray-400 mb-4">
        {session.dayOfWeek} &middot; Week {session.week} &middot;{" "}
        {date.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
          <div className="font-bold">{formatDuration(session.durationSeconds)}</div>
          <div className="text-xs text-gray-400">Duration</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
          <div className="font-bold">{completedSets.length}</div>
          <div className="text-xs text-gray-400">Sets Done</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
          <div className={`font-bold ${session.completed ? "text-green-400" : "text-yellow-400"}`}>
            {session.completed ? "Done" : "Partial"}
          </div>
          <div className="text-xs text-gray-400">Status</div>
        </div>
      </div>

      {/* Exercises */}
      {groups.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No sets recorded.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ name, sets }) => (
            <div key={name} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
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
                    <th className="px-4 py-2 text-right">Weight</th>
                    <th className="px-4 py-2 text-right">Reps</th>
                    {hasRatings && <th className="px-4 py-2 text-right">Feel</th>}
                    <th className="px-4 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sets.map((s) => (
                    <tr key={s.id} className={s.completed ? "" : "opacity-40"}>
                      <td className="px-4 py-2 text-gray-400">{s.setNumber}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {s.actualWeight > 0 ? `${cleanWeight(s.actualWeight)} lb` : "BW"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{s.actualReps}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
