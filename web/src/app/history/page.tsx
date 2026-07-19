"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useError } from "@/components/providers/ErrorProvider";
import { useHistory } from "@/hooks/useHistory";
import { usePrograms } from "@/hooks/usePrograms";
import { getSessionsForWeek } from "@/lib/firestore";
import { formatSessionsWeekAsText } from "@/lib/week-export";
import { formatDuration, formatTimeValue } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";

const SESSIONS_PAGE_SIZE = 10;
const EXERCISES_PAGE_SIZE = 10;

export default function HistoryPage() {
  const { user } = useAuth();
  const { showError } = useError();
  const { sessions, exerciseStats, loading } = useHistory(user?.uid ?? null);
  const { programs } = usePrograms(user?.uid ?? null);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [copyProgramId, setCopyProgramId] = useState("");
  const [copyWeek, setCopyWeek] = useState(1);
  const [copying, setCopying] = useState(false);
  const [weekCopied, setWeekCopied] = useState(false);

  useEffect(() => {
    if (!copyProgramId && programs.length > 0) setCopyProgramId(programs[0].id);
  }, [programs, copyProgramId]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to view history.</p>
      </div>
    );
  }

  const visibleExercises = showAllExercises ? exerciseStats : exerciseStats.slice(0, EXERCISES_PAGE_SIZE);
  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, SESSIONS_PAGE_SIZE);
  const copyProgram = programs.find((p) => p.id === copyProgramId);

  async function handleCopyLoggedWeek() {
    if (!copyProgram || !user) return;
    setCopying(true);
    try {
      const weekSessions = await getSessionsForWeek(user.uid, copyProgram.id, copyWeek);
      const text = formatSessionsWeekAsText(copyProgram.name, copyWeek, weekSessions);
      try {
        await navigator.clipboard.writeText(text);
        setWeekCopied(true);
        setTimeout(() => setWeekCopied(false), 2000);
      } catch {
        // non-critical: Clipboard API unavailable or permission denied — no fallback needed
      }
    } catch (err) {
      showError(err);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mb-6">History</h1>

      {/* Copy a Logged Week */}
      {programs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Copy a Logged Week</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap items-center gap-2">
            <select
              value={copyProgramId}
              onChange={(e) => { setCopyProgramId(e.target.value); setCopyWeek(1); }}
              className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm border border-gray-700"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={copyWeek}
              onChange={(e) => setCopyWeek(parseInt(e.target.value))}
              className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm border border-gray-700"
            >
              {Array.from({ length: copyProgram?.totalWeeks ?? 1 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
            <button
              onClick={handleCopyLoggedWeek}
              disabled={!copyProgram || copying}
              className="ml-auto px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition"
            >
              {copying ? "Copying…" : weekCopied ? "Copied!" : "Copy Week"}
            </button>
          </div>
        </div>
      )}

      {/* Exercise Progress */}
      {exerciseStats.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Exercise Progress</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {visibleExercises.map((stat) => (
              <Link
                key={stat.name}
                href={`/exercise/${encodeURIComponent(stat.name)}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition"
              >
                <span className="font-medium">{stat.name}</span>
                <span className="text-sm text-gray-400 ml-4 shrink-0">
                  {stat.isTimeBased
                    ? formatTimeValue(stat.maxReps)
                    : stat.isBodyweight
                    ? `${stat.maxReps} reps`
                    : `${stat.maxWeight}lbs x ${stat.maxWeightReps}`}
                </span>
              </Link>
            ))}
            {exerciseStats.length > EXERCISES_PAGE_SIZE && (
              <button
                onClick={() => setShowAllExercises((v) => !v)}
                className="w-full px-4 py-3 text-indigo-400 text-sm text-left hover:bg-gray-800 transition"
              >
                {showAllExercises
                  ? "Show less"
                  : `+${exerciseStats.length - EXERCISES_PAGE_SIZE} more exercises`}
              </button>
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
          {visibleSessions.map((session) => {
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
          {sessions.length > SESSIONS_PAGE_SIZE && (
            <button
              onClick={() => setShowAllSessions((v) => !v)}
              className="w-full py-3 text-indigo-400 text-sm hover:text-indigo-300 transition"
            >
              {showAllSessions
                ? "Show less"
                : `Show all ${sessions.length} workouts`}
            </button>
          )}
        </div>
      )}

      <BottomNav active="history" />
    </div>
  );
}
