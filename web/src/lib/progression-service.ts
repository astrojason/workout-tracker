import type { ResolvedExercise, CompletedSet, UserEquipmentConfig } from "./types";
import { barWeight, WEIGHT_INCREMENTS } from "./types";
import { calculateBarbell, calculateLandmine, nearestPowerBlock } from "./equipment-calculator";

// Snaps a computed weight down to the nearest achievable equipment value.
// Barbell/landmine already floor by construction (calculateBarbell/calculateLandmine
// search downward for an exact plate match). PowerBlock needs the explicit roundDown
// flag since its default behavior rounds to nearest. Equipment types with no snap
// function (dumbbell, kettlebell, band, bodyweight, gripper, assisted_pullup) pass through.
function roundDownToAchievable(weight: number, exercise: ResolvedExercise, config?: UserEquipmentConfig): number {
  if (weight <= 0) return 0;
  const bw = barWeight(exercise.equipmentType);
  if (bw !== null) {
    const name = exercise.name.toLowerCase();
    const isLandmine = name.includes("landmine") || name.includes("meadows");
    return isLandmine
      ? calculateLandmine(weight, bw, config).achievedWeight
      : calculateBarbell(weight, bw, config).achievedWeight;
  }
  if (exercise.equipmentType === "powerblock") {
    return nearestPowerBlock(weight, config, true);
  }
  return weight;
}

export interface ProgressionResult {
  currentWeight: number;
  hardStreak: number;
}

// Runs once, at workout completion, against the last completed set logged for one
// exercise occurrence. Only numeric weight-increment progression rules (add_5lb,
// add_2.5lb, add_10lb) are auto-progressed here; band/rep/time-based rules are
// left untouched (no numeric weight to move).
//
// Driven by what was achieved, not by the easy/normal/hard rating:
//   completed final set → Epley 1RM from the actual weight and reps
//     (estimated1RM = actualWeight * (1 + actualReps/30)), then the standard percentage
//     of it for the target reps (30 / (30 + reps)). AMRAP sets target the planned reps;
//     other sets target repMin, so extra reps earn a bump and the weight never drops.
//   skipped/failed final set → weight holds, hardStreak++; the 3rd consecutive miss
//     drops it by 1x increment and resets the streak.
export function computeNextWeight(
  exercise: ResolvedExercise,
  finalSet: CompletedSet,
  config?: UserEquipmentConfig
): ProgressionResult {
  const increment = WEIGHT_INCREMENTS[exercise.progressionRule];
  if (!increment) {
    return { currentWeight: exercise.currentWeight, hardStreak: exercise.hardStreak };
  }

  const isAmrapFinalSet =
    exercise.repMax.type === "failure" ||
    (exercise.lastSetAmrap === true && finalSet.setNumber === exercise.sets);

  if (finalSet.completed) {
    const estimated1RM = finalSet.actualWeight * (1 + finalSet.actualReps / 30);
    // AMRAP targets the planned reps; other sets target the bottom of the rep range, so
    // reps beyond repMin earn a bump and hitting repMin exactly holds the weight.
    const targetReps = isAmrapFinalSet ? (finalSet.targetReps || exercise.repMin) : exercise.repMin;
    const rawNext = estimated1RM * (30 / (30 + targetReps));
    // Falling short of repMin on a non-AMRAP set is not a reason to drop the weight.
    const next = isAmrapFinalSet ? rawNext : Math.max(rawNext, exercise.currentWeight);
    return { currentWeight: roundDownToAchievable(next, exercise, config), hardStreak: 0 };
  }

  // Skipped/failed final set: nothing was achieved, so it can't earn a bump. The weight
  // holds; the 3rd consecutive miss drops it by 1x increment.
  const hardStreak = exercise.hardStreak + 1;
  if (hardStreak >= 3) {
    return { currentWeight: roundDownToAchievable(exercise.currentWeight - increment, exercise, config), hardStreak: 0 };
  }
  return { currentWeight: exercise.currentWeight, hardStreak };
}

// Live, same-session bump: called right after a set is rated "easy" (and more sets
// remain for this exercise) so the very next set loads heavier immediately. This is
// session-local UI convenience only — it does not touch the persisted definition;
// computeNextWeight's end-of-session write-back is the source of truth going forward.
export function liveEasyBump(currentWeight: number, exercise: ResolvedExercise): number {
  const increment = WEIGHT_INCREMENTS[exercise.progressionRule];
  if (!increment) return currentWeight;
  return currentWeight + increment;
}
