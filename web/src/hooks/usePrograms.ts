"use client";

import { useState, useEffect, useCallback } from "react";
import type { Program, Workout, UserSettings } from "@/lib/types";
import {
  getPrograms, getSettings, updateSettings,
  getWorkoutsForProgram,
  getCompletedDays, saveProgram, saveWorkout,
  deleteProgramDoc, deleteAllWorkoutsForProgram, setProgramArchived,
  renameProgram as renameProgramDoc, migrateProgramIds,
} from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { parseXLSX } from "@/lib/xlsx-parser";
import { resolveExerciseDefinitions } from "@/lib/exercise-import";
import { DAY_ORDER } from "@/lib/types";

export function usePrograms(userId: string | null) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [settings, setSettingsState] = useState<UserSettings>({
    defaultRestSeconds: 120,
    soundEnabled: true,
    currentWeeks: {},
  });
  const [workoutsCache, setWorkoutsCache] = useState<Record<string, Workout[]>>({});
  const [completedDaysCache, setCompletedDaysCache] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);

  // Load programs and settings
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [progs, sett] = await Promise.all([
        getPrograms(userId!),
        getSettings(userId!),
      ]);
      if (cancelled) return;

      // One-time backfill: legacy Workout/WorkoutSessionDoc docs predate programId
      // and were only linked to a program by name. Safe to skip once migrated.
      if (!sett.migratedProgramIds) {
        await migrateProgramIds(userId!, progs);
        await updateSettings(userId!, { migratedProgramIds: true });
        sett.migratedProgramIds = true;
      }

      // NOTE: the exercise-library migration (embedded exercise metadata ->
      // definitionId references) is NOT run automatically here. It rewrites
      // existing Workout documents, and this app's code requires every exercise
      // to already have a definitionId — running it from within the app risked
      // a preview deployment migrating production data before main was ready for
      // it. Run `npm run migrate:exercise-library -- <uid>` manually before
      // deploying code that expects the new schema. See scripts/migrate-exercise-library.ts.

      setPrograms(progs);
      setSettingsState(sett);

      // Load workouts for each active program's current week
      for (const prog of progs.filter((p) => !p.archived)) {
        const week = sett.currentWeeks[prog.id] || 1;
        const workouts = await getWorkoutsForProgram(userId!, prog.id, week);
        if (cancelled) return;
        setWorkoutsCache((prev) => ({ ...prev, [`${prog.id}_${week}`]: workouts }));

        const since = prog.createdAt instanceof Timestamp
          ? prog.createdAt.toDate()
          : prog.createdAt instanceof Date ? prog.createdAt : undefined;
        const completed = await getCompletedDays(userId!, prog.id, week, since);
        if (cancelled) return;
        setCompletedDaysCache((prev) => ({ ...prev, [`${prog.id}_${week}`]: completed }));
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const currentWeek = useCallback((programId: string) => {
    return settings.currentWeeks[programId] || 1;
  }, [settings]);

  const setCurrentWeek = useCallback(async (programId: string, week: number) => {
    if (!userId) return;
    const newWeeks = { ...settings.currentWeeks, [programId]: week };
    setSettingsState((prev) => ({ ...prev, currentWeeks: newWeeks }));
    await updateSettings(userId, { currentWeeks: newWeeks });

    // Load workouts for the new week
    const workouts = await getWorkoutsForProgram(userId, programId, week);
    setWorkoutsCache((prev) => ({ ...prev, [`${programId}_${week}`]: workouts }));
    const prog = programs.find((p) => p.id === programId);
    const since = prog?.createdAt instanceof Timestamp
      ? prog.createdAt.toDate()
      : prog?.createdAt instanceof Date ? prog.createdAt : undefined;
    const completed = await getCompletedDays(userId, programId, week, since);
    setCompletedDaysCache((prev) => ({ ...prev, [`${programId}_${week}`]: completed }));
  }, [userId, settings, programs]);

  const getWorkoutsForDay = useCallback((programId: string, day: string): Workout | null => {
    const week = settings.currentWeeks[programId] || 1;
    const key = `${programId}_${week}`;
    const workouts = workoutsCache[key] || [];
    return workouts.find((w) => w.dayOfWeek === day) || null;
  }, [workoutsCache, settings]);

  const getTodaysWorkout = useCallback((programId: string): Workout | null => {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    return getWorkoutsForDay(programId, today) || getWorkoutsForDay(programId, "Daily");
  }, [getWorkoutsForDay]);

  const getAvailableDays = useCallback((programId: string): string[] => {
    const week = settings.currentWeeks[programId] || 1;
    const key = `${programId}_${week}`;
    const workouts = workoutsCache[key] || [];
    const days = workouts.map((w) => w.dayOfWeek);
    return DAY_ORDER.filter((d) => days.includes(d));
  }, [workoutsCache, settings]);

  const getCompletedDaysForProgram = useCallback((programId: string): Set<string> => {
    const week = settings.currentWeeks[programId] || 1;
    return completedDaysCache[`${programId}_${week}`] || new Set();
  }, [completedDaysCache, settings]);

  async function _cacheWorkoutsForProgram(progId: string) {
    if (!userId) return;
    const week = settings.currentWeeks[progId] || 1;
    const wks = await getWorkoutsForProgram(userId, progId, week);
    setWorkoutsCache((prev) => ({ ...prev, [`${progId}_${week}`]: wks }));
  }

  async function _saveAndReload(
    parsed: ReturnType<typeof parseXLSX>,
    nameOverride?: string,
  ) {
    if (!userId) return;
    const finalPrograms = nameOverride
      ? parsed.programs.map((p) => ({ ...p, name: nameOverride }))
      : parsed.programs;
    // parseXLSX always returns exactly one program per parse; its id is stable
    // regardless of nameOverride and is what workouts must be keyed by.
    const programId = finalPrograms[0].id;
    const finalParsedWorkouts = parsed.workouts.map((w) => ({
      ...w,
      programId,
      programName: nameOverride ?? w.programName,
    }));
    // Matches each exercise name against the user's global exercise library
    // (creating or updating definitions as needed) before anything is saved.
    const finalWorkouts = await resolveExerciseDefinitions(userId, finalParsedWorkouts);
    for (const prog of finalPrograms) {
      await saveProgram(userId, { ...prog, createdAt: Timestamp.now() });
    }
    for (const workout of finalWorkouts) {
      await saveWorkout(userId, workout);
    }
    const progs = await getPrograms(userId);
    setPrograms(progs);
    for (const prog of progs.filter((p) => !p.archived)) {
      await _cacheWorkoutsForProgram(prog.id);
    }
  }

  const importXLSX = useCallback(async (buffer: ArrayBuffer, nameOverride?: string) => {
    if (!userId) return;
    await _saveAndReload(parseXLSX(buffer), nameOverride);
  }, [userId, settings]);

  // Re-import: replaces workout definitions for an existing program without
  // touching createdAt (so completed-days scoping stays correct).
  const reimportProgram = useCallback(async (
    programId: string,
    programName: string,
    data: ArrayBuffer,
  ) => {
    if (!userId) return;
    const existing = programs.find((p) => p.id === programId);
    const parsed = parseXLSX(data, programName);

    const finalParsedWorkouts = parsed.workouts.map((w) => ({ ...w, programId, programName }));
    const finalWorkouts = await resolveExerciseDefinitions(userId, finalParsedWorkouts);

    // Update the program doc (totalWeeks may change) but preserve createdAt.
    for (const prog of parsed.programs) {
      await saveProgram(userId, {
        ...prog,
        name: programName,
        id: programId,
        createdAt: existing?.createdAt ?? new Date(),
        archived: existing?.archived ?? false,
      });
    }
    for (const workout of finalWorkouts) {
      await saveWorkout(userId, workout);
    }

    const progs = await getPrograms(userId);
    setPrograms(progs);
    await _cacheWorkoutsForProgram(programId);
  }, [userId, programs, settings]);

  const archiveProgram = useCallback(async (programId: string) => {
    if (!userId) return;
    await setProgramArchived(userId, programId, true);
    setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, archived: true } : p));
  }, [userId]);

  const unarchiveProgram = useCallback(async (programId: string) => {
    if (!userId) return;
    await setProgramArchived(userId, programId, false);
    setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, archived: false } : p));
    // Load workouts for the newly active program
    const prog = programs.find((p) => p.id === programId);
    if (prog) await _cacheWorkoutsForProgram(prog.id);
  }, [userId, programs, settings]);

  const deleteProgram = useCallback(async (programId: string) => {
    if (!userId) return;
    await deleteProgramDoc(userId, programId);
    await deleteAllWorkoutsForProgram(userId, programId);

    // Update local state
    setPrograms((prev) => prev.filter((p) => p.id !== programId));

    // Clean up currentWeeks
    const { [programId]: _, ...restWeeks } = settings.currentWeeks;
    setSettingsState((prev) => ({ ...prev, currentWeeks: restWeeks }));
    await updateSettings(userId, { currentWeeks: restWeeks });

    // Clean up caches
    const evictPrefix = <T>(prev: Record<string, T>, prefix: string): Record<string, T> => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(prefix)) delete next[key];
      }
      return next;
    };
    setWorkoutsCache((prev) => evictPrefix(prev, `${programId}_`));
    setCompletedDaysCache((prev) => evictPrefix(prev, `${programId}_`));
  }, [userId, settings]);

  // Renaming preserves progress: the program keeps its id, so currentWeeks,
  // cached workouts, and history all stay linked — only display strings change.
  const renameProgram = useCallback(async (programId: string, newName: string) => {
    if (!userId) return;
    await renameProgramDoc(userId, programId, newName);
    setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, name: newName } : p));
    await _cacheWorkoutsForProgram(programId);
  }, [userId, settings]);

  const updateWorkout = useCallback(async (workout: Workout) => {
    if (!userId) return;
    await saveWorkout(userId, workout);
    // Refresh cache for this program/week
    const workouts = await getWorkoutsForProgram(userId, workout.programId, workout.week);
    setWorkoutsCache((prev) => ({ ...prev, [`${workout.programId}_${workout.week}`]: workouts }));
  }, [userId]);

  const loadWorkoutsForWeek = useCallback(async (programId: string, week: number): Promise<Workout[]> => {
    if (!userId) return [];
    return getWorkoutsForProgram(userId, programId, week);
  }, [userId]);

  const updateUserSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!userId) return;
    setSettingsState((prev) => ({ ...prev, ...updates }));
    await updateSettings(userId, updates);
  }, [userId]);

  const refreshCompletedDays = useCallback(async () => {
    if (!userId) return;
    for (const prog of programs.filter((p) => !p.archived)) {
      const week = settings.currentWeeks[prog.id] || 1;
      const since = prog.createdAt instanceof Timestamp
        ? prog.createdAt.toDate()
        : prog.createdAt instanceof Date ? prog.createdAt : undefined;
      const completed = await getCompletedDays(userId, prog.id, week, since);
      setCompletedDaysCache((prev) => ({ ...prev, [`${prog.id}_${week}`]: completed }));
    }
  }, [userId, programs, settings]);

  const activePrograms = programs.filter((p) => !p.archived);
  const archivedPrograms = programs.filter((p) => p.archived);

  return {
    programs,
    activePrograms,
    archivedPrograms,
    settings,
    loading,
    currentWeek,
    setCurrentWeek,
    getTodaysWorkout,
    getWorkoutsForDay,
    getAvailableDays,
    getCompletedDaysForProgram,
    importXLSX,
    reimportProgram,
    archiveProgram,
    unarchiveProgram,
    deleteProgram,
    renameProgram,
    updateWorkout,
    loadWorkoutsForWeek,
    updateUserSettings,
    refreshCompletedDays,
  };
}
