"use client";

import { useState, useEffect } from "react";
import type { WorkoutSessionDoc } from "@/lib/types";
import { getSessions, getExerciseHistory } from "@/lib/firestore";

export interface ExerciseStat {
  name: string;
  maxWeight: number;
  maxWeightReps: number;
}

export function useHistory(userId: string | null) {
  const [sessions, setSessions] = useState<WorkoutSessionDoc[]>([]);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const sess = await getSessions(userId!);
      if (cancelled) return;

      // Compute per-exercise best set from sessions client-side.
      // Filter out weight=0 exercises (warmups, mobility, bodyweight-only).
      const statsMap = new Map<string, ExerciseStat>();
      for (const session of sess) {
        for (const set of session.sets || []) {
          if (!set.completed) continue;
          const existing = statsMap.get(set.exerciseName);
          if (!existing || set.actualWeight > existing.maxWeight) {
            statsMap.set(set.exerciseName, {
              name: set.exerciseName,
              maxWeight: set.actualWeight,
              maxWeightReps: set.actualReps,
            });
          }
        }
      }
      const stats = Array.from(statsMap.values())
        .filter((s) => s.maxWeight > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      setSessions(sess);
      setExerciseStats(stats);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  return { sessions, exerciseStats, loading };
}

export function useExerciseHistory(userId: string | null, exerciseName: string) {
  const [history, setHistory] = useState<{ date: Date; weight: number; reps: number; volume: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !exerciseName) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await getExerciseHistory(userId!, exerciseName);
      if (cancelled) return;
      setHistory(data);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId, exerciseName]);

  return { history, loading };
}
