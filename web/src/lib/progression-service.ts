import type { Exercise } from "./types";
import { barWeight } from "./types";
import { calculateBarbell, calculateLandmine, nearestPowerBlock } from "./equipment-calculator";

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

export interface WeightResolution {
  weight: number;
  prevWeight: number | null;
}

export function resolveWeightWithMeta(
  _userId: string,
  exercise: Exercise
): Promise<WeightResolution> {
  const weight = exercise.baseWeight.type === "fixed"
    ? exercise.baseWeight.value
    : (exercise.totalWeight ?? 0);
  return Promise.resolve({ weight, prevWeight: null });
}

export async function resolveWeight(
  userId: string,
  exercise: Exercise
): Promise<number> {
  const { weight } = await resolveWeightWithMeta(userId, exercise);
  return weight;
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
