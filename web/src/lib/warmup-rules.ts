import type { ExerciseDefinition, UserEquipmentConfig } from "./types";
import { barWeight } from "./types";
import { findItem } from "./equipment-items";

// The user's warm-up rules (Settings → Warm-ups): one rule per equipment group, plus limits that
// apply to every warm-up. warmup-ramp.ts builds the sets from them.

export type WarmupGroup = "plates" | "powerblock" | "fixed" | "unloaded";
export type WarmupMode = "ramp" | "single" | "fewer" | "none";

export interface WarmupStep { pct: number; reps: number }

export interface WarmupGroupRule {
  mode: WarmupMode;
  steps: WarmupStep[];   // ramp: share of the work weight × reps, lightest first
  emptyBar: boolean;     // ramp: start with the empty bar or implement (plate-loaded only)
  emptyBarReps: number;
  singlePct: number;     // one lighter set: about this share of the work weight
  fewerPct: number;      // fewer reps (and the fallback when nothing lighter exists): share of the reps or time
}

export interface WarmupRules {
  groups: Record<WarmupGroup, WarmupGroupRule>;
  maxPct: number;          // no warm-up set above this share of the work weight
  restSeconds: number;     // rest after each warm-up set
  oncePerWorkout: boolean; // a lift that comes back later in the workout gets no second warm-up
}

const RAMP: WarmupStep[] = [{ pct: 40, reps: 5 }, { pct: 60, reps: 3 }, { pct: 80, reps: 2 }];
const rule = (mode: WarmupMode, emptyBar = false): WarmupGroupRule => ({
  mode, steps: RAMP.map((s) => ({ ...s })), emptyBar, emptyBarReps: 8, singlePct: 50, fewerPct: 50,
});

// What the app did before warm-ups were editable.
export const DEFAULT_WARMUP_RULES: WarmupRules = {
  groups: { plates: rule("ramp", true), powerblock: rule("ramp"), fixed: rule("single"), unloaded: rule("fewer") },
  maxPct: 85,
  restSeconds: 60,
  oncePerWorkout: true,
};

export const WARMUP_GROUPS: { key: WarmupGroup; title: string; covers: string; modes: WarmupMode[] }[] = [
  { key: "plates", title: "Barbells and plate-loaded", covers: "Olympic, 35 lb and EZ bars, landmine, and your plate-loaded items like a FitArc", modes: ["ramp", "single", "fewer", "none"] },
  { key: "powerblock", title: "PowerBlock", covers: "Adjustable dumbbells, in 2.5 lb steps", modes: ["ramp", "single", "fewer", "none"] },
  { key: "fixed", title: "Fixed weights", covers: "Fixed dumbbells, kettlebells, machine stacks, pulleys, and fixed-weight items like medicine balls", modes: ["ramp", "single", "fewer", "none"] },
  { key: "unloaded", title: "No load to lighten", covers: "Bodyweight, bands, grippers, pull-up assist, no-weight items, and timed exercises", modes: ["fewer", "none"] },
];

export const WARMUP_MODE_LABEL: Record<WarmupMode, string> = { ramp: "Ramp", single: "One lighter set", fewer: "Fewer reps", none: "None" };

const UNLOADED_TYPES = new Set(["bodyweight", "band", "loop_band", "gripper", "assisted_pullup"]);

export function warmupGroup(
  e: Pick<ExerciseDefinition, "equipmentType" | "equipmentItemId" | "isTimeBased"> & { currentWeight: number },
  config?: Pick<UserEquipmentConfig, "items">,
): WarmupGroup {
  if (e.isTimeBased || e.currentWeight <= 0) return "unloaded";
  const item = findItem(config, e.equipmentItemId);
  if (item) return item.kind === "plate_loaded" ? "plates" : item.kind === "fixed" ? "fixed" : "unloaded";
  if (barWeight(e.equipmentType) !== null) return "plates";
  if (e.equipmentType === "powerblock") return "powerblock";
  if (UNLOADED_TYPES.has(e.equipmentType)) return "unloaded";
  return "fixed";
}

const num = (v: unknown, fallback: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

// Saved rules may predate a field (or be absent): fill the gaps from the defaults and keep every
// number in a sane range, so a bad value can never build a warm-up over the work weight.
export function normalizeWarmupRules(saved: Partial<WarmupRules> | undefined | null): WarmupRules {
  const d = DEFAULT_WARMUP_RULES;
  const groups = {} as Record<WarmupGroup, WarmupGroupRule>;
  for (const { key, modes } of WARMUP_GROUPS) {
    const s = (saved?.groups?.[key] ?? {}) as Partial<WarmupGroupRule>;
    const g = d.groups[key];
    groups[key] = {
      mode: s.mode && modes.includes(s.mode) ? s.mode : g.mode,
      steps: Array.isArray(s.steps) ? s.steps.map((x) => ({ pct: num(x?.pct, 50, 5, 95), reps: Math.round(num(x?.reps, 5, 1, 30)) })) : g.steps.map((x) => ({ ...x })),
      emptyBar: typeof s.emptyBar === "boolean" ? s.emptyBar : g.emptyBar,
      emptyBarReps: Math.round(num(s.emptyBarReps, g.emptyBarReps, 1, 30)),
      singlePct: num(s.singlePct, g.singlePct, 5, 95),
      fewerPct: num(s.fewerPct, g.fewerPct, 10, 90),
    };
  }
  return {
    groups,
    maxPct: num(saved?.maxPct, d.maxPct, 50, 95),
    restSeconds: Math.round(num(saved?.restSeconds, d.restSeconds, 0, 600)),
    oncePerWorkout: typeof saved?.oncePerWorkout === "boolean" ? saved.oncePerWorkout : d.oncePerWorkout,
  };
}
