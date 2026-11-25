import type { EquipmentType, ExerciseDefinition, ProgressionRule, UserEquipmentConfig } from "./types";
import { barWeight, cleanWeight } from "./types";
import { findItem, plateLoads } from "./equipment-items";
import { KETTLEBELL_WEIGHTS, powerBlockWeights } from "./equipment-calculator";

// What an exercise's equipment can load, and the progression rules that fit it. Shared by the
// exercise editors (which rules to offer), progression (how far a step goes) and warm-ups (which
// lighter weights exist).

export type ExerciseEquipment = Pick<ExerciseDefinition, "name" | "equipmentType" | "equipmentItemId" | "weightOptions">;

const EPS = 0.001;
// Steps bigger than this aren't offered as "add N lb" rules (a pair of 45s is not a progression).
const MAX_STEP = 20;

// Any "add_<n>lb" rule's increment, e.g. add_0.5lb → 0.5. Null for rules that don't add weight.
export function weightIncrement(rule: ProgressionRule): number | null {
  const m = /^add_(\d+(?:\.\d+)?)lb$/.exec(rule);
  return m ? Number(m[1]) : null;
}

// Landmine and Meadows rows load one side of a barbell (as the plate calculator already assumes).
function isOneSidedBar(ex: ExerciseEquipment): boolean {
  const name = ex.name.toLowerCase();
  return name.includes("landmine") || name.includes("meadows");
}

// Plate-loaded equipment: the bar or item's empty weight and how many sides take plates.
function plateSetup(ex: ExerciseEquipment, config: UserEquipmentConfig): { base: number; sides: 1 | 2 } | null {
  const item = findItem(config, ex.equipmentItemId);
  if (item) return item.kind === "plate_loaded" ? { base: item.baseWeight ?? 0, sides: item.sides ?? 1 } : null;
  const bar = barWeight(ex.equipmentType);
  return bar === null ? null : { base: bar, sides: isOneSidedBar(ex) ? 1 : 2 };
}

const powerBlockLoads = (config: UserEquipmentConfig): number[] => (config.powerBlock.owned ? powerBlockWeights(config) : []);

const sorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

// Every weight the exercise's equipment can be set to, ascending. Null when it has no load to
// step through (bodyweight, bands, grippers, pull-up assist, a no-weight item).
export function equipmentLoads(ex: ExerciseEquipment, config: UserEquipmentConfig): number[] | null {
  const item = findItem(config, ex.equipmentItemId);
  if (item?.kind === "fixed") return sorted(item.weights ?? []);
  if (item?.kind === "none") return null;
  const plates = plateSetup(ex, config);
  if (plates) return plateLoads(plates.base, plates.sides, config);
  switch (ex.equipmentType) {
    case "powerblock":
    case "dumbbell": return sorted([...powerBlockLoads(config), ...config.fixedDumbbells]);
    case "kettlebell": return sorted(config.kettlebells.length > 0 ? config.kettlebells : KETTLEBELL_WEIGHTS);
    case "machine": return ex.weightOptions && ex.weightOptions.length > 0 ? sorted(ex.weightOptions) : null;
    default: return null;
  }
}

export function nextLoad(ex: ExerciseEquipment, current: number, config: UserEquipmentConfig): number | null {
  return equipmentLoads(ex, config)?.find((l) => l > current + EPS) ?? null;
}

export function previousLoad(ex: ExerciseEquipment, current: number, config: UserEquipmentConfig): number | null {
  return [...(equipmentLoads(ex, config) ?? [])].reverse().find((l) => l < current - EPS) ?? null;
}

// The fixed amounts plate-loaded equipment can add in one go: one plate on a one-sided implement,
// a pair on a two-sided one. Fixed-weight equipment has none (only "next weight step").
export function weightSteps(ex: ExerciseEquipment, config: UserEquipmentConfig): number[] {
  const plates = plateSetup(ex, config);
  if (!plates) return [];
  return sorted(config.plates
    .filter((p) => p.totalOwned >= plates.sides)
    .map((p) => Math.round(p.weight * plates.sides * 100) / 100)
    .filter((step) => step <= MAX_STEP));
}

export interface ProgressionOption { value: ProgressionRule; label: string }
export interface ProgressionOptionGroup { label: string; options: ProgressionOption[] }

const OTHER_RULES: Partial<Record<EquipmentType, ProgressionOption[]>> = {
  assisted_pullup: [{ value: "reduce_assistance", label: "Reduce assistance" }],
  gripper: [{ value: "progress_gripper", label: "Progress gripper" }],
};

const RULE_LABEL: Record<string, string> = {
  none: "None", add_weight: "Next weight step", add_reps: "Add reps", add_time: "Add time", add_rounds: "Add rounds",
  maintain: "Maintain", deload: "Deload", reduce_assistance: "Reduce assistance", progress_gripper: "Progress gripper",
};

export function ruleLabel(rule: ProgressionRule): string {
  const inc = weightIncrement(rule);
  if (inc !== null) return `Add ${cleanWeight(inc)} lb`;
  return RULE_LABEL[rule] ?? rule;
}

export function progressionOptionGroups(ex: ExerciseEquipment, config: UserEquipmentConfig, current: ProgressionRule): ProgressionOptionGroup[] {
  const loads = equipmentLoads(ex, config);
  const steps = weightSteps(ex, config);
  const smallest = loads && loads.length > 1 ? Math.min(...loads.slice(1).map((l, i) => l - loads[i])) : null;
  const addWeight: ProgressionOption[] = loads && loads.length > 1
    ? [
        { value: "add_weight", label: steps.length > 0 ? `Next weight step (as little as ${cleanWeight(Math.round(smallest! * 100) / 100)} lb)` : "Next weight step (your next weight up)" },
        ...steps.map((s) => ({ value: `add_${cleanWeight(s)}lb`, label: `Add ${cleanWeight(s)} lb` })),
      ]
    : [];
  const other: ProgressionOption[] = [
    { value: "none", label: "None" },
    { value: "add_reps", label: "Add reps" },
    { value: "add_time", label: "Add time" },
    ...(OTHER_RULES[ex.equipmentType] ?? []),
    { value: "maintain", label: "Maintain" },
    { value: "deload", label: "Deload" },
  ];
  const groups: ProgressionOptionGroup[] = [
    { label: "Add weight", options: addWeight },
    { label: "Other", options: other },
  ];
  if (!groups.some((g) => g.options.some((o) => o.value === current))) {
    // Never change an exercise's rule silently just because it isn't offered for this equipment.
    groups.unshift({ label: "Current (not possible with this equipment)", options: [{ value: current, label: ruleLabel(current) }] });
  }
  return groups.filter((g) => g.options.length > 0);
}
