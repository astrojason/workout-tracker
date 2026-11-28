import type { CompletedSet, ExerciseDefinition } from "./types";

// Adding a forgotten exercise to a session that's already saved: the form's text entries become
// CompletedSets placed after the session's last exercise. Saving it never changes program weights
// (see addExerciseToSession in firestore.ts).

export interface AddedSetEntry {
  weight: string; // blank = bodyweight; ignored for a timed exercise
  reps: string;   // reps, or seconds for a timed exercise
}

export interface AddedExercise {
  name: string;
  definition?: ExerciseDefinition; // set when the name matches an exercise in the library
  isTimeBased: boolean;
  sets: AddedSetEntry[];
}

const isWhole = (text: string) => /^\d+$/.test(text.trim()) && Number(text.trim()) > 0;

export function addedSetError(entry: AddedSetEntry, isTimeBased: boolean): string | null {
  if (!isTimeBased && entry.weight.trim() !== "") {
    const w = Number(entry.weight.trim());
    if (!Number.isFinite(w) || w < 0) return "Weight must be a number of 0 or more";
  }
  if (!isWhole(entry.reps)) return `${isTimeBased ? "Seconds" : "Reps"} must be a whole number above 0`;
  return null;
}

// Throws on a blank name, no sets or an invalid set, so nothing half-valid is ever saved.
export function buildAddedExercise(existing: CompletedSet[], added: AddedExercise, timestamp: Date): CompletedSet[] {
  const { definition, isTimeBased } = added;
  const name = definition?.name ?? added.name.trim();
  if (!name) throw new Error("Pick or type an exercise");
  if (added.sets.length === 0) throw new Error("Add at least one set");
  added.sets.forEach((entry, i) => {
    const error = addedSetError(entry, isTimeBased);
    if (error) throw new Error(`${name} set ${i + 1}: ${error}`);
  });

  const order = existing.reduce((max, s) => Math.max(max, s.exerciseOrder), 0) + 1;
  return added.sets.map((entry, i) => {
    const weight = isTimeBased || entry.weight.trim() === "" ? 0 : Number(entry.weight.trim());
    const reps = Number(entry.reps.trim());
    return {
      id: crypto.randomUUID(),
      exerciseName: name,
      ...(definition ? {
        definitionId: definition.id,
        equipmentType: definition.equipmentType,
        ...(definition.equipmentDetail ? { equipmentDetail: definition.equipmentDetail } : {}),
      } : {}),
      exerciseOrder: order,
      setNumber: i + 1,
      targetWeight: weight,
      actualWeight: weight,
      targetReps: reps,
      actualReps: reps,
      completed: true,
      timestamp,
      notes: null,
      isTimeBased,
      phase: "main",
    };
  });
}

export function findDefinitionByName(definitions: Record<string, ExerciseDefinition>, name: string): ExerciseDefinition | undefined {
  const key = name.trim().toLowerCase();
  return key ? Object.values(definitions).find((d) => d.name.trim().toLowerCase() === key) : undefined;
}
