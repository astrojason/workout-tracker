"use client";

import { useState, useEffect, useCallback } from "react";
import type { Program, Workout, UserSettings } from "@/lib/types";
import {
  getPrograms, getSettings, updateSettings,
  getWorkoutsForProgram,
  getCompletedDays, saveProgram, saveWorkout,
  deleteProgramDoc, deleteAllWorkoutsForProgram, setProgramArchived,
} from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { parseXLSX } from "@/lib/xlsx-parser";
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
      setPrograms(progs);
      setSettingsState(sett);

      // Load workouts for each active program's current week
      for (const prog of progs.filter((p) => !p.archived)) {
        const week = sett.currentWeeks[prog.name] || 1;
        const workouts = await getWorkoutsForProgram(userId!, prog.name, week);
        if (cancelled) return;
        setWorkoutsCache((prev) => ({ ...prev, [`${prog.name}_${week}`]: workouts }));

        const since = prog.createdAt instanceof Timestamp
          ? prog.createdAt.toDate()
          : prog.createdAt instanceof Date ? prog.createdAt : undefined;
        const completed = await getCompletedDays(userId!, prog.name, week, since);
        if (cancelled) return;
        setCompletedDaysCache((prev) => ({ ...prev, [`${prog.name}_${week}`]: completed }));
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const currentWeek = useCallback((programName: string) => {
    return settings.currentWeeks[programName] || 1;
  }, [settings]);

  const setCurrentWeek = useCallback(async (programName: string, week: number) => {
    if (!userId) return;
    const newWeeks = { ...settings.currentWeeks, [programName]: week };
    setSettingsState((prev) => ({ ...prev, currentWeeks: newWeeks }));
    await updateSettings(userId, { currentWeeks: newWeeks });

    // Load workouts for the new week
    const workouts = await getWorkoutsForProgram(userId, programName, week);
    setWorkoutsCache((prev) => ({ ...prev, [`${programName}_${week}`]: workouts }));
    const prog = programs.find((p) => p.name === programName);
    const since = prog?.createdAt instanceof Timestamp
      ? prog.createdAt.toDate()
      : prog?.createdAt instanceof Date ? prog.createdAt : undefined;
    const completed = await getCompletedDays(userId, programName, week, since);
    setCompletedDaysCache((prev) => ({ ...prev, [`${programName}_${week}`]: completed }));
  }, [userId, settings]);

  const getWorkoutsForDay = useCallback((programName: string, day: string): Workout | null => {
    const week = settings.currentWeeks[programName] || 1;
    const key = `${programName}_${week}`;
    const workouts = workoutsCache[key] || [];
    return workouts.find((w) => w.dayOfWeek === day) || null;
  }, [workoutsCache, settings]);

  const getTodaysWorkout = useCallback((programName: string): Workout | null => {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    return getWorkoutsForDay(programName, today) || getWorkoutsForDay(programName, "Daily");
  }, [getWorkoutsForDay]);

  const getAvailableDays = useCallback((programName: string): string[] => {
    const week = settings.currentWeeks[programName] || 1;
    const key = `${programName}_${week}`;
    const workouts = workoutsCache[key] || [];
    const days = workouts.map((w) => w.dayOfWeek);
    return DAY_ORDER.filter((d) => days.includes(d));
  }, [workoutsCache, settings]);

  const getCompletedDaysForProgram = useCallback((programName: string): Set<string> => {
    const week = settings.currentWeeks[programName] || 1;
    return completedDaysCache[`${programName}_${week}`] || new Set();
  }, [completedDaysCache, settings]);

  async function _cacheWorkoutsForProgram(progName: string) {
    if (!userId) return;
    const week = settings.currentWeeks[progName] || 1;
    const wks = await getWorkoutsForProgram(userId, progName, week);
    setWorkoutsCache((prev) => ({ ...prev, [`${progName}_${week}`]: wks }));
  }

  async function _saveAndReload(
    parsed: ReturnType<typeof parseXLSX>,
    nameOverride?: string,
  ) {
    if (!userId) return;
    const finalPrograms = nameOverride
      ? parsed.programs.map((p) => ({ ...p, name: nameOverride }))
      : parsed.programs;
    const finalWorkouts = nameOverride
      ? parsed.workouts.map((w) => ({ ...w, programName: nameOverride }))
      : parsed.workouts;
    for (const prog of finalPrograms) {
      await saveProgram(userId, { ...prog, createdAt: Timestamp.now() });
    }
    for (const workout of finalWorkouts) {
      await saveWorkout(userId, workout);
    }
    const progs = await getPrograms(userId);
    setPrograms(progs);
    for (const prog of progs.filter((p) => !p.archived)) {
      await _cacheWorkoutsForProgram(prog.name);
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

    const finalWorkouts = parsed.workouts.map((w) => ({ ...w, programName }));

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
    await _cacheWorkoutsForProgram(programName);
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
    if (prog) await _cacheWorkoutsForProgram(prog.name);
  }, [userId, programs, settings]);

  const deleteProgram = useCallback(async (programId: string, programName: string) => {
    if (!userId) return;
    await deleteProgramDoc(userId, programId);
    await deleteAllWorkoutsForProgram(userId, programName);

    // Update local state
    setPrograms((prev) => prev.filter((p) => p.id !== programId));

    // Clean up currentWeeks
    const { [programName]: _, ...restWeeks } = settings.currentWeeks;
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
    setWorkoutsCache((prev) => evictPrefix(prev, `${programName}_`));
    setCompletedDaysCache((prev) => evictPrefix(prev, `${programName}_`));
  }, [userId, settings]);

  const updateWorkout = useCallback(async (workout: Workout) => {
    if (!userId) return;
    await saveWorkout(userId, workout);
    // Refresh cache for this program/week
    const workouts = await getWorkoutsForProgram(userId, workout.programName, workout.week);
    setWorkoutsCache((prev) => ({ ...prev, [`${workout.programName}_${workout.week}`]: workouts }));
  }, [userId]);

  const loadWorkoutsForWeek = useCallback(async (programName: string, week: number): Promise<Workout[]> => {
    if (!userId) return [];
    return getWorkoutsForProgram(userId, programName, week);
  }, [userId]);

  const updateUserSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!userId) return;
    setSettingsState((prev) => ({ ...prev, ...updates }));
    await updateSettings(userId, updates);
  }, [userId]);

  const refreshCompletedDays = useCallback(async () => {
    if (!userId) return;
    for (const prog of programs.filter((p) => !p.archived)) {
      const week = settings.currentWeeks[prog.name] || 1;
      const since = prog.createdAt instanceof Timestamp
        ? prog.createdAt.toDate()
        : prog.createdAt instanceof Date ? prog.createdAt : undefined;
      const completed = await getCompletedDays(userId, prog.name, week, since);
      setCompletedDaysCache((prev) => ({ ...prev, [`${prog.name}_${week}`]: completed }));
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
    updateWorkout,
    loadWorkoutsForWeek,
    updateUserSettings,
    refreshCompletedDays,
  };
}
