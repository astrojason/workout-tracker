"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useError } from "@/components/providers/ErrorProvider";
import { useHistory } from "@/hooks/useHistory";
import { usePrograms } from "@/hooks/usePrograms";
import { deleteSession, getSessionsForWeek, updateSessionSets } from "@/lib/firestore";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { HistoryWorkspace } from "@/components/history/HistoryWorkspace";
import { formatSessionsWeekAsText } from "@/lib/week-export";
import { formatTimeValue } from "@/lib/types";
import Link from "next/link";
import { CopySessionButton } from "@/components/history/CopySessionButton";
import { SessionSummary } from "@/components/history/SessionSummary";
import { BodyMetricsSection } from "@/components/history/BodyMetricsSection";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";

const SESSIONS_PAGE_SIZE = 10;
const EXERCISES_PAGE_SIZE = 10;
// Desktop lists sessions in a scrolling column, so it loads more of them than the phone page.
const DESKTOP_SESSION_LIMIT = 200;

export default function HistoryPage() {
  const { user } = useAuth();
  const { showError } = useError();
  const isDesktop = useIsDesktop();
  const { sessions, exerciseStats, loading } = useHistory(user?.uid ?? null, undefined, isDesktop ? DESKTOP_SESSION_LIMIT : undefined);
  const { definitions } = useExerciseDefinitions(user?.uid ?? null);
  const { programs, loading: programsLoading } = usePrograms(user?.uid ?? null);
  const bodyMetrics = useBodyMeasurements(user?.uid ?? null);
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

  // Every section above Recent Workouts appears only once its data arrives, so rendering
  // piecemeal pushed the list down mid-tap and the tap landed on the wrong workout.
  if (loading || programsLoading || bodyMetrics.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
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

  // Copy a logged week, and the best set of each exercise: on both layouts.
  const copyWeekControls = (
    <>{programs.length > 0 && (
        <div className="mb-6 lg:mb-0 lg:flex lg:items-center lg:gap-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-0 lg:mr-1 lg:text-xs">Copy a Logged Week</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-wrap items-center gap-2 lg:bg-transparent lg:border-0 lg:p-0 lg:flex-nowrap">
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
      )}</>
  );
  const exerciseProgress = (
    <>{exerciseStats.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Exercise Progress</h2>
          <div className="desk-flat bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 lg:border-b">
            {visibleExercises.map((stat) => (
              <Link
                key={stat.name}
                href={`/exercise/${encodeURIComponent(stat.name)}`}
                className="flex items-center justify-between px-4 py-3 lg:px-0 hover:bg-gray-800 lg:hover:bg-transparent lg:hover:text-indigo-300 transition"
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
                className="w-full px-4 py-3 lg:px-0 text-indigo-400 text-sm text-left hover:bg-gray-800 lg:hover:bg-transparent lg:hover:text-indigo-300 transition"
              >
                {showAllExercises
                  ? "Show less"
                  : `+${exerciseStats.length - EXERCISES_PAGE_SIZE} more exercises`}
              </button>
            )}
          </div>
        </div>
      )}</>
  );

  // Desktop: the session list and the selected session (editable) side by side, with body
  // metrics and exercise progress below.
  if (isDesktop) {
    return (
      <div className="hidden lg:block max-w-[1360px] mx-auto p-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold">History</h1>
          {copyWeekControls}
        </div>
        <HistoryWorkspace
          sessions={sessions}
          definitions={definitions}
          onSave={(id, update) => updateSessionSets(user!.uid, id, update)}
          onDelete={(id) => deleteSession(user!.uid, id)}
        />
        {sessions.length >= DESKTOP_SESSION_LIMIT && (
          <p className="mt-3 text-sm text-gray-500">Showing your latest {DESKTOP_SESSION_LIMIT} sessions.</p>
        )}
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-12 items-start">
          <div>
      <BodyMetricsSection
            entries={bodyMetrics.entries}
            loading={bodyMetrics.loading}
            saving={bodyMetrics.saving}
            deletingId={bodyMetrics.deletingId}
            onSave={bodyMetrics.save}
            onDelete={bodyMetrics.remove}
          />
          </div>
          <div>{exerciseProgress}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 lg:hidden">
      {/* Header: on desktop the copy-a-week controls sit beside the title */}
      <div className="lg:flex lg:items-center lg:justify-between lg:gap-4 lg:mb-6">
      <h1 className="text-2xl font-bold mb-6 lg:mb-0 lg:text-3xl">History</h1>

      {copyWeekControls}
      </div>

      {/* Desktop: body metrics and exercise progress on the left, recent workouts on the right */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-12 lg:items-start">
      <div>

      <BodyMetricsSection
        entries={bodyMetrics.entries}
        loading={bodyMetrics.loading}
        saving={bodyMetrics.saving}
        deletingId={bodyMetrics.deletingId}
        onSave={bodyMetrics.save}
        onDelete={bodyMetrics.remove}
      />

      {exerciseProgress}

      </div>

      <div>
      {/* Session List */}
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Workouts</h2>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No workouts yet. Complete a workout to see it here.
        </div>
      ) : (
        <div className="space-y-2 lg:space-y-0">
          {visibleSessions.map((session) => (
            <div key={session.id} className="desk-flat bg-gray-900 rounded-xl border border-gray-800 flex items-stretch hover:bg-gray-800 lg:hover:bg-gray-900/60 transition">
              <SessionSummary session={session} className="flex-1 p-4 lg:px-0" />
              <CopySessionButton session={session} />
            </div>
          ))}
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
      </div>
      </div>

    </div>
  );
}
