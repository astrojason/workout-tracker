import type {
  CompletedSet, EquipmentType, ExerciseDefinition, ResolvedExercise, UserEquipmentConfig, WorkoutSessionDoc,
} from "@/lib/types";
import { computeNextWeight } from "@/lib/progression-service";

// One set as entered in the custom workout builder.
export interface CustomSetEntry {
  exerciseName: string;
  weight: number;
  reps: number; // seconds when isTimeBased
  rating?: "easy" | "normal" | "hard"; // how the set felt; defaults to normal
  isTimeBased?: boolean; // set by the builder's Reps/Time toggle; falls back to the library exercise's setting
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
      rating: entry.rating ?? "normal",
      isTimeBased: entry.isTimeBased ?? info?.isTimeBased ?? false,
      phase: "main",
    };
  });
}

export interface WeightSuggestion {
  weight: number;
  lastWeight: number;
  lastReps: number;
  daysAgo: number;
}

function sessionMs(session: WorkoutSessionDoc): number {
  return session.date instanceof Date ? session.date.getTime() : session.date.toDate().getTime();
}

// Suggests a starting weight for a custom set: the weight from the last session that included
// this exercise (any program, or custom), moved by the same rating/time-away progression a
// program workout would apply. Null when there's nothing to base it on (no history, bodyweight, timed).
export function suggestCustomWeight(
  definition: ExerciseDefinition,
  sessions: WorkoutSessionDoc[],
  config: UserEquipmentConfig | undefined,
  now: Date,
): WeightSuggestion | null {
  if (definition.isTimeBased) return null;
  const matches = (set: CompletedSet) =>
    set.completed && set.phase !== "warmup" &&
    (set.definitionId ? set.definitionId === definition.id : exerciseKey(set.exerciseName) === exerciseKey(definition.name));

  const newestFirst = [...sessions].sort((a, b) => sessionMs(b) - sessionMs(a));
  for (const session of newestFirst) {
    const sets = (session.sets ?? []).filter(matches);
    if (sets.length === 0) continue;
    // Last logged set wins on a tie, matching how a workout's final set is picked.
    const finalSet = sets.reduce((a, b) => (b.setNumber >= a.setNumber ? b : a));
    if (finalSet.actualWeight <= 0) return null;

    const daysAgo = Math.max(0, Math.floor((now.getTime() - sessionMs(session)) / 86_400_000));
    const asExercise = {
      ...definition,
      id: definition.id, definitionId: definition.id, order: 1, phase: "main",
      sets: finalSet.setNumber, repMin: finalSet.targetReps || finalSet.actualReps,
      repMax: { type: "count", value: Math.max(finalSet.targetReps, finalSet.actualReps) },
      restSeconds: 0, notes: null,
      currentWeight: finalSet.actualWeight,
    } as ResolvedExercise;
    const next = computeNextWeight(asExercise, finalSet, config, daysAgo);
    return { weight: next.currentWeight, lastWeight: finalSet.actualWeight, lastReps: finalSet.actualReps, daysAgo };
  }
  return null;
}
