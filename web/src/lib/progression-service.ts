import type { Exercise, CompletedSet } from "./types";
import { barWeight } from "./types";
import { calculateBarbell, nearestPowerBlock } from "./equipment-calculator";
import { getLastSetsForExercise } from "./firestore";

export async function resolveWeight(
  userId: string,
  exercise: Exercise
): Promise<number> {
  if (exercise.baseWeight.type === "fixed") {
    return exercise.baseWeight.value;
  }

  // Progressive: look up history
  const lastSets = await getLastSetsForExercise(userId, exercise.name);

  if (lastSets.length === 0) {
    return 0; // No history - will prompt for initial weight
  }

  const lastWeight = lastSets[0]?.actualWeight ?? 0;
  const allCompleted = checkAllSetsCompleted(lastSets, exercise);

  if (!allCompleted) {
    return lastWeight; // Keep same weight
  }

  return applyProgression(lastWeight, exercise);
}

function checkAllSetsCompleted(sets: CompletedSet[], exercise: Exercise): boolean {
  for (const set of sets) {
    if (!set.completed) return false;
    if (set.actualReps < exercise.repMin) return false;
  }
  return true;
}

export function applyProgression(currentWeight: number, exercise: Exercise): number {
  const rule = exercise.progressionRule;

  let increment: number | null = null;
  switch (rule) {
    case "add_5lb": increment = 5; break;
    case "add_2.5lb": increment = 2.5; break;
    case "add_10lb": increment = 10; break;
    case "reduce_assistance": return Math.max(0, currentWeight - 10);
    case "maintain":
    case "none":
    case "deload":
    case "add_reps":
    case "add_time":
    case "progress_gripper":
      return currentWeight;
  }

  if (increment === null) return currentWeight;

  const newWeight = currentWeight + increment;
  return adjustForEquipment(newWeight, exercise);
}

function adjustForEquipment(target: number, exercise: Exercise): number {
  const bw = barWeight(exercise.equipmentType);
  if (bw !== null) {
    return calculateBarbell(target, bw).achievedWeight;
  }
  if (exercise.equipmentType === "powerblock") {
    return nearestPowerBlock(target);
  }
  return target;
}
