"use client";

import { useState, useEffect } from "react";
import type { WorkoutSessionDoc } from "@/lib/types";
import { getSessions, getAllExerciseNames, getExerciseHistory } from "@/lib/firestore";

export function useHistory(userId: string | null) {
  const [sessions, setSessions] = useState<WorkoutSessionDoc[]>([]);
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [sess, names] = await Promise.all([
        getSessions(userId!),
        getAllExerciseNames(userId!),
      ]);
      if (cancelled) return;
      setSessions(sess);
      setExerciseNames(names);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  return { sessions, exerciseNames, loading };
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
