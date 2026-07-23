"use client";

import { useState, useEffect, useCallback } from "react";
import type { ExerciseDefinition } from "@/lib/types";
import { getExerciseDefinitions } from "@/lib/firestore";
import { useError } from "@/components/providers/ErrorProvider";

// The global, per-user exercise library, keyed by id — the shape resolveExercise()/
// resolveWorkout() expect. Reloaded on demand after edits elsewhere (e.g. the
// Exercise Library settings page, or an XLSX import that creates new definitions).
export function useExerciseDefinitions(userId: string | null) {
  const { showError } = useError();
  const [definitions, setDefinitions] = useState<Record<string, ExerciseDefinition>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setDefinitions({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const defs = await getExerciseDefinitions(userId);
      setDefinitions(Object.fromEntries(defs.map((d) => [d.id, d])));
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [userId, showError]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { definitions, loading, reload };
}
