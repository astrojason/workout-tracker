"use client";

import { useState, useEffect } from "react";
import type { WorkoutSessionDoc } from "@/lib/types";
import { subscribeToSessions, getExerciseHistory } from "@/lib/firestore";

interface ExerciseStat {
  name: string;
  maxWeight: number;
  maxWeightReps: number;
  isTimeBased: boolean;
  isBodyweight: boolean;
  maxReps: number; // max reps (bodyweight) or max duration in seconds (time-based)
}

export function useHistory(userId: string | null) {
  const [sessions, setSessions] = useState<WorkoutSessionDoc[]>([]);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const unsubscribe = subscribeToSessions(userId, 50, (sess) => {
      // Compute per-exercise best set from sessions client-side.
      const statsMap = new Map<string, ExerciseStat>();
      for (const session of sess) {
        for (const set of session.sets || []) {
          if (!set.completed) continue;
          const timeBased = set.isTimeBased === true;
          const bodyweight = !timeBased && set.equipmentType === "bodyweight";
          const existing = statsMap.get(set.exerciseName);

          if (timeBased || bodyweight) {
            if (!existing || set.actualReps > existing.maxReps) {
              statsMap.set(set.exerciseName, {
                name: set.exerciseName,
                maxWeight: 0,
                maxWeightReps: 0,
                isTimeBased: timeBased,
                isBodyweight: bodyweight,
                maxReps: set.actualReps,
              });
            }
          } else if (set.actualWeight > 0) {
            if (!existing || set.actualWeight > existing.maxWeight) {
              statsMap.set(set.exerciseName, {
                name: set.exerciseName,
                maxWeight: set.actualWeight,
                maxWeightReps: set.actualReps,
                isTimeBased: false,
                isBodyweight: false,
                maxReps: 0,
              });
            }
          }
        }
      }
      const stats = Array.from(statsMap.values())
        .sort((a, b) => a.name.localeCompare(b.name));

      setSessions(sess);
      setExerciseStats(stats);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  return { sessions, exerciseStats, loading };
}

// definitionId, when known, makes matching rename-proof — sets logged after the
// exercise library existed carry it, so a rename doesn't orphan their history.
// Pass null when the definition can't be resolved (falls back to a name match).
export function useExerciseHistory(userId: string | null, exerciseName: string, definitionId: string | null = null) {
  const [history, setHistory] = useState<{ date: Date; weight: number; reps: number; volume: number; isTimeBased?: boolean; isBodyweight?: boolean }[]>([]);
  const [isTimeBased, setIsTimeBased] = useState(false);
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !exerciseName) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await getExerciseHistory(userId!, exerciseName, definitionId);
      if (cancelled) return;
      setHistory(data);
      const firstWithMeta = data.find((d) => d.isTimeBased !== undefined || d.isBodyweight !== undefined);
      setIsTimeBased(firstWithMeta?.isTimeBased === true);
      setIsBodyweight(firstWithMeta?.isBodyweight === true);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId, exerciseName, definitionId]);

  return { history, isTimeBased, isBodyweight, loading };
}
