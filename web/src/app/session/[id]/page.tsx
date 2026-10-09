"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useError } from "@/components/providers/ErrorProvider";
import { getSession, deleteSession } from "@/lib/firestore";
import { formatDuration } from "@/lib/types";
import type { WorkoutSessionDoc } from "@/lib/types";
import { groupSetsByOccurrence } from "@/lib/set-groups";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import { CoachSection } from "@/components/workout/CoachSection";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { useHistory } from "@/hooks/useHistory";
import { SessionExerciseTable } from "@/components/history/SessionExerciseTable";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { showError } = useError();
  const router = useRouter();
  const { definitions, reload: reloadDefinitions } = useExerciseDefinitions(user?.uid ?? null);
  const { sessions } = useHistory(user?.uid ?? null);
  const [session, setSession] = useState<WorkoutSessionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getSession(user.uid, id)
      .then((s) => setSession(s))
      .catch(showError)
      .finally(() => setLoading(false));
  }, [user, id, showError]);

  async function handleDelete() {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteSession(user.uid, id);
      router.push("/history");
    } catch (err) {
      showError(err);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

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

  const groups = groupSetsByOccurrence(session.sets ?? []);
  const completedSets = session.sets?.filter((s) => s.completed) ?? [];
  const hasRatings = session.sets?.some((s) => s.rating) ?? false;

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <Link href="/history" className="text-indigo-400 text-sm inline-block">&larr; Back to History</Link>
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-gray-600 hover:text-red-400 transition p-1"
          title="Delete session"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

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
          <div className={`font-bold ${session.skipped ? "text-amber-500" : session.completed ? "text-green-400" : "text-yellow-400"}`}>
            {session.skipped ? "Skipped" : session.completed ? "Done" : "Partial"}
          </div>
          <div className="text-xs text-gray-400">Status</div>
        </div>
      </div>

      {/* Exercises */}
      {groups.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {session.skipped ? "Marked as skipped — no sets recorded." : "No sets recorded."}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ order, name, exerciseName, sets }) => (
            <SessionExerciseTable key={order} name={name} exerciseName={exerciseName} sets={sets} hasRatings={hasRatings} />
          ))}
        </div>
      )}

      {completedSets.length > 0 && !session.skipped && (
        <div className="mt-6">
          <CoachSection
            programId={session.programId}
            programName={session.programName}
            week={session.week}
            dayOfWeek={session.dayOfWeek}
            durationSeconds={session.durationSeconds}
            sets={completedSets}
            prs={[]}
            sessionDate={date}
            sessions={sessions}
            definitions={definitions}
            onApplied={reloadDefinitions}
          />
        </div>
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          title="Delete Session"
          message={`Delete this ${session.dayOfWeek} Week ${session.week} session? This cannot be undone.`}
          isConfirming={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
