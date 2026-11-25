"use client";

import { useEffect, useState } from "react";
import type { Program, Workout } from "@/lib/types";
import { getAllWorkoutsForProgram, getPrograms, saveExerciseDefinition } from "@/lib/firestore";
import { usePrograms } from "@/hooks/usePrograms";
import { useError } from "@/components/providers/ErrorProvider";
import { useHistory } from "@/hooks/useHistory";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { useEquipmentConfig } from "@/hooks/useEquipmentConfig";
import { exerciseRows, programRows } from "@/lib/library-index";
import { ProgramsManager } from "./ProgramsManager";
import { ExerciseLibraryEditor } from "./ExerciseLibraryEditor";

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

// Desktop Programs: the programs table with management (the same actions phone Settings offers).
export function DesktopPrograms({ userId }: { userId: string }) {
  const { showError } = useError();
  const p = usePrograms(userId);
  const { sessions, loading } = useHistory(userId, undefined, SESSION_LIMIT);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [reload, setReload] = useState(0); // bumped after an import or re-import changes workouts
  const programKey = p.programs.map((x) => x.id).sort().join(",");

  useEffect(() => {
    if (p.loading) return;
    let cancelled = false;
    Promise.all(p.programs.map((prog) => getAllWorkoutsForProgram(userId, prog.id)))
      .then((lists) => { if (!cancelled) setWorkouts(lists.flat()); })
      .catch((err) => { if (!cancelled) { setWorkouts([]); showError(err); } });
    return () => { cancelled = true; };
    // Reload when the set of programs changes or after an import; not on every programs update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, p.loading, programKey, reload, showError]);

  if (p.loading || workouts === null || loading) return <Loading what="programs" />;
  return (
    <ProgramsManager
      rows={programRows(p.programs, workouts, sessions, p.settings.currentWeeks)}
      sessionLimit={SESSION_LIMIT}
      onImport={async (data, name, ask) => { await p.importXLSX(data, name, ask); setReload((n) => n + 1); }}
      onReimport={async (id, name, data, ask) => { await p.reimportProgram(id, name, data, ask); setReload((n) => n + 1); }}
      onRename={p.renameProgram}
      onChangeWeek={p.setCurrentWeek}
      onArchive={p.archiveProgram}
      onUnarchive={p.unarchiveProgram}
      onDelete={p.deleteProgram}
    />
  );
}

export function DesktopExercises({ userId }: { userId: string }) {
  const { showError } = useError();
  const { sessions, loading } = useHistory(userId, undefined, SESSION_LIMIT);
  const { definitions, machines, loading: definitionsLoading, reload } = useExerciseDefinitions(userId);
  const { config: equipment, loading: equipmentLoading } = useEquipmentConfig(userId);
  // Only the first load shows the spinner; a reload after a save keeps the table (and its status) up.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (!definitionsLoading) setLoaded(true); }, [definitionsLoading]);
  const [programs, setPrograms] = useState<Program[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPrograms(userId)
      .then((ps) => { if (!cancelled) setPrograms(ps); })
      .catch((err) => { if (!cancelled) { setPrograms([]); showError(err); } });
    return () => { cancelled = true; };
  }, [userId, showError]);

  if (programs === null || loading || !loaded || equipmentLoading) return <Loading what="exercises" />;
  return (
    <ExerciseLibraryEditor
      rows={exerciseRows(definitions, programs, sessions, { items: equipment.items ?? [], machines })}
      sessionLimit={SESSION_LIMIT}
      definitions={definitions}
      machines={machines}
      equipment={equipment}
      onSave={async (id, save) => { await saveExerciseDefinition(userId, id, save); await reload(); }}
    />
  );
}
