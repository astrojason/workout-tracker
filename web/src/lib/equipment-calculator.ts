import type { ResolvedExercise, PlateConfiguration, EquipmentDisplay, PowerBlockInstructions, UserEquipmentConfig, LoopBandSize } from "./types";
import { barWeight, cleanWeight, ALL_BAND_COLORS, ALL_LOOP_BAND_SIZES, ALL_COC_LEVELS } from "./types";

export const FIXED_DUMBBELLS: number[] = [2];
export const KETTLEBELL_WEIGHTS: number[] = [15, 25, 45];

// totalOwned = total physical plates owned across both sides.
// For symmetric barbell: max per side = floor(totalOwned / 2).
// For landmine (one-sided): all plates can go on the single loaded end.
export const DEFAULT_PLATES: { weight: number; totalOwned: number }[] = [
  { weight: 45, totalOwned: 2 },
  { weight: 35, totalOwned: 2 },
  { weight: 25, totalOwned: 4 },
  { weight: 10, totalOwned: 4 },
  { weight: 5, totalOwned: 2 },
  { weight: 2.5, totalOwned: 2 },
  { weight: 1, totalOwned: 2 },
  { weight: 0.75, totalOwned: 2 },
  { weight: 0.5, totalOwned: 2 },
];

export const DEFAULT_EQUIPMENT_CONFIG: UserEquipmentConfig = {
  barbells: { has45lb: true, has35lb: true, hasEZBar: true },
  plates: DEFAULT_PLATES.map((p) => ({ ...p })),
  powerBlock: { owned: true, minLbs: 5, maxLbs: 50 },
  fixedDumbbells: [...FIXED_DUMBBELLS],
  kettlebells: [...KETTLEBELL_WEIGHTS],
  bands: [...ALL_BAND_COLORS],
  loopBands: [...ALL_LOOP_BAND_SIZES],
  assistedPullupBands: 4,
  grippers: [...ALL_COC_LEVELS],
};

const BAND_INFO: Record<string, { name: string; range: string }> = {
  Orange: { name: "Orange", range: "2-12 lbs" },
  Purple: { name: "Purple", range: "5-35 lbs" },
  Red: { name: "Red", range: "10-50 lbs" },
  Blue: { name: "Blue", range: "20-80 lbs" },
  Green: { name: "Green", range: "50-120 lbs" },
  Black: { name: "Black", range: "60-150 lbs" },
};

// ── Plate Calculator ──

function getEffectivePlates(
  config?: UserEquipmentConfig
): { weight: number; totalOwned: number }[] {
  const plates = config?.plates ?? DEFAULT_PLATES;
  // Defensive: greedy algorithm assumes largest → smallest order.
  return [...plates].sort((a, b) => b.weight - a.weight);
}

// loadingSides: 2 for symmetric barbell (plates on both ends), 1 for landmine (one end only).
// Per-side limit = floor(totalOwned / loadingSides).
function findPlates(
  target: number,
  plates: { weight: number; totalOwned: number }[] = DEFAULT_PLATES,
  loadingSides: 1 | 2 = 2
): { plates: { plate: number; count: number }[]; totalPerSide: number } | null {
  let remaining = target;
  const result: { plate: number; count: number }[] = [];
  const epsilon = 0.001;

  for (const plate of plates) {
    if (remaining < plate.weight - epsilon) continue;
    const maxPerSide = Math.floor(plate.totalOwned / loadingSides);
    const maxCount = Math.min(maxPerSide, Math.floor(remaining / plate.weight));
    if (maxCount > 0) {
      result.push({ plate: plate.weight, count: maxCount });
      remaining -= maxCount * plate.weight;
    }
  }

  if (Math.abs(remaining) < epsilon) {
    const total = result.reduce((sum, p) => sum + p.count * p.plate, 0);
    return { plates: result, totalPerSide: total };
  }
  return null;
}

// Exercises loaded one-sided (like a landmine attachment), even when the
// name doesn't literally say "landmine" — e.g. Meadows Row.
function isLandmineExercise(exercise: ResolvedExercise): boolean {
  const name = exercise.name.toLowerCase();
  return name.includes("landmine") || name.includes("meadows");
}

export function calculateBarbell(targetWeight: number, bWeight: number, config?: UserEquipmentConfig): PlateConfiguration {
  const plates = getEffectivePlates(config);
  const perSideNeeded = (targetWeight - bWeight) / 2;

  if (perSideNeeded <= 0) {
    return { targetWeight, barWeight: bWeight, achievedWeight: bWeight, perSide: [] };
  }

  // Try exact match
  const exact = findPlates(perSideNeeded, plates, 2);
  if (exact) {
    return {
      targetWeight,
      barWeight: bWeight,
      achievedWeight: bWeight + exact.totalPerSide * 2,
      perSide: exact.plates,
    };
  }

  // Round down: find nearest achievable weight below target
  const step = 0.25;
  let tryPerSide = Math.floor((perSideNeeded - 0.001) / step) * step;
  while (tryPerSide > 0) {
    const normalized = Math.round(tryPerSide * 1000) / 1000;
    const found = findPlates(normalized, plates, 2);
    if (found) {
      return {
        targetWeight,
        barWeight: bWeight,
        achievedWeight: bWeight + found.totalPerSide * 2,
        perSide: found.plates,
      };
    }
    tryPerSide -= step;
  }

  return { targetWeight, barWeight: bWeight, achievedWeight: bWeight, perSide: [] };
}

export function calculateLandmine(targetWeight: number, bWeight: number, config?: UserEquipmentConfig): PlateConfiguration {
  const plates = getEffectivePlates(config);
  const oneSideNeeded = targetWeight - bWeight;

  if (oneSideNeeded <= 0) {
    return { targetWeight, barWeight: bWeight, achievedWeight: bWeight, perSide: [], isLandmine: true };
  }

  // Try exact match (loadingSides=1: all owned plates available on the single loaded end)
  const exact = findPlates(oneSideNeeded, plates, 1);
  if (exact) {
    return {
      targetWeight,
      barWeight: bWeight,
      achievedWeight: bWeight + exact.totalPerSide,
      perSide: exact.plates,
      isLandmine: true,
    };
  }

  // Round down: find nearest achievable weight below target
  const step = 0.25;
  let tryOneSide = Math.floor((oneSideNeeded - 0.001) / step) * step;
  while (tryOneSide > 0) {
    const normalized = Math.round(tryOneSide * 1000) / 1000;
    const found = findPlates(normalized, plates, 1);
    if (found) {
      return {
        targetWeight,
        barWeight: bWeight,
        achievedWeight: bWeight + found.totalPerSide,
        perSide: found.plates,
        isLandmine: true,
      };
    }
    tryOneSide -= step;
  }

  return { targetWeight, barWeight: bWeight, achievedWeight: bWeight, perSide: [], isLandmine: true };
}

// ── PowerBlock ──

// roundDown: display/manual-entry snapping rounds to the NEAREST 2.5lb step (default).
// The progression engine always rounds DOWN to the nearest achievable step instead —
// pass roundDown: true there so a computed weight never exceeds what's actually loadable.
// Every weight the adjustable dumbbells can be set to, ascending: the weights the user entered, or
// every 2.5 lb from min to max when none were entered.
export function powerBlockWeights(config?: Pick<UserEquipmentConfig, "powerBlock">): number[] {
  const pb = config?.powerBlock ?? DEFAULT_EQUIPMENT_CONFIG.powerBlock;
  if (pb.weights && pb.weights.length > 0) return [...new Set(pb.weights)].sort((a, b) => a - b);
  const out: number[] = [];
  for (let w = pb.minLbs; w <= pb.maxLbs + 1e-9; w += 2.5) out.push(Math.round(w * 100) / 100);
  return out;
}

// Snaps to a weight the dumbbells can be set to: the nearest (ties go up), or the heaviest at or
// under the target with roundDown. Outside the range it clamps to the lightest or heaviest.
export function nearestPowerBlock(target: number, config?: UserEquipmentConfig, roundDown = false): number {
  const weights = powerBlockWeights(config);
  if (target <= weights[0]) return weights[0];
  if (roundDown) return [...weights].reverse().find((w) => w <= target + 1e-9) ?? weights[0];
  return weights.reduce((best, w) => (Math.abs(w - target) <= Math.abs(best - target) ? w : best), weights[0]);
}

// One setting heavier (direction 1) or lighter (-1) than `weight`, staying at the ends. Steppers use
// this so a big gap between settings can't trap them.
export function stepPowerBlock(weight: number, direction: 1 | -1, config?: UserEquipmentConfig): number {
  const weights = powerBlockWeights(config);
  const i = weights.indexOf(nearestPowerBlock(weight, config));
  return weights[Math.max(0, Math.min(weights.length - 1, i + direction))];
}

// PowerBlock Elite EXP Stage 1 selector + rod configuration per weight
const POWERBLOCK_TABLE: Record<number, { selector: number; rods: "none" | "one" | "both" }> = {
  5:    { selector: 5,  rods: "none" },
  7.5:  { selector: 5,  rods: "one" },
  10:   { selector: 5,  rods: "both" },
  12.5: { selector: 10, rods: "none" },
  15:   { selector: 10, rods: "one" },
  17.5: { selector: 10, rods: "both" },
  20:   { selector: 15, rods: "none" },
  22.5: { selector: 15, rods: "one" },
  25:   { selector: 25, rods: "none" },
  27.5: { selector: 25, rods: "one" },
  30:   { selector: 25, rods: "both" },
  32.5: { selector: 30, rods: "none" },
  35:   { selector: 30, rods: "one" },
  37.5: { selector: 30, rods: "both" },
  40:   { selector: 40, rods: "none" },
  42.5: { selector: 40, rods: "one" },
  45:   { selector: 40, rods: "both" },
  47.5: { selector: 45, rods: "one" },
  50:   { selector: 50, rods: "none" },
};

const ROD_LABEL: Record<"none" | "one" | "both", string> = {
  none: "no rods",
  one: "add 1 rod",
  both: "add both rods",
};

export function getPowerBlockInstructions(weight: number): PowerBlockInstructions {
  const entry = POWERBLOCK_TABLE[weight];
  if (!entry) {
    return { selector: 5, rods: "none", label: "—" };
  }
  const { selector, rods } = entry;
  return { selector, rods, label: `Selector to ${selector} · ${ROD_LABEL[rods]}` };
}

// ── Display helpers ──

export function plateDisplayString(config: PlateConfiguration): string {
  if (config.perSide.length === 0) {
    return `Bar only (${cleanWeight(config.barWeight)} lbs)`;
  }
  return config.perSide.map((p) => `${p.count}x${cleanWeight(p.plate)}`).join(" + ");
}

function plateBracketString(config: PlateConfiguration): string {
  const items = config.perSide.map((p) => `${p.count}x${cleanWeight(p.plate)}`).join(", ");
  return `[${items}]`;
}

export function plateFullDisplayString(config: PlateConfiguration): string {
  // No bar (a 0 lb one-sided item): just the plates; there's no bar to name or end to pick.
  const noBar = config.barWeight === 0 && config.isLandmine;
  if (config.perSide.length === 0) {
    return noBar ? "No plates" : `Bar only (${cleanWeight(config.barWeight)} lbs)`;
  }
  const brackets = plateBracketString(config);
  if (noBar) return `${brackets} (${cleanWeight(config.achievedWeight)} lbs)`;
  const label = config.isLandmine ? "one end" : "each side";
  return `${cleanWeight(config.barWeight)}lb bar + ${brackets} ${label} (${cleanWeight(config.achievedWeight)} lbs)`;
}

// Pulley/cable attachments (e.g. Spud Pulley System) are plate-loaded like a
// barbell, but with no bar weight and no per-side split — the full stack is
// loaded on a single pin and worked unilaterally. Never uses "bar" wording.
export function pulleyDisplayString(config: PlateConfiguration): string {
  if (config.perSide.length === 0) return "No plates";
  const items = config.perSide.map((p) => `${p.count}x${cleanWeight(p.plate)}`).join(" + ");
  return `${items} (${cleanWeight(config.achievedWeight)} lbs)`;
}

function parseWeightFromDetail(detail: string): number | null {
  const cleaned = detail.replace(/lbs?/gi, "").replace(/s$/i, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function getEquipmentDisplay(exercise: ResolvedExercise, weight: number, config?: UserEquipmentConfig): EquipmentDisplay {
  // An exercise linked to one of the user's own items is loaded on that item. If the item has been
  // deleted, or has no weight, the exercise's own equipment type decides as before.
  const item = exercise.equipmentItemId ? config?.items?.find((i) => i.id === exercise.equipmentItemId) : undefined;
  if (item?.kind === "plate_loaded") {
    const base = item.baseWeight ?? 0;
    const oneSided = (item.sides ?? 1) === 1;
    if (weight <= base) return { type: "barbell", config: { targetWeight: base, barWeight: base, achievedWeight: base, perSide: [], isLandmine: oneSided } };
    const loaded = oneSided ? calculateLandmine(weight, base, config) : calculateBarbell(weight, base, config);
    return { type: "barbell", config: { ...loaded, isLandmine: oneSided } };
  }
  if (item?.kind === "fixed") return { type: "item", name: item.name, weight };

  switch (exercise.equipmentType) {
    case "barbell_45": {
      const landmine = isLandmineExercise(exercise);
      if (weight <= 45) return { type: "barbell", config: { targetWeight: 45, barWeight: 45, achievedWeight: 45, perSide: [], isLandmine: landmine } };
      return { type: "barbell", config: landmine ? calculateLandmine(weight, 45, config) : calculateBarbell(weight, 45, config) };
    }

    case "barbell_35": {
      const landmine = isLandmineExercise(exercise);
      if (weight <= 35) return { type: "barbell", config: { targetWeight: 35, barWeight: 35, achievedWeight: 35, perSide: [], isLandmine: landmine } };
      return { type: "barbell", config: landmine ? calculateLandmine(weight, 35, config) : calculateBarbell(weight, 35, config) };
    }

    case "barbell_ez":
      if (weight <= 15) return { type: "barbell", config: { targetWeight: 15, barWeight: 15, achievedWeight: 15, perSide: [] } };
      return { type: "barbell", config: calculateBarbell(weight, 15, config) };

    case "powerblock": {
      if (exercise.equipmentDetail) {
        const dbWeight = parseWeightFromDetail(exercise.equipmentDetail);
        if (dbWeight !== null && dbWeight < 5) return { type: "dumbbell", weight: dbWeight };
      }
      // If PowerBlock not owned, treat as plain dumbbell
      if (config?.powerBlock?.owned === false) return { type: "dumbbell", weight };
      if (weight > 0 && weight < powerBlockWeights(config)[0]) return { type: "dumbbell", weight };
      const resolvedWeight = weight > 0 ? nearestPowerBlock(weight, config) : 0;
      const instructions = resolvedWeight > 0
        ? getPowerBlockInstructions(resolvedWeight)
        : { selector: 5, rods: "none" as const, label: "—" };
      return { type: "powerblock", weight: resolvedWeight, instructions };
    }

    case "dumbbell":
      return { type: "dumbbell", weight };

    case "band": {
      const bandName = exercise.equipmentDetail || "Unknown";
      const info = BAND_INFO[bandName];
      return { type: "band", name: info?.name || bandName, range: info?.range || "" };
    }

    case "bodyweight":
      return { type: "bodyweight", detail: exercise.equipmentDetail };

    case "assisted_pullup":
      return { type: "assisted", weight, detail: exercise.equipmentDetail };

    case "kettlebell":
      return { type: "kettlebell", weight };

    case "machine":
      return { type: "machine", weight };

    case "gripper":
      return { type: "gripper", weight };

    case "pulley":
      // Reuses the single-sided ("landmine") plate-finder with bWeight=0 —
      // there's no bar, just a plate stack loaded directly on the pin.
      return { type: "pulley", config: calculateLandmine(weight, 0, config) };

    case "loop_band":
      return { type: "loop_band", size: (exercise.equipmentDetail as LoopBandSize) || "Medium" };
  }
}

export function equipmentDisplayText(display: EquipmentDisplay): string {
  switch (display.type) {
    case "item": return `${display.name}: ${cleanWeight(display.weight)} lbs`;
    case "barbell": return plateFullDisplayString(display.config);
    case "powerblock": return `PowerBlock: ${cleanWeight(display.weight)} lbs`;
    case "dumbbell": return `Dumbbell: ${cleanWeight(display.weight)} lbs`;
    case "band": return `${display.name} Band (${display.range})`;
    case "bodyweight": return display.detail || "Bodyweight";
    case "assisted": {
      if (display.weight > 0) {
        const bandLabel = display.weight === 1 ? "band" : "bands";
        return `${display.weight} ${bandLabel} (~${display.weight * 80} lbs assistance)`;
      }
      return display.detail?.replace(/_/g, " ") || "Assisted";
    }
    case "kettlebell": return `Kettlebell: ${cleanWeight(display.weight)} lbs`;
    case "machine": return `Machine stack: ${cleanWeight(display.weight)} lbs`;
    case "gripper": return display.weight > 0 ? `Gripper: ${cleanWeight(display.weight)} lbs` : "Gripper";
    case "pulley": return pulleyDisplayString(display.config);
    case "loop_band": return `${display.size} Loop Band`;
  }
}

export function equipmentShortText(display: EquipmentDisplay): string {
  switch (display.type) {
    case "item": return `${cleanWeight(display.weight)} lbs`;
    case "barbell": return `${cleanWeight(display.config.achievedWeight)} lbs`;
    case "powerblock":
    case "dumbbell":
    case "kettlebell":
    case "machine":
    case "gripper": return `${cleanWeight(display.weight)} lbs`;
    case "pulley": return `${cleanWeight(display.config.achievedWeight)} lbs`;
    case "band": return `${display.name} Band`;
    case "loop_band": return display.size;
    case "bodyweight": return "BW";
    case "assisted": {
      if (display.weight > 0) {
        const bandLabel = display.weight === 1 ? "band" : "bands";
        return `${display.weight} ${bandLabel}`;
      }
      return "Assisted";
    }
  }
}
