import type { EquipmentItem, EquipmentItemKind, EquipmentType, ExerciseDefinition, GymMachine, UserEquipmentConfig } from "./types";
import { cleanWeight } from "./types";

// The exercise editor's single Equipment dropdown, built from what you own: the equipment in
// Equipment settings, your own items and your gym machines. One value carries the choice:
//   type:<EquipmentType>   built-in equipment (a bar, kettlebells, bands…)
//   item:<itemId>          one of your own items
//   machine:<machineId>    one of your gym machines ("machine:" = a machine with typed weights)

export interface EquipmentOption { value: string; label: string }
export interface EquipmentOptionGroup { label: string; options: EquipmentOption[] }

type EquipmentFields = Pick<ExerciseDefinition, "equipmentType" | "equipmentItemId" | "machineId">;

// Names for every built-in type, used when the exercise's current equipment isn't one you own.
const TYPE_NAME: Record<EquipmentType, string> = {
  barbell_45: "Olympic bar (45 lb)",
  barbell_35: "35 lb bar",
  barbell_ez: "EZ bar (15 lb)",
  powerblock: "PowerBlock",
  dumbbell: "Dumbbells",
  band: "Serious Steel bands",
  loop_band: "Loop bands",
  kettlebell: "Kettlebells",
  bodyweight: "Bodyweight",
  assisted_pullup: "Pull-up assist",
  gripper: "Grippers",
  pulley: "Pulley (Spud system)",
  machine: "Machine",
};

const list = (xs: (number | string)[]) => xs.map((x) => (typeof x === "number" ? cleanWeight(x) : x)).join(", ");

function ownedOptions(config: UserEquipmentConfig): EquipmentOption[] {
  const out: EquipmentOption[] = [];
  const add = (type: EquipmentType, label: string) => out.push({ value: `type:${type}`, label });
  if (config.barbells.has45lb) add("barbell_45", TYPE_NAME.barbell_45);
  if (config.barbells.has35lb) add("barbell_35", TYPE_NAME.barbell_35);
  if (config.barbells.hasEZBar) add("barbell_ez", TYPE_NAME.barbell_ez);
  if (config.powerBlock.owned) add("powerblock", `PowerBlock (${cleanWeight(config.powerBlock.minLbs)}–${cleanWeight(config.powerBlock.maxLbs)} lb)`);
  if (config.fixedDumbbells.length > 0) add("dumbbell", `Dumbbells (${list([...config.fixedDumbbells].sort((a, b) => a - b))} lb)`);
  if (config.kettlebells.length > 0) add("kettlebell", `Kettlebells (${list([...config.kettlebells].sort((a, b) => a - b))} lb)`);
  if (config.bands.length > 0) add("band", `Serious Steel bands (${list(config.bands)})`);
  if (config.loopBands.length > 0) add("loop_band", `Loop bands (${config.loopBands.length} size${config.loopBands.length === 1 ? "" : "s"})`);
  if (config.assistedPullupBands > 0) add("assisted_pullup", `Pull-up assist (${config.assistedPullupBands} band${config.assistedPullupBands === 1 ? "" : "s"})`);
  if (config.grippers.length > 0) add("gripper", `Grippers (${config.grippers.length})`);
  for (const item of config.items ?? []) out.push({ value: `item:${item.id}`, label: item.name });
  return out;
}

export function equipmentOptionGroups(config: UserEquipmentConfig, machines: GymMachine[], current: string): EquipmentOptionGroup[] {
  const groups: EquipmentOptionGroup[] = [
    { label: "Your equipment", options: ownedOptions(config) },
    { label: "Gym machines", options: [...machines.map((m) => ({ value: `machine:${m.id}`, label: m.name })), { value: "machine:", label: "Other machine (enter its weights)" }] },
    { label: "No equipment", options: [{ value: "type:bodyweight", label: TYPE_NAME.bodyweight }] },
  ];
  const offered = groups.some((g) => g.options.some((o) => o.value === current));
  if (!offered && current.startsWith("type:")) {
    // Don't silently change an exercise's equipment just because you no longer own it.
    groups.unshift({ label: "Current (not in your equipment)", options: [{ value: current, label: TYPE_NAME[current.slice(5) as EquipmentType] ?? current.slice(5) }] });
  }
  return groups.filter((g) => g.options.length > 0);
}

export function equipmentChoiceValue(def: EquipmentFields, config: UserEquipmentConfig): string {
  if (def.equipmentItemId && (config.items ?? []).some((i) => i.id === def.equipmentItemId)) return `item:${def.equipmentItemId}`;
  if (def.equipmentType === "machine") return `machine:${def.machineId ?? ""}`;
  return `type:${def.equipmentType}`;
}

// The built-in type an item's exercise is stored with, so screens that only know built-in types
// still treat it sensibly: no weight → bodyweight, a set of weights → like kettlebells, plate-loaded
// → a loaded machine (no barbell warm-up ramp from a 45 lb bar). Plate math, progression and the
// can't-make check use the item itself.
const ITEM_TYPE: Record<EquipmentItemKind, EquipmentType> = { none: "bodyweight", fixed: "kettlebell", plate_loaded: "machine" };

export function applyEquipmentChoice(value: string, config: UserEquipmentConfig): Required<EquipmentFields> {
  const [kind, id] = [value.slice(0, value.indexOf(":")), value.slice(value.indexOf(":") + 1)];
  if (kind === "item") {
    const item: EquipmentItem | undefined = (config.items ?? []).find((i) => i.id === id);
    if (!item) throw new Error(`Equipment item ${id} is not in your equipment.`);
    return { equipmentType: ITEM_TYPE[item.kind], equipmentItemId: item.id, machineId: null };
  }
  if (kind === "machine") return { equipmentType: "machine", equipmentItemId: null, machineId: id || null };
  if (kind === "type" && id in TYPE_NAME) return { equipmentType: id as EquipmentType, equipmentItemId: null, machineId: null };
  throw new Error(`Unknown equipment choice "${value}".`);
}
