"use client";

import { useState, useEffect, useCallback } from "react";
import type { ExerciseDefinition, GymMachine } from "@/lib/types";
import { getExerciseDefinitions, getGymMachines } from "@/lib/firestore";
import { applyGymMachines } from "@/lib/gym-machines";
import { useError } from "@/components/providers/ErrorProvider";

// The global, per-user exercise library, keyed by id — the shape resolveExercise()/
// resolveWorkout() expect. Reloaded on demand after edits elsewhere (e.g. the
// Exercise Library settings page, or an XLSX import that creates new definitions).
// Exercises linked to a gym machine come back with that machine's weights as weightOptions,
// so every consumer (weight picker, progression) sees them without knowing about machines.
export function useExerciseDefinitions(userId: string | null) {
  const { showError } = useError();
  const [definitions, setDefinitions] = useState<Record<string, ExerciseDefinition>>({});
  const [machines, setMachines] = useState<GymMachine[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setDefinitions({});
      setMachines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [defs, machineList] = await Promise.all([getExerciseDefinitions(userId), getGymMachines(userId)]);
      setDefinitions(applyGymMachines(Object.fromEntries(defs.map((d) => [d.id, d])), machineList));
      setMachines(machineList);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [userId, showError]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { definitions, machines, loading, reload };
}
