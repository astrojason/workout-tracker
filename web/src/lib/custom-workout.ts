import type { CompletedSet, EquipmentType } from "@/lib/types";

// One set as entered in the custom workout builder.
export interface CustomSetEntry {
  exerciseName: string;
  weight: number;
  reps: number;
}

// Library info for an exercise the user picked by name, keyed by lowercased trimmed name.
export interface CustomExerciseInfo {
  definitionId: string;
  name: string;
  equipmentType: EquipmentType;
  isTimeBased: boolean;
}

export const CUSTOM_PROGRAM_ID = "custom";
export const CUSTOM_PROGRAM_NAME = "Custom Workout";

export function exerciseKey(name: string): string {
  return name.trim().toLowerCase();
}

// Turns the builder's entries into CompletedSets. Exercises are ordered by first appearance and
// sets numbered per exercise, so revisiting an exercise later still groups under it.
export function buildCustomSets(
  entries: CustomSetEntry[],
  library: Record<string, CustomExerciseInfo>,
  timestamp: Date,
): CompletedSet[] {
  const orders = new Map<string, number>();
  const counts = new Map<string, number>();
  return entries.map((entry) => {
    const key = exerciseKey(entry.exerciseName);
    if (!orders.has(key)) orders.set(key, orders.size + 1);
    const setNumber = (counts.get(key) ?? 0) + 1;
    counts.set(key, setNumber);
    const info = library[key];
    return {
      id: crypto.randomUUID(),
      exerciseName: info?.name ?? entry.exerciseName.trim(),
      ...(info ? { definitionId: info.definitionId, equipmentType: info.equipmentType } : {}),
      exerciseOrder: orders.get(key)!,
      setNumber,
      targetWeight: entry.weight,
      actualWeight: entry.weight,
      targetReps: entry.reps,
      actualReps: entry.reps,
      completed: true,
      timestamp,
      notes: null,
      isTimeBased: info?.isTimeBased ?? false,
      phase: "main",
    };
  });
}
