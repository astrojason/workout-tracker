"use client";

import type { GymMachine } from "@/lib/types";
import { cleanWeight } from "@/lib/types";

// Picks one of the user's gym machines for a machine exercise ("" = none). While a machine is
// chosen, its weights replace any per-exercise list, so the caller hides the typed-weights field.
export function GymMachineSelect({
  machines,
  value,
  onChange,
}: {
  machines: GymMachine[];
  value: string;
  onChange: (machineId: string) => void;
}) {
  const selected = machines.find((m) => m.id === value);
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">Gym machine</label>
      <select
        aria-label="Gym machine"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      >
        <option value="">None (enter weights below)</option>
        {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {selected && (
        <p className="text-xs text-gray-500 mt-1">Weights from the machine: {selected.plates.map(cleanWeight).join(", ")}</p>
      )}
    </div>
  );
}
