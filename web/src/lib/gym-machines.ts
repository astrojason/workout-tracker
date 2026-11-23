import { parseWeightOptions, type ExerciseDefinition, type GymMachine } from "./types";

/**
 * Overlays each linked exercise's machine weights onto `weightOptions`, so everything
 * downstream (weight picker, progression) just reads `weightOptions`. An exercise whose
 * machine no longer exists keeps its own `weightOptions`; unlinked exercises are untouched.
 */
export function applyGymMachines(
  definitions: Record<string, ExerciseDefinition>,
  machines: GymMachine[],
): Record<string, ExerciseDefinition> {
  if (machines.length === 0) return definitions;
  const byId = new Map(machines.map((m) => [m.id, m]));
  const out: Record<string, ExerciseDefinition> = {};
  for (const [id, def] of Object.entries(definitions)) {
    const machine = def.machineId ? byId.get(def.machineId) : undefined;
    out[id] = machine ? { ...def, weightOptions: machine.plates } : def;
  }
  return out;
}

export type GymMachineValidation =
  | { ok: true; name: string; plates: number[] }
  | { ok: false; error: string };

/** Validates the add/edit form. `editingId` exempts that machine from the duplicate-name check. */
export function validateGymMachineInput(
  name: string,
  weightsText: string,
  machines: GymMachine[],
  editingId?: string,
): GymMachineValidation {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Enter a name for the machine." };
  const taken = machines.some((m) => m.id !== editingId && m.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (taken) return { ok: false, error: `A machine named "${trimmed}" already exists.` };
  const plates = parseWeightOptions(weightsText);
  if (!plates) return { ok: false, error: "Enter at least two weights, separated by commas (e.g. 10, 20, 30, 42.5)." };
  return { ok: true, name: trimmed, plates };
}

export function linkedExerciseCount(machineId: string, definitions: Record<string, ExerciseDefinition>): number {
  return Object.values(definitions).filter((d) => d.machineId === machineId).length;
}
