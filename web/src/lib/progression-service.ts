import type { Exercise, CompletedSet } from "./types";
import { barWeight } from "./types";
import { calculateBarbell, calculateLandmine, nearestPowerBlock } from "./equipment-calculator";
import { getLastSetsForExercise, getLastTwoSessionSets } from "./firestore";

export function getProgressionIncrement(exercise: Exercise): number {
  switch (exercise.progressionRule as string) {
    case "add_5lb": return 5;
    case "add_2.5lb": return 2.5;
    case "add_10lb": return 10;
    default: return 0;
  }
}

export function adjustForEquipment(target: number, exercise: Exercise): number {
  const bw = barWeight(exercise.equipmentType);
  if (bw !== null) {
    const isLandmine = exercise.name.toLowerCase().includes("landmine");
    return isLandmine
      ? calculateLandmine(target, bw).achievedWeight
      : calculateBarbell(target, bw).achievedWeight;
  }
  if (exercise.equipmentType === "powerblock") {
    return nearestPowerBlock(target);
  }
  return target;
}

export type WeightReason =
  | "no_history"
  | "reduced_2x_miss"
  | "kept_same_miss"
  | "easy_bump"
  | "kept_same_hard"
  | "normal_progression"
  | "no_increment";

export interface WeightResolution {
  weight: number;
  /** Weight used in the most recent session (null for fixed/no-history). */
  prevWeight: number | null;
  reason: WeightReason;
}

export async function resolveWeightWithMeta(
  userId: string,
  exercise: Exercise
): Promise<WeightResolution> {
  const seedWeight = exercise.baseWeight.type === "fixed"
    ? exercise.baseWeight.value
    : (exercise.totalWeight ?? 0);

  const lastSets = await getLastSetsForExercise(userId, exercise.name);

  if (lastSets.length === 0) {
    return { weight: seedWeight, prevWeight: null, reason: "no_history" };
  }

  // Use the heaviest completed set's weight as the working weight.
  // When the same exercise name appears in multiple phases (e.g. Landmine Press
  // in warmup AND main), getLastSetsForExercise returns all of them. Taking the
  // max avoids treating a warmup weight as the working weight.
  const completedSets = lastSets.filter((s) => s.completed && s.actualWeight > 0);
  const lastWeight = completedSets.length > 0
    ? Math.max(...completedSets.map((s) => s.actualWeight))
    : (lastSets[0]?.actualWeight ?? 0);

  // Only evaluate progression criteria against sets at the working weight.
  const workingSets = lastSets.filter((s) => s.actualWeight === lastWeight);
  const allCompleted = checkAllSetsCompleted(workingSets, exercise);

  if (!allCompleted) {
    const lastTwoSessions = await getLastTwoSessionSets(userId, exercise.name);
    if (lastTwoSessions.length === 2) {
      const bothFailed = lastTwoSessions.every((sessionSets) => {
        const maxWt = sessionSets.filter((s) => s.completed && s.actualWeight > 0)
          .reduce((m, s) => Math.max(m, s.actualWeight), 0);
        const working = sessionSets.filter((s) => s.actualWeight === maxWt);
        return !checkAllSetsCompleted(working, exercise);
      });
      if (bothFailed) {
        const increment = getProgressionIncrement(exercise);
        if (increment > 0) {
          const reduced = adjustForEquipment(Math.max(0, lastWeight - increment), exercise);
          return { weight: reduced, prevWeight: lastWeight, reason: "reduced_2x_miss" };
        }
      }
    }
    return { weight: lastWeight, prevWeight: lastWeight, reason: "kept_same_miss" };
  }

  const lastSet = workingSets[workingSets.length - 1];
  const lastRating = lastSet?.rating;

  if (lastRating === "easy") {
    const increment = getProgressionIncrement(exercise);
    if (increment > 0) {
      return { weight: adjustForEquipment(lastWeight + increment * 2, exercise), prevWeight: lastWeight, reason: "easy_bump" };
    }
  }

  if (lastRating === "hard") {
    return { weight: lastWeight, prevWeight: lastWeight, reason: "kept_same_hard" };
  }

  // normal (or no rating) → 1x increment
  const progressed = applyProgression(lastWeight, exercise);
  if (progressed !== lastWeight) {
    return { weight: progressed, prevWeight: lastWeight, reason: "normal_progression" };
  }
  return { weight: lastWeight, prevWeight: lastWeight, reason: "no_increment" };
}

export async function resolveWeight(
  userId: string,
  exercise: Exercise
): Promise<number> {
  const { weight } = await resolveWeightWithMeta(userId, exercise);
  return weight;
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

  // Free-form rules (band color, band count, etc.) and all non-increment keywords
  // return the current weight unchanged — the UI handles band progression display
  return currentWeight;
}
