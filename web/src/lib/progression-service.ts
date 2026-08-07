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
// State machine (final set NOT AMRAP):
//   normal → +1x increment, hardStreak resets to 0
//   easy   → +2x increment (it's the final set), hardStreak resets to 0
//   hard   → hardStreak++; on the 3rd consecutive hard, -1x increment and reset to 0;
//            otherwise weight holds
//   skipped/failed → treated the same as "hard" (no rating to read, and the set
//     wasn't actually completed at target, so it can't count as a success signal)
//
// AMRAP final set (lastSetAmrap or repMax.type === "failure"): the set's easy/normal/hard
// rating is ignored — AMRAP is inherently supposed to feel hard. Instead, projects a 1RM
// via Epley (estimated1RM = actualWeight * (1 + actualReps/30)) from the AMRAP performance,
// then targets the standard percentage of that 1RM for the set's target rep count — the
// Epley formula's own inverse (30 / (30 + reps)), reusing the same formula already used
// for 1RM PRs elsewhere rather than maintaining a separate %1RM table.
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

  if (finalSet.completed && isAmrapFinalSet) {
    const estimated1RM = finalSet.actualWeight * (1 + finalSet.actualReps / 30);
    const targetReps = finalSet.targetReps || exercise.repMin;
    const rawNext = estimated1RM * (30 / (30 + targetReps));
    return { currentWeight: roundDownToAchievable(rawNext, exercise, config), hardStreak: 0 };
  }

  // Skipped/failed final set: no valid rating to read, and it wasn't actually
  // completed at target — treat the same as a "hard" outcome.
  const rating = finalSet.completed ? finalSet.rating : "hard";

  if (rating === "easy") {
    return { currentWeight: roundDownToAchievable(exercise.currentWeight + increment * 2, exercise, config), hardStreak: 0 };
  }

  if (rating === "hard") {
    const hardStreak = exercise.hardStreak + 1;
    if (hardStreak >= 3) {
      return { currentWeight: roundDownToAchievable(exercise.currentWeight - increment, exercise, config), hardStreak: 0 };
    }
    return { currentWeight: exercise.currentWeight, hardStreak };
  }

  // "normal" (or unrated, treated as normal)
  return { currentWeight: roundDownToAchievable(exercise.currentWeight + increment, exercise, config), hardStreak: 0 };
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
