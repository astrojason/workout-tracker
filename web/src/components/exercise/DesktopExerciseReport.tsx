"use client";

import { useEffect, useState } from "react";
import type { ExerciseDefinition, Program } from "@/lib/types";
import { useHistory } from "@/hooks/useHistory";
import { useError } from "@/components/providers/ErrorProvider";
import { getPrograms } from "@/lib/firestore";
import { ExerciseReport } from "./ExerciseReport";

const SESSION_LIMIT = 1000;

// Loads what the desktop exercise report needs: the sessions in the chosen range and the program
// list (for the program filter and this exercise's working load in each program).
export function DesktopExerciseReport({ userId, name, definition }: { userId: string; name: string; definition: ExerciseDefinition | null }) {
  const { showError } = useError();
  const [weeks, setWeeks] = useState(12);
  const [programId, setProgramId] = useState<string | null | undefined>(undefined); // undefined = not chosen yet
  const [now] = useState(() => new Date());
  const { sessions, loading } = useHistory(userId, weeks * 7 + 7, SESSION_LIMIT);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPrograms(userId)
      .then((ps) => {
        if (cancelled) return;
        // Archived programs stay listed: their sessions are still in history.
        setPrograms(ps.map((p) => (p.archived ? { ...p, name: `${p.name} (archived)` } : p)));
      })
      .catch((err) => {
        if (!cancelled) { setPrograms([]); showError(err); }
      });
    return () => { cancelled = true; };
  }, [userId, showError]);

  useEffect(() => {
    if (!loading) setLoadedOnce(true);
  }, [loading]);

  // Start on the program this exercise was most recently done in, so its working load shows.
  useEffect(() => {
    if (programId !== undefined || loading || programs === null) return;
    const latest = sessions.find((s) => programs.some((p) => p.id === s.programId) && (s.sets ?? []).some((set) =>
      definition && set.definitionId ? set.definitionId === definition.id : set.exerciseName === name));
    setProgramId(latest?.programId ?? null);
  }, [programId, loading, programs, sessions, definition, name]);

  if (!loadedOnce || programs === null || programId === undefined) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-gray-400">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" aria-hidden="true" />
        Loading {name}…
      </div>
    );
  }

  return (
    <ExerciseReport
      name={name}
      definition={definition}
      sessions={sessions}
      programs={programs}
      weeks={weeks}
      onWeeksChange={setWeeks}
      programId={programId}
      onProgramChange={setProgramId}
      now={now}
      reloading={loading}
      truncated={sessions.length >= SESSION_LIMIT}
    />
  );
}
