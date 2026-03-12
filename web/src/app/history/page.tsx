"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useHistory } from "@/hooks/useHistory";
import { formatDuration } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";

export default function HistoryPage() {
  const { user } = useAuth();
  const { sessions, exerciseNames, loading } = useHistory(user?.uid ?? null);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to view history.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mb-6">History</h1>

      {/* Exercise Progress Link */}
      {exerciseNames.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Exercise Progress</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {exerciseNames.slice(0, 10).map((name) => (
              <Link
                key={name}
                href={`/exercise/${encodeURIComponent(name)}`}
                className="block px-4 py-3 hover:bg-gray-800 transition"
              >
                {name}
              </Link>
            ))}
            {exerciseNames.length > 10 && (
              <div className="px-4 py-3 text-gray-500 text-sm">
                +{exerciseNames.length - 10} more exercises
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session List */}
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Workouts</h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No workouts yet. Complete a workout to see it here.
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const date = session.date instanceof Timestamp
              ? session.date.toDate()
              : new Date(session.date as unknown as string);

            return (
              <Link
                key={session.id}
                href={`/session/${session.id}`}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between hover:bg-gray-800 transition"
              >
                <div>
                  <div className="font-semibold">{session.programName}</div>
                  <div className="text-sm text-gray-400">
                    {session.dayOfWeek} &middot; Week {session.week}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDuration(session.durationSeconds)}
                  </div>
                </div>
                {session.completed && (
                  <span className="ml-3 text-green-400">&#x2713;</span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-around">
          <Link href="/" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/history" className="flex flex-col items-center text-indigo-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-xs mt-1">History</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
