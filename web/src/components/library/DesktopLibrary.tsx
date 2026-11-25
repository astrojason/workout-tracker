"use client";

import { useEffect, useState } from "react";
import type { Program, UserSettings, Workout } from "@/lib/types";
import { getAllWorkoutsForProgram, getPrograms, getSettings } from "@/lib/firestore";
import { useError } from "@/components/providers/ErrorProvider";
import { useHistory } from "@/hooks/useHistory";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { exerciseRows, programRows } from "@/lib/library-index";
import { ProgramsIndex } from "./ProgramsIndex";
import { ExercisesIndex } from "./ExercisesIndex";

// Sessions and last-trained dates on both pages come from this many of the latest sessions.
const SESSION_LIMIT = 200;

function Loading({ what }: { what: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-24 text-gray-400">
      <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" aria-hidden="true" />
      Loading {what}…
    </div>
  );
}

export function DesktopPrograms({ userId }: { userId: string }) {
  const { showError } = useError();
  const { sessions, loading } = useHistory(userId, undefined, SESSION_LIMIT);
  const [data, setData] = useState<{ programs: Program[]; workouts: Workout[]; settings: UserSettings } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [programs, settings] = await Promise.all([getPrograms(userId), getSettings(userId)]);
      const workouts = (await Promise.all(programs.map((p) => getAllWorkoutsForProgram(userId, p.id)))).flat();
      if (!cancelled) setData({ programs, workouts, settings });
    })().catch((err) => {
      if (!cancelled) { setData({ programs: [], workouts: [], settings: { defaultRestSeconds: 0, soundEnabled: false, currentWeeks: {} } }); showError(err); }
    });
    return () => { cancelled = true; };
  }, [userId, showError]);

  if (!data || loading) return <Loading what="programs" />;
  return <ProgramsIndex rows={programRows(data.programs, data.workouts, sessions, data.settings.currentWeeks)} sessionLimit={SESSION_LIMIT} />;
}

export function DesktopExercises({ userId }: { userId: string }) {
  const { showError } = useError();
  const { sessions, loading } = useHistory(userId, undefined, SESSION_LIMIT);
  const { definitions, loading: definitionsLoading } = useExerciseDefinitions(userId);
  const [programs, setPrograms] = useState<Program[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPrograms(userId)
      .then((ps) => { if (!cancelled) setPrograms(ps); })
      .catch((err) => { if (!cancelled) { setPrograms([]); showError(err); } });
    return () => { cancelled = true; };
  }, [userId, showError]);

  if (programs === null || loading || definitionsLoading) return <Loading what="exercises" />;
  return <ExercisesIndex rows={exerciseRows(definitions, programs, sessions)} sessionLimit={SESSION_LIMIT} />;
}
