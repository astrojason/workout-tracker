"use client";

import { useState, useEffect, useCallback } from "react";
import type { Program, Workout, UserSettings } from "@/lib/types";
import {
  getPrograms, getSettings, updateSettings,
  getWorkoutsForProgram, getAllWorkoutsForProgram,
  getCompletedDays, saveProgram, saveWorkout,
} from "@/lib/firestore";
import { parseCSV } from "@/lib/csv-parser";
import { DAY_ORDER } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

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

      // Load workouts for each program's current week
      for (const prog of progs) {
        const week = sett.currentWeeks[prog.name] || 1;
        const workouts = await getWorkoutsForProgram(userId!, prog.name, week);
        if (cancelled) return;
        setWorkoutsCache((prev) => ({ ...prev, [`${prog.name}_${week}`]: workouts }));

        const completed = await getCompletedDays(userId!, prog.name, week);
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
    const completed = await getCompletedDays(userId, programName, week);
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

  const importCSV = useCallback(async (csvContent: string) => {
    if (!userId) return;

    const { programs: parsed, workouts } = parseCSV(csvContent);

    for (const prog of parsed) {
      await saveProgram(userId, { ...prog, createdAt: Timestamp.now() });
    }
    for (const workout of workouts) {
      await saveWorkout(userId, workout);
    }

    // Reload
    const progs = await getPrograms(userId);
    setPrograms(progs);

    for (const prog of progs) {
      const week = settings.currentWeeks[prog.name] || 1;
      const wks = await getWorkoutsForProgram(userId, prog.name, week);
      setWorkoutsCache((prev) => ({ ...prev, [`${prog.name}_${week}`]: wks }));
    }
  }, [userId, settings]);

  const updateUserSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!userId) return;
    setSettingsState((prev) => ({ ...prev, ...updates }));
    await updateSettings(userId, updates);
  }, [userId]);

  const refreshCompletedDays = useCallback(async () => {
    if (!userId) return;
    for (const prog of programs) {
      const week = settings.currentWeeks[prog.name] || 1;
      const completed = await getCompletedDays(userId, prog.name, week);
      setCompletedDaysCache((prev) => ({ ...prev, [`${prog.name}_${week}`]: completed }));
    }
  }, [userId, programs, settings]);

  return {
    programs,
    settings,
    loading,
    currentWeek,
    setCurrentWeek,
    getTodaysWorkout,
    getWorkoutsForDay,
    getAvailableDays,
    getCompletedDaysForProgram,
    importCSV,
    updateUserSettings,
    refreshCompletedDays,
  };
}
