import type { Exercise, UserEquipmentConfig } from "./types";
import { barWeight } from "./types";
import { calculateBarbell, calculateLandmine, nearestPowerBlock } from "./equipment-calculator";
import { getLastSetsForExercise } from "./firestore";

function getProgressionIncrement(exercise: Exercise): number {
  switch (exercise.progressionRule as string) {
    case "add_5lb": return 5;
    case "add_2.5lb": return 2.5;
    case "add_10lb": return 10;
    default: return 0;
  }
}

function adjustForEquipment(target: number, exercise: Exercise, config?: UserEquipmentConfig): number {
  const bw = barWeight(exercise.equipmentType);
  if (bw !== null) {
    const name = exercise.name.toLowerCase();
    const isLandmine = name.includes("landmine") || name.includes("meadows");
    return isLandmine
      ? calculateLandmine(target, bw, config).achievedWeight
      : calculateBarbell(target, bw, config).achievedWeight;
  }
  if (exercise.equipmentType === "powerblock") {
    return nearestPowerBlock(target, config);
  }
  return target;
}

export interface WeightResolution {
  weight: number;
  prevWeight: number | null;
}

export async function resolveWeightWithMeta(
  userId: string,
  exercise: Exercise,
  config?: UserEquipmentConfig
): Promise<WeightResolution> {
  if (exercise.baseWeight.type === "fixed") {
    return { weight: exercise.baseWeight.value, prevWeight: null };
  }

  const lastSets = await getLastSetsForExercise(userId, exercise.name);
  if (!lastSets || lastSets.length === 0) {
    return { weight: exercise.totalWeight ?? 0, prevWeight: null };
  }

  const prevWeight = lastSets[0].actualWeight;
  const allCompleted = lastSets.every(
    (s) => s.completed && s.actualReps >= exercise.repMin
  );

  if (allCompleted) {
    return { weight: applyProgression(prevWeight, exercise, config), prevWeight };
  }
  return { weight: prevWeight, prevWeight };
}

export async function resolveWeight(
  userId: string,
  exercise: Exercise,
  config?: UserEquipmentConfig
): Promise<number> {
  const { weight } = await resolveWeightWithMeta(userId, exercise, config);
  return weight;
}

export function applyProgression(currentWeight: number, exercise: Exercise, config?: UserEquipmentConfig): number {
  const increment = getProgressionIncrement(exercise);

  if (increment > 0) {
    return adjustForEquipment(currentWeight + increment, exercise, config);
  }

  // Free-form rules (band color, band count, etc.) and all non-increment keywords
  // return the current weight unchanged — the UI handles band progression display
  return currentWeight;
}
