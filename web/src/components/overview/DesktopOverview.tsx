"use client";

import { useEffect, useState } from "react";
import type { ExerciseDefinition, Program } from "@/lib/types";
import type { WorkoutConsistency } from "@/lib/workout-consistency";
import { useHistory } from "@/hooks/useHistory";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { updateProgramExerciseWeight } from "@/lib/firestore";
import { CUSTOM_PROGRAM_ID } from "@/lib/custom-workout";
import { OverviewReport } from "./OverviewReport";

// Enough for two years of training; if a range ever needs more, the report says some are missing.
const SESSION_LIMIT = 1000;

// Loads what the desktop Overview needs — sessions for the chosen range plus the equal period
// before it, and body measurements — and saves working-weight edits to the program.
export function DesktopOverview({ userId, programs, definitions, consistency, onWeightsChanged }: {
  userId: string;
  programs: Program[];
  definitions: Record<string, ExerciseDefinition>;
  consistency: WorkoutConsistency;
  onWeightsChanged: () => Promise<void>;
}) {
  const [weeks, setWeeks] = useState(12);
  const [programId, setProgramId] = useState<string | null | undefined>(undefined); // undefined = not chosen yet
  const [now] = useState(() => new Date());
  const { sessions, loading } = useHistory(userId, weeks * 2 * 7 + 7, SESSION_LIMIT);
  const { entries, loading: measurementsLoading } = useBodyMeasurements(userId);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (!loading && !measurementsLoading) setLoadedOnce(true);
  }, [loading, measurementsLoading]);

  // Start on the program trained most recently, so the lift table's weights are editable.
  useEffect(() => {
    if (programId !== undefined || loading) return;
    const recent = sessions.find((s) => s.programId !== CUSTOM_PROGRAM_ID && programs.some((p) => p.id === s.programId));
    setProgramId(recent?.programId ?? programs[0]?.id ?? null);
  }, [programId, loading, sessions, programs]);

  if (!loadedOnce || programId === undefined) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-gray-400">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" aria-hidden="true" />
        Loading overview…
      </div>
    );
  }

  return (
    <OverviewReport
      sessions={sessions}
      measurements={entries}
      programs={programs}
      definitions={definitions}
      weeks={weeks}
      onWeeksChange={setWeeks}
      programId={programId}
      onProgramChange={setProgramId}
      onSaveWeight={async (pid, definitionId, weight, hardStreak) => {
        await updateProgramExerciseWeight(userId, pid, definitionId, weight, hardStreak);
        await onWeightsChanged();
      }}
      now={now}
      reloading={loading}
      truncated={sessions.length >= SESSION_LIMIT}
      consistency={consistency}
    />
  );
}
