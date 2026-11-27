import type { ExerciseDefinition, ResolvedExercise, UserEquipmentConfig } from "./types";
import { barWeight } from "./types";
import { roundDownToAchievable } from "./progression-service";
import { equipmentLoads } from "./progression-choices";
import { DEFAULT_EQUIPMENT_CONFIG } from "./equipment-calculator";
import { findItem } from "./equipment-items";
import { DEFAULT_WARMUP_RULES, warmupGroup, type WarmupGroupRule, type WarmupRules } from "./warmup-rules";
import { activeStretchFor, canBeSubstituted, estimatedLoad, musclesOf } from "./exercise-profile";

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
//   - when there's no lighter load to use (nothing you own is light enough, bodyweight, bands,
//     time-based, no weight set yet), the warm-up is a lighter MOVEMENT for the same muscles: one
//     set of another library exercise that works the lift's biggest muscle and moves clearly less
//     than the lift (external weight plus the share of bodyweight, see
//     exercise-profile.ts). Nothing fits → no warm-up, and the lift carries an active-stretch tip.
//     The rule's "Fewer reps" keeps the old same-setup, fewer-reps set instead.
//   - a movement chosen on the program day or in the library (`warmupWith`) wins over the pick
// Which sets, how heavy and how long to rest come from the user's warm-up rules (warmup-rules.ts):
// one rule per equipment group, plus the limit and rest shared by all. The defaults: a ramp for
// bars and the PowerBlock, one lighter set for fixed weights, and a lighter movement where
// there's no load to lighten. Every warm-up rests the warm-up rest.

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

// The generated warm-up for one working exercise. `lighter` is false when there's nothing lighter
// to use: the caller then looks for a lighter movement (substitute), or, with the rule on "Fewer
// reps", uses the work weight for fewer reps (or time).
function stepsFor(work: ResolvedExercise, rules: WarmupRules, config?: UserEquipmentConfig): { steps: Step[]; lighter: boolean } {
  const rule = rules.groups[warmupGroup(work, config)];
  if (rule.mode === "none") return { steps: [], lighter: true };
  const fallback = [{ weight: work.currentWeight, reps: fewerReps(work, rule.fewerPct) }];
  if (rule.mode === "fewer") return { steps: fallback, lighter: true };
  if (rule.mode === "substitute" || warmupGroup(work, config) === "unloaded") return { steps: fallback, lighter: false };
  const steps = rule.mode === "ramp"
    ? rampSteps(work, work.currentWeight, rule, rules, config)
    : [singleStep(work, rule, rules, config)].filter((s): s is Step => s !== null);
  return steps.length > 0 ? { steps, lighter: true } : { steps: fallback, lighter: false };
}

const SUBSTITUTE_MAX = 0.95;

export interface WarmupContext {
  library?: Record<string, ExerciseDefinition>; // the exercises a substitute can come from (program-scoped weights)
  bodyweight?: number | null;                    // latest weigh-in, lb
}

// A lighter movement standing in as the warm-up for `work`: one set of the work's reps (or time).
function substituteWarmup(work: ResolvedExercise, def: ExerciseDefinition, rules: WarmupRules, index: number): ResolvedExercise {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = def;
  return {
    ...rest,
    id: `${work.id}-sub-${index + 1}`,
    definitionId: def.id,
    order: work.order,
    phase: "warmup",
    sets: 1,
    repMin: work.repMin,
    repMax: { type: "count", value: work.repMin },
    restSeconds: rules.restSeconds,
    restAfter: rules.restSeconds,
    notes: `Warm-up for ${work.name}`,
    progressionRule: "none",
    hardStreak: 0,
    lastSetAmrap: undefined,
    skipWarmup: undefined,
    warmupWith: undefined,
  };
}

// Lighter movements for the same muscles, best first: each works the lift's biggest muscle, moves
// clearly less than the lift does (under 95%: the loaded-warm-up limit is for the same movement,
// and a bodyweight squat before a light goblet squat is already most of the load), and has a load
// the app can work out. More muscles in common ranks higher; then the one closest to the lift.
export function substituteCandidates(work: ResolvedExercise, ctx: WarmupContext, config?: UserEquipmentConfig): ExerciseDefinition[] {
  if (!ctx.library || !canBeSubstituted(work)) return [];
  const muscles = musclesOf(work);
  const workLoad = estimatedLoad(work, ctx.bodyweight, config);
  if (muscles.length === 0 || workLoad === null || workLoad <= 0) return [];
  const limit = workLoad * SUBSTITUTE_MAX;
  return Object.values(ctx.library)
    .flatMap((d) => {
      if (d.id === work.definitionId || d.isTimeBased !== work.isTimeBased || !canBeSubstituted(d)) return [];
      const theirs = musclesOf(d);
      if (!theirs.includes(muscles[0])) return [];
      const load = estimatedLoad(d, ctx.bodyweight, config);
      if (load === null || load <= 0 || load > limit + 1e-9) return [];
      return [{ d, overlap: muscles.filter((m) => theirs.includes(m)).length, load }];
    })
    .sort((a, b) => b.overlap - a.overlap || b.load - a.load || a.d.name.localeCompare(b.d.name))
    .map((c) => c.d);
}

// The warm-up for a lift with no lighter load: the chosen movement (the program day's, else the
// library's), else the best lighter movement, each offering the others as swaps. Empty when
// nothing fits; the lift then carries an active-stretch tip instead.
function substituteFor(work: ResolvedExercise, rules: WarmupRules, ctx: WarmupContext, config?: UserEquipmentConfig): ResolvedExercise[] {
  const chosen = work.warmupWith ? ctx.library?.[work.warmupWith] : undefined;
  const auto = substituteCandidates(work, ctx, config);
  const picks = chosen ? [chosen, ...auto.filter((d) => d.id !== chosen.id)] : auto;
  if (picks.length === 0) return [];
  const options = picks.slice(0, 5).map((d, i) => substituteWarmup(work, d, rules, i));
  return [{ ...options[0], warmupOptions: options }];
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

export function rampWarmups(exercises: ResolvedExercise[], config?: UserEquipmentConfig, rules: WarmupRules = DEFAULT_WARMUP_RULES, ctx: WarmupContext = {}): ResolvedExercise[] {
  const workByLift = new Map<string, ResolvedExercise>();
  for (const e of exercises) {
    if (e.phase !== "warmup" && !workByLift.has(e.definitionId)) workByLift.set(e.definitionId, e);
  }
  // A lift with a warm-up row anywhere in the workout is already covered by that row.
  const warmedLifts = new Set(exercises.filter((e) => e.phase === "warmup").map((e) => e.definitionId));

  const rampedLifts = new Set<string>();
  const standalone = new Set<ResolvedExercise>();
  const result: ResolvedExercise[] = [];
  for (const e of exercises) {
    if (e.phase !== "warmup") {
      let lift = e;
      if (!e.skipWarmup && e.warmup !== "none" && !warmedLifts.has(e.definitionId)) {
        const chosen = e.warmupWith ? ctx.library?.[e.warmupWith] : undefined;
        const { steps, lighter } = stepsFor(e, rules, config);
        if (chosen || (!lighter && steps.length > 0)) {
          const sub = substituteFor(e, rules, ctx, config);
          if (sub.length > 0) result.push(...sub);
          else lift = { ...e, warmupTip: activeStretchFor(musclesOf(e)) };
        } else {
          result.push(...toWarmups(e, steps, "warmup", rules.restSeconds, rules.restSeconds));
        }
      }
      // Once per workout: a lift that comes back later gets no second warm-up.
      if (rules.oncePerWorkout) warmedLifts.add(e.definitionId);
      result.push(lift);
      continue;
    }
    // A program's own warm-up row: replaced by the ramp when the lift's rule is a ramp, otherwise
    // kept (capped at the work weight).
    const work = workByLift.get(e.definitionId);
    const rule = work ? rules.groups[warmupGroup(work, config)] : null;
    if (!work || work.currentWeight <= 0 || !rule) {
      standalone.add(e); // a warm-up exercise of its own (band pull-aparts), not a lift's warm-up
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
  // Every lift's warm-up rests the warm-up rest, between its own sets and before what follows,
  // whatever rest the program row or the work lift it came from carries. A program row that set
  // its own rest after (a number, or FALSE to flow straight on) keeps that choice. A warm-up
  // exercise of its own keeps the program's rests.
  return result.map((e, i) => ({
    ...e,
    order: i + 1,
    ...(e.phase === "warmup" && !standalone.has(e) ? { restSeconds: rules.restSeconds, restAfter: e.restAfter ?? rules.restSeconds } : {}),
    ...(e.warmupOptions ? { warmupOptions: e.warmupOptions.map((o) => ({ ...o, order: i + 1 })) } : {}),
  }));
}
