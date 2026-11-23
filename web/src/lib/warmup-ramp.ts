import type { ResolvedExercise, UserEquipmentConfig } from "./types";
import { barWeight } from "./types";
import { roundDownToAchievable } from "./progression-service";

// Warm-ups: every exercise outside the warm-up phase gets at least one warm-up set, built from
// its CURRENT work weight so warm-ups follow progression instead of staying fixed. An exercise
// marked `skipWarmup`, or a lift already warmed up earlier in the workout, gets none.
//
// Where a warm-up comes from:
//   - the program has a warm-up row for the lift → that row is replaced (barbell/PowerBlock
//     ramp) or capped at the work weight (anything else), in the row's place
//   - otherwise one is generated and placed right before the exercise
//
// Safety rules (a warm-up must never hurt you):
//   - every loaded step is strictly below the work weight AND at most 85% of it
//   - weights round DOWN to something the equipment can load
//   - weights strictly increase; a step that duplicates or doesn't exceed the one before is dropped
//   - warm-up steps carry no progression and are never AMRAP, so they can't change a stored weight
//   - when there's no lighter load to use (work weight is about the bar, bodyweight, bands,
//     time-based, no weight set yet), the warm-up is one set at the same setup with about half
//     the reps or time
const MAX_FRACTION_OF_WORK = 0.85;
const RAMP: { fraction: number; reps: number }[] = [
  { fraction: 0.4, reps: 5 },
  { fraction: 0.6, reps: 3 },
  { fraction: 0.8, reps: 2 },
];
const EMPTY_BAR_REPS = 8;
const SINGLE_SET_FRACTION = 0.5;
const REST_BETWEEN_STEPS_SECONDS = 60;

// Equipment whose `currentWeight` isn't a load you can simply halve.
const UNLOADED: ReadonlySet<string> = new Set(["bodyweight", "band", "loop_band", "gripper", "assisted_pullup"]);

type Step = { weight: number; reps: number };

function isRampable(e: ResolvedExercise): boolean {
  return barWeight(e.equipmentType) !== null || e.equipmentType === "powerblock";
}

function halfReps(e: ResolvedExercise): number {
  return Math.max(1, Math.ceil(e.repMin / 2));
}

function rampSteps(e: ResolvedExercise, workWeight: number, config?: UserEquipmentConfig): Step[] {
  const bar = barWeight(e.equipmentType);
  const candidates = [
    ...(bar !== null ? [{ weight: bar, reps: EMPTY_BAR_REPS }] : []),
    ...RAMP.map(({ fraction, reps }) => ({ weight: roundDownToAchievable(workWeight * fraction, e, config), reps })),
  ];
  const steps: Step[] = [];
  for (const c of candidates) {
    const previous = steps.length > 0 ? steps[steps.length - 1].weight : 0;
    if (c.weight <= previous) continue;
    if (c.weight >= workWeight || c.weight > workWeight * MAX_FRACTION_OF_WORK + 1e-9) continue;
    steps.push(c);
  }
  return steps;
}

// One lighter set for loaded equipment the app can't ramp (dumbbell, kettlebell, machine, pulley).
function singleLoadedStep(work: ResolvedExercise): Step | null {
  const target = work.currentWeight * SINGLE_SET_FRACTION;
  const weight = work.equipmentType === "machine" && work.weightOptions?.length
    ? Math.max(0, ...work.weightOptions.filter((w) => w <= target))
    : Math.floor(target / 5) * 5;
  return weight > 0 && weight < work.currentWeight ? { weight, reps: work.repMin } : null;
}

function stepsFor(work: ResolvedExercise, config?: UserEquipmentConfig): Step[] {
  if (work.currentWeight > 0 && !work.isTimeBased && !UNLOADED.has(work.equipmentType)) {
    const steps = isRampable(work) ? rampSteps(work, work.currentWeight, config) : [singleLoadedStep(work)].filter((s): s is Step => s !== null);
    if (steps.length > 0) return steps;
  }
  return [{ weight: work.currentWeight, reps: halfReps(work) }];
}

function toWarmups(base: ResolvedExercise, steps: Step[], idPrefix: string, lastRestAfter: false | number | undefined): ResolvedExercise[] {
  return steps.map((step, i) => ({
    ...base,
    id: `${base.id}-${idPrefix}-${i + 1}`,
    phase: "warmup" as const,
    sets: 1,
    repMin: step.reps,
    repMax: { type: "count" as const, value: step.reps },
    currentWeight: step.weight,
    weight: undefined,
    progressionRule: "none",
    hardStreak: 0,
    lastSetAmrap: undefined,
    skipWarmup: undefined,
    restAfter: i < steps.length - 1 ? REST_BETWEEN_STEPS_SECONDS : lastRestAfter,
  }));
}

export function rampWarmups(exercises: ResolvedExercise[], config?: UserEquipmentConfig): ResolvedExercise[] {
  const workByLift = new Map<string, ResolvedExercise>();
  for (const e of exercises) {
    if (e.phase !== "warmup" && !workByLift.has(e.definitionId)) workByLift.set(e.definitionId, e);
  }
  // A lift with a warm-up row anywhere in the workout is already covered by that row.
  const warmedLifts = new Set(exercises.filter((e) => e.phase === "warmup").map((e) => e.definitionId));

  const rampedLifts = new Set<string>();
  const result: ResolvedExercise[] = [];
  for (const e of exercises) {
    if (e.phase !== "warmup") {
      if (!e.skipWarmup && !warmedLifts.has(e.definitionId)) {
        result.push(...toWarmups(e, stepsFor(e, config), "warmup", REST_BETWEEN_STEPS_SECONDS));
      }
      warmedLifts.add(e.definitionId);
      result.push(e);
      continue;
    }
    const work = workByLift.get(e.definitionId);
    if (!work || work.currentWeight <= 0) {
      result.push(e);
    } else if (isRampable(e)) {
      if (rampedLifts.has(e.definitionId)) continue; // folded into the lift's single ramp
      rampedLifts.add(e.definitionId);
      const steps = rampSteps(e, work.currentWeight, config);
      result.push(...toWarmups(e, steps.length > 0 ? steps : [{ weight: work.currentWeight, reps: halfReps(work) }], "ramp", e.restAfter));
    } else {
      result.push(e.currentWeight > work.currentWeight ? { ...e, currentWeight: work.currentWeight } : e);
    }
  }
  return result.map((e, i) => ({ ...e, order: i + 1 }));
}
