import type { Exercise, CompletedSet } from "./types";
import { barWeight } from "./types";
import { calculateBarbell, nearestPowerBlock } from "./equipment-calculator";
import { getLastSetsForExercise, getLastTwoSessionSets } from "./firestore";

export function getProgressionIncrement(exercise: Exercise): number {
  switch (exercise.progressionRule) {
    case "add_5lb": return 5;
    case "add_2.5lb": return 2.5;
    case "add_10lb": return 10;
    default: return 0;
  }
}

export function adjustForEquipment(target: number, exercise: Exercise): number {
  const bw = barWeight(exercise.equipmentType);
  if (bw !== null) {
    return calculateBarbell(target, bw).achievedWeight;
  }
  if (exercise.equipmentType === "powerblock") {
    return nearestPowerBlock(target);
  }
  return target;
}

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
    // Check if failed 2 sessions in a row — reduce weight
    const lastTwoSessions = await getLastTwoSessionSets(userId, exercise.name);
    if (lastTwoSessions.length === 2) {
      const bothFailed = lastTwoSessions.every(
        (sessionSets) => !checkAllSetsCompleted(sessionSets, exercise)
      );
      if (bothFailed) {
        const increment = getProgressionIncrement(exercise);
        if (increment > 0) {
          return adjustForEquipment(Math.max(0, lastWeight - increment), exercise);
        }
      }
    }
    return lastWeight; // Keep same weight
  }

  // Check if last set was rated "easy" — apply 2x progression
  const lastSet = lastSets[lastSets.length - 1];
  if (lastSet?.rating === "easy") {
    const increment = getProgressionIncrement(exercise);
    if (increment > 0) {
      return adjustForEquipment(lastWeight + increment * 2, exercise);
    }
  }

  // Check if any set was rated "hard" — keep same weight
  if (lastSets.some((s) => s.rating === "hard")) {
    return lastWeight;
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
  const increment = getProgressionIncrement(exercise);

  if (increment > 0) {
    return adjustForEquipment(currentWeight + increment, exercise);
  }

  const rule = exercise.progressionRule;
  switch (rule) {
    case "reduce_assistance": return Math.max(0, currentWeight - 10);
    default: return currentWeight;
  }
}
