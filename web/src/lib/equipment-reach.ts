import type { EquipmentType, ExerciseDefinition, Program, UserEquipmentConfig } from "./types";
import { findItem, itemLoads, plateLoads } from "./equipment-items";
import { powerBlockWeights } from "./equipment-calculator";

// What the user's equipment can load, and which programmed working weights it can't make.
// Barbell loads use the app's own plate calculation, so a load counts only if the workout screen
// would actually produce it.

export interface ReachRow {
  key: string;
  name: string;
  unit: "lb" | "bands";
  loads: number[]; // ascending
  types: EquipmentType[]; // the exercise equipment types it serves
  itemId?: string;        // one of the user's own items (exercises link to it directly)
}

const EPS = 0.001;
const same = (a: number, b: number) => Math.abs(a - b) < EPS;

const barbellLoads = (bar: number, config: UserEquipmentConfig) => plateLoads(bar, 2, config);

const powerBlockLoads = (config: UserEquipmentConfig): number[] => (config.powerBlock.owned ? powerBlockWeights(config) : []);

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
  for (const item of config.items ?? []) {
    if (item.kind === "none") continue;
    rows.push({ key: `item:${item.id}`, name: item.name, unit: "lb", loads: itemLoads(item, config), types: [], itemId: item.id });
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
  programId: string;
  programName: string;
  definitionId: string;
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
      const entry = (reason: string, loads: number[] | null, unit: "lb" | "bands" = "lb"): Unmakeable => ({
        programId: program.id, programName: program.name, definitionId, exerciseName: def.name, weight, unit, reason,
        ...(loads ? nearest(loads, weight) : { below: null, above: null }),
      });
      const has = (loads: number[]) => loads.some((l) => same(l, weight));

      // Linked to one of the user's own items: that item's loads are what count.
      const linked = findItem(config, def.equipmentItemId);
      if (linked) {
        if (linked.kind === "none") continue;
        const loads = itemLoads(linked, config);
        if (!has(loads)) out.push(entry(linked.kind === "fixed" ? `Not one of the ${linked.name}` : `Your plates can't make it on the ${linked.name}`, loads));
        continue;
      }

      switch (def.equipmentType) {
        case "barbell_45": case "barbell_35": case "barbell_ez": {
          const loads = loadsFor(def.equipmentType);
          if (!loads) out.push(entry(`You don't have a ${BAR_NAME[def.equipmentType]}`, null));
          else if (!has(loads)) out.push(entry("Your plates can't make it", loads));
          break;
        }
        case "powerblock": case "dumbbell":
          if (!has(dumbbells)) out.push(entry("Outside your dumbbells", dumbbells));
          break;
        case "kettlebell": {
          const loads = sorted(config.kettlebells);
          if (!has(loads)) out.push(entry("No kettlebell that weight", loads));
          break;
        }
        case "machine": {
          const loads = def.weightOptions && def.weightOptions.length > 0 ? sorted(def.weightOptions) : null;
          if (loads && !has(loads)) out.push(entry("Not a setting on the machine", loads));
          break;
        }
        case "assisted_pullup":
          if (weight > config.assistedPullupBands || !Number.isInteger(weight)) {
            out.push({ ...entry("More bands than you own", null, "bands"), below: Math.min(config.assistedPullupBands, Math.floor(weight)), above: null });
          }
          break;
        default:
          break;
      }
    }
  }
  return out;
}
