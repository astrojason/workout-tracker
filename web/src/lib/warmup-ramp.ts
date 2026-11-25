import type { ResolvedExercise, UserEquipmentConfig } from "./types";
import { barWeight } from "./types";
import { roundDownToAchievable } from "./progression-service";
import { equipmentLoads } from "./progression-choices";
import { DEFAULT_EQUIPMENT_CONFIG } from "./equipment-calculator";
import { findItem } from "./equipment-items";
import { DEFAULT_WARMUP_RULES, warmupGroup, type WarmupGroupRule, type WarmupRules } from "./warmup-rules";

// Warm-ups: every exercise outside the warm-up phase gets warm-up sets built from its CURRENT work
// weight, so warm-ups follow progression instead of staying fixed. None for an exercise marked
// `skipWarmup` (one program day) or `warmup: "none"` (always), a group whose rule is None, or (with
// once-per-workout on) a lift already warmed up earlier in the workout.
//
// Where a warm-up comes from:
//   - the program has a warm-up row for the lift → that row is replaced by the ramp when the
//     lift's rule is a ramp, or else capped at the work weight, in the row's place
//   - otherwise one is generated and placed right before the exercise
//
// Safety rules (a warm-up must never hurt you):
//   - every loaded step is strictly below the work weight AND at most the rules' limit (85% by default)
//   - weights round DOWN to something the equipment can load
//   - weights strictly increase; a step that duplicates or doesn't exceed the one before is dropped
//   - warm-up steps carry no progression and are never AMRAP, so they can't change a stored weight
//   - when there's no lighter load to use (work weight is about the bar, bodyweight, bands,
//     time-based, no weight set yet), the warm-up is one set at the same setup with fewer reps
//     or time (the rule's share, half by default)
// Which sets, how heavy and how long to rest come from the user's warm-up rules (warmup-rules.ts):
// one rule per equipment group, plus the limit and rest shared by all. The defaults are what the
// app always did: a ramp for bars and the PowerBlock, one lighter set for fixed weights, and
// fewer reps where there's no load to lighten.

type Step = { weight: number; reps: number };

const isPlateLoaded = (e: ResolvedExercise, config?: UserEquipmentConfig) =>
  barWeight(e.equipmentType) !== null || findItem(config, e.equipmentItemId)?.kind === "plate_loaded";

// The empty bar or implement a ramp can start from.
function emptyWeight(e: ResolvedExercise, config?: UserEquipmentConfig): number | null {
  const item = findItem(config, e.equipmentItemId);
  if (item?.kind === "plate_loaded") return item.baseWeight ?? 0;
  return barWeight(e.equipmentType);
}

// The heaviest weight at or under `limit` that the equipment actually makes, or null.
function floorLoad(e: ResolvedExercise, limit: number, config?: UserEquipmentConfig): number | null {
  if (limit <= 0) return null;
  if (isPlateLoaded(e, config) || e.equipmentType === "powerblock") {
    const w = roundDownToAchievable(limit, e, config);
    return w > 0 && w <= limit + 1e-9 ? w : null;
  }
  const loads = equipmentLoads(e, config ?? DEFAULT_EQUIPMENT_CONFIG);
  if (!loads) {
    // Loaded, but no list of weights to choose from (a pulley): round down to 5 lb.
    const w = Math.floor(limit / 5) * 5;
    return w > 0 ? w : null;
  }
  return [...loads].reverse().find((l) => l > 0 && l <= limit + 1e-9) ?? null;
}

const fewerReps = (e: ResolvedExercise, pct: number) => Math.max(1, Math.ceil((e.repMin * pct) / 100));

function rampSteps(e: ResolvedExercise, workWeight: number, rule: WarmupGroupRule, rules: WarmupRules, config?: UserEquipmentConfig): Step[] {
  const empty = rule.emptyBar ? emptyWeight(e, config) : null;
  const candidates: Step[] = [
    ...(empty !== null ? [{ weight: empty, reps: rule.emptyBarReps }] : []),
    ...rule.steps.flatMap(({ pct, reps }) => {
      const weight = floorLoad(e, (workWeight * pct) / 100, config);
      return weight === null ? [] : [{ weight, reps }];
    }),
  ];
  const steps: Step[] = [];
  for (const c of candidates) {
    const previous = steps.length > 0 ? steps[steps.length - 1].weight : 0;
    if (c.weight <= previous) continue;
    if (c.weight >= workWeight || c.weight > (workWeight * rules.maxPct) / 100 + 1e-9) continue;
    steps.push(c);
  }
  return steps;
}

// One lighter set, always on a weight the equipment has: about the rule's share of the work
// weight, or failing that the heaviest you have under the limit. Null when nothing is lighter.
function singleStep(work: ResolvedExercise, rule: WarmupGroupRule, rules: WarmupRules, config?: UserEquipmentConfig): Step | null {
  const weight = floorLoad(work, (work.currentWeight * rule.singlePct) / 100, config)
    ?? floorLoad(work, (work.currentWeight * rules.maxPct) / 100, config);
  return weight !== null && weight < work.currentWeight ? { weight, reps: work.repMin } : null;
}

// The generated warm-up for one working exercise. With nothing lighter to use, it's the work
// weight for fewer reps (or time).
function stepsFor(work: ResolvedExercise, rules: WarmupRules, config?: UserEquipmentConfig): Step[] {
  const rule = rules.groups[warmupGroup(work, config)];
  if (rule.mode === "none") return [];
  const fallback = [{ weight: work.currentWeight, reps: fewerReps(work, rule.fewerPct) }];
  if (warmupGroup(work, config) === "unloaded" || rule.mode === "fewer") return fallback;
  const steps = rule.mode === "ramp"
    ? rampSteps(work, work.currentWeight, rule, rules, config)
    : [singleStep(work, rule, rules, config)].filter((s): s is Step => s !== null);
  return steps.length > 0 ? steps : fallback;
}

function toWarmups(base: ResolvedExercise, steps: Step[], idPrefix: string, restSeconds: number, lastRestAfter: false | number | undefined): ResolvedExercise[] {
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
    restAfter: i < steps.length - 1 ? restSeconds : lastRestAfter,
  }));
}

export function rampWarmups(exercises: ResolvedExercise[], config?: UserEquipmentConfig, rules: WarmupRules = DEFAULT_WARMUP_RULES): ResolvedExercise[] {
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
      if (!e.skipWarmup && e.warmup !== "none" && !warmedLifts.has(e.definitionId)) {
        result.push(...toWarmups(e, stepsFor(e, rules, config), "warmup", rules.restSeconds, rules.restSeconds));
      }
      // Once per workout: a lift that comes back later gets no second warm-up.
      if (rules.oncePerWorkout) warmedLifts.add(e.definitionId);
      result.push(e);
      continue;
    }
    // A program's own warm-up row: replaced by the ramp when the lift's rule is a ramp, otherwise
    // kept (capped at the work weight).
    const work = workByLift.get(e.definitionId);
    const rule = work ? rules.groups[warmupGroup(work, config)] : null;
    if (!work || work.currentWeight <= 0 || !rule) {
      result.push(e);
    } else if (rule.mode === "ramp" && warmupGroup(work, config) !== "unloaded") {
      if (rampedLifts.has(e.definitionId)) continue; // folded into the lift's single ramp
      rampedLifts.add(e.definitionId);
      const steps = rampSteps(e, work.currentWeight, rule, rules, config);
      result.push(...toWarmups(e, steps.length > 0 ? steps : [{ weight: work.currentWeight, reps: fewerReps(work, rule.fewerPct) }], "ramp", rules.restSeconds, e.restAfter));
    } else {
      result.push(e.currentWeight > work.currentWeight ? { ...e, currentWeight: work.currentWeight } : e);
    }
  }
  return result.map((e, i) => ({ ...e, order: i + 1 }));
}
