import type { EquipmentType, ExerciseDefinition, Program, UserEquipmentConfig } from "./types";
import { calculateBarbell } from "./equipment-calculator";

// What the user's equipment can load, and which programmed working weights it can't make.
// Barbell loads use the app's own plate calculation, so a load counts only if the workout screen
// would actually produce it.

export interface ReachRow {
  key: string;
  name: string;
  unit: "lb" | "bands";
  loads: number[]; // ascending
  types: EquipmentType[]; // the exercise equipment types it serves
}

const EPS = 0.001;
const same = (a: number, b: number) => Math.abs(a - b) < EPS;

function barbellLoads(bar: number, config: UserEquipmentConfig): number[] {
  const maxPerSide = config.plates.reduce((sum, p) => sum + p.weight * Math.floor(p.totalOwned / 2), 0);
  const loads: number[] = [];
  // Every plate is a multiple of 0.25 lb, so per-side totals move in 0.25 steps (0.5 for the bar).
  for (let perSide = 0; perSide <= maxPerSide + EPS; perSide += 0.25) {
    const target = Math.round((bar + perSide * 2) * 100) / 100;
    if (same(calculateBarbell(target, bar, config).achievedWeight, target)) loads.push(target);
  }
  return loads;
}

function powerBlockLoads(config: UserEquipmentConfig): number[] {
  if (!config.powerBlock.owned) return [];
  const loads: number[] = [];
  for (let w = config.powerBlock.minLbs; w <= config.powerBlock.maxLbs + EPS; w += 2.5) loads.push(Math.round(w * 100) / 100);
  return loads;
}

const sorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

export function equipmentReach(config: UserEquipmentConfig): ReachRow[] {
  const rows: ReachRow[] = [];
  if (config.barbells.has45lb) rows.push({ key: "bar45", name: "Barbell (45 lb)", unit: "lb", loads: barbellLoads(45, config), types: ["barbell_45"] });
  if (config.barbells.has35lb) rows.push({ key: "bar35", name: "Barbell (35 lb)", unit: "lb", loads: barbellLoads(35, config), types: ["barbell_35"] });
  if (config.barbells.hasEZBar) rows.push({ key: "ez", name: "EZ bar (15 lb)", unit: "lb", loads: barbellLoads(15, config), types: ["barbell_ez"] });
  if (config.powerBlock.owned) rows.push({ key: "powerblock", name: "PowerBlock", unit: "lb", loads: powerBlockLoads(config), types: ["powerblock"] });
  if (config.fixedDumbbells.length > 0) rows.push({ key: "dumbbells", name: "Fixed dumbbells", unit: "lb", loads: sorted(config.fixedDumbbells), types: ["dumbbell"] });
  if (config.kettlebells.length > 0) rows.push({ key: "kettlebells", name: "Kettlebells", unit: "lb", loads: sorted(config.kettlebells), types: ["kettlebell"] });
  if (config.assistedPullupBands > 0) {
    rows.push({ key: "assisted", name: "Assisted pull-up", unit: "bands", loads: Array.from({ length: config.assistedPullupBands + 1 }, (_, i) => i), types: ["assisted_pullup"] });
  }
  return rows;
}

export function reachStats(loads: number[]): { min: number; max: number; smallestStep: number | null; biggestGap: { from: number; to: number } | null } {
  let smallestStep: number | null = null;
  let biggestGap: { from: number; to: number } | null = null;
  for (let i = 1; i < loads.length; i++) {
    const step = Math.round((loads[i] - loads[i - 1]) * 100) / 100;
    if (smallestStep === null || step < smallestStep) smallestStep = step;
    if (!biggestGap || step > biggestGap.to - biggestGap.from + EPS) biggestGap = { from: loads[i - 1], to: loads[i] };
  }
  return { min: loads[0], max: loads[loads.length - 1], smallestStep, biggestGap };
}

export interface Unmakeable {
  programName: string;
  exerciseName: string;
  weight: number;
  unit: "lb" | "bands";
  reason: string;
  below: number | null; // nearest you can make below / above
  above: number | null;
}

function nearest(loads: number[], w: number): { below: number | null; above: number | null } {
  const below = [...loads].reverse().find((l) => l < w - EPS) ?? null;
  const above = loads.find((l) => l > w + EPS) ?? null;
  return { below, above };
}

const BAR_NAME: Partial<Record<EquipmentType, string>> = { barbell_45: "45 lb barbell", barbell_35: "35 lb barbell", barbell_ez: "EZ bar" };

// Each active program's working weights that the equipment (or a machine's settings) can't make.
// Equipment without a weight to check (bodyweight, bands, grippers, pulleys) is skipped.
export function unmakeableWeights(
  programs: Program[],
  definitions: Record<string, ExerciseDefinition>,
  config: UserEquipmentConfig,
): Unmakeable[] {
  const rows = equipmentReach(config);
  const loadsFor = (type: EquipmentType) => rows.find((r) => r.types.includes(type))?.loads ?? null;
  const dumbbells = sorted([...(loadsFor("powerblock") ?? []), ...config.fixedDumbbells]);
  const out: Unmakeable[] = [];

  for (const program of programs.filter((p) => !p.archived)) {
    for (const [definitionId, { currentWeight: weight }] of Object.entries(program.weights ?? {})) {
      const def = definitions[definitionId];
      if (!def || !(weight > 0)) continue;
      const item = (reason: string, loads: number[] | null, unit: "lb" | "bands" = "lb"): Unmakeable => ({
        programName: program.name, exerciseName: def.name, weight, unit, reason,
        ...(loads ? nearest(loads, weight) : { below: null, above: null }),
      });
      const has = (loads: number[]) => loads.some((l) => same(l, weight));

      switch (def.equipmentType) {
        case "barbell_45": case "barbell_35": case "barbell_ez": {
          const loads = loadsFor(def.equipmentType);
          if (!loads) out.push(item(`You don't have a ${BAR_NAME[def.equipmentType]}`, null));
          else if (!has(loads)) out.push(item("Your plates can't make it", loads));
          break;
        }
        case "powerblock": case "dumbbell":
          if (!has(dumbbells)) out.push(item("Outside your dumbbells", dumbbells));
          break;
        case "kettlebell": {
          const loads = sorted(config.kettlebells);
          if (!has(loads)) out.push(item("No kettlebell that weight", loads));
          break;
        }
        case "machine": {
          const loads = def.weightOptions && def.weightOptions.length > 0 ? sorted(def.weightOptions) : null;
          if (loads && !has(loads)) out.push(item("Not a setting on the machine", loads));
          break;
        }
        case "assisted_pullup":
          if (weight > config.assistedPullupBands || !Number.isInteger(weight)) {
            out.push({ ...item("More bands than you own", null, "bands"), below: Math.min(config.assistedPullupBands, Math.floor(weight)), above: null });
          }
          break;
        default:
          break;
      }
    }
  }
  return out;
}
