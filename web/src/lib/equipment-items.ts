import type { EquipmentItem, EquipmentItemKind, UserEquipmentConfig } from "./types";
import { calculateBarbell, calculateLandmine } from "./equipment-calculator";

const EPS = 0.001;

// Every load a plate-loaded implement can make with the user's plates, using the app's own plate
// calculation (so a load counts only if a workout would produce it). One-sided implements take all
// your plates on their one side; two-sided ones take half a side, like a barbell.
export function plateLoads(base: number, sides: 1 | 2, config: UserEquipmentConfig): number[] {
  const perSideMax = config.plates.reduce((sum, p) => sum + p.weight * (sides === 2 ? Math.floor(p.totalOwned / 2) : p.totalOwned), 0);
  const loads: number[] = [];
  // Every plate is a multiple of 0.25 lb.
  for (let added = 0; added <= perSideMax + EPS; added += 0.25) {
    const target = Math.round((base + added * sides) * 100) / 100;
    const achieved = sides === 2 ? calculateBarbell(target, base, config).achievedWeight : calculateLandmine(target, base, config).achievedWeight;
    if (Math.abs(achieved - target) < EPS) loads.push(target);
  }
  return loads;
}

export function itemLoads(item: EquipmentItem, config: UserEquipmentConfig): number[] {
  switch (item.kind) {
    case "plate_loaded": return plateLoads(item.baseWeight ?? 0, item.sides ?? 1, config);
    case "fixed": return [...new Set(item.weights ?? [])].sort((a, b) => a - b);
    case "none": return [];
  }
}

export function findItem(config: Pick<UserEquipmentConfig, "items"> | undefined, id: string | null | undefined): EquipmentItem | null {
  if (!id) return null;
  return config?.items?.find((i) => i.id === id) ?? null;
}

export const ITEM_KIND_LABEL: Record<EquipmentItemKind, string> = {
  plate_loaded: "Plate-loaded",
  fixed: "Fixed weights",
  none: "No weight",
};

export interface EquipmentItemInput {
  name: string;
  kind: EquipmentItemKind;
  baseWeight: string;
  sides: 1 | 2;
  weights: string;
}

export type EquipmentItemValidation =
  | { ok: true; item: Omit<EquipmentItem, "id"> }
  | { ok: false; error: string };

// Validates the add/edit form. `editingId` exempts that item from the duplicate-name check.
export function validateEquipmentItem(input: EquipmentItemInput, items: EquipmentItem[], editingId?: string): EquipmentItemValidation {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter a name for the item." };
  if (items.some((i) => i.id !== editingId && i.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `You already have an item named "${name}".` };
  }
  if (input.kind === "plate_loaded") {
    const base = Number(input.baseWeight.trim());
    if (input.baseWeight.trim() === "" || !Number.isFinite(base) || base < 0) return { ok: false, error: "Enter what it weighs empty, in lb (0 if nothing)." };
    return { ok: true, item: { name, kind: "plate_loaded", baseWeight: base, sides: input.sides } };
  }
  if (input.kind === "fixed") {
    const weights = [...new Set(input.weights.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
    if (weights.length === 0) return { ok: false, error: "Enter its weights, separated by commas (e.g. 2, 6, 9)." };
    return { ok: true, item: { name, kind: "fixed", weights } };
  }
  return { ok: true, item: { name, kind: "none" } };
}
