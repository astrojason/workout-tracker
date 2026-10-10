import type { ResolvedExercise, UserEquipmentConfig } from "./types";
import { barWeight } from "./types";
import { roundDownToAchievable } from "./progression-service";

// Warm-up ramp: replaces a lift's spreadsheet warm-up row(s) with lighter sets built from
// the CURRENT work weight, so warm-ups follow progression instead of staying fixed.
//
// Safety rules (a warm-up must never hurt you):
//   - every step is strictly below the work weight AND at most 85% of it
//   - weights round DOWN to something the equipment can load
//   - weights strictly increase; a step that duplicates or doesn't exceed the one before is dropped
//   - ramp steps carry no progression, so a warm-up can never change a stored weight
//   - if the work weight is about the bar (no useful ramp), the warm-up is dropped
//
// Only barbell and PowerBlock lifts are ramped (those are the ones whose weights this app can
// round down to something loadable). Any other warm-up that shares a lift with a work row
// stays as the sheet has it, but is capped at the work weight. A warm-up with no work row,
// or a work row with no weight yet, is left alone.
const MAX_FRACTION_OF_WORK = 0.85;
const RAMP: { fraction: number; reps: number }[] = [
  { fraction: 0.4, reps: 5 },
  { fraction: 0.6, reps: 3 },
  { fraction: 0.8, reps: 2 },
];
const EMPTY_BAR_REPS = 8;
const REST_BETWEEN_STEPS_SECONDS = 60;

function isRampable(e: ResolvedExercise): boolean {
  return barWeight(e.equipmentType) !== null || e.equipmentType === "powerblock";
}

function rampFor(warmup: ResolvedExercise, workWeight: number, config?: UserEquipmentConfig): ResolvedExercise[] {
  const bar = barWeight(warmup.equipmentType);
  const candidates = [
    ...(bar !== null ? [{ weight: bar, reps: EMPTY_BAR_REPS }] : []),
    ...RAMP.map(({ fraction, reps }) => ({ weight: roundDownToAchievable(workWeight * fraction, warmup, config), reps })),
  ];
  const steps: { weight: number; reps: number }[] = [];
  for (const c of candidates) {
    const previous = steps.length > 0 ? steps[steps.length - 1].weight : 0;
    if (c.weight <= previous) continue;
    if (c.weight >= workWeight || c.weight > workWeight * MAX_FRACTION_OF_WORK + 1e-9) continue;
    steps.push(c);
  }
  return steps.map((step, i) => ({
    ...warmup,
    id: `${warmup.id}-ramp-${i + 1}`,
    sets: 1,
    repMin: step.reps,
    repMax: { type: "count" as const, value: step.reps },
    currentWeight: step.weight,
    weight: undefined,
    progressionRule: "none",
    hardStreak: 0,
    lastSetAmrap: undefined,
    restAfter: i < steps.length - 1 ? REST_BETWEEN_STEPS_SECONDS : warmup.restAfter,
  }));
}

export function rampWarmups(exercises: ResolvedExercise[], config?: UserEquipmentConfig): ResolvedExercise[] {
  const workByLift = new Map<string, ResolvedExercise>();
  for (const e of exercises) {
    if (e.phase !== "warmup" && !workByLift.has(e.definitionId)) workByLift.set(e.definitionId, e);
  }

  const rampedLifts = new Set<string>();
  const result: ResolvedExercise[] = [];
  for (const e of exercises) {
    const work = e.phase === "warmup" ? workByLift.get(e.definitionId) : undefined;
    if (!work || work.currentWeight <= 0) {
      result.push(e);
    } else if (isRampable(e)) {
      if (rampedLifts.has(e.definitionId)) continue; // folded into the lift's single ramp
      rampedLifts.add(e.definitionId);
      result.push(...rampFor(e, work.currentWeight, config));
    } else {
      result.push(e.currentWeight > work.currentWeight ? { ...e, currentWeight: work.currentWeight } : e);
    }
  }
  return result.map((e, i) => ({ ...e, order: i + 1 }));
}
