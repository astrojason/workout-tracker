"use client";

import type { UserEquipmentConfig, CoCLevel } from "@/lib/types";
import { ALL_COC_LEVELS } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

export function GripperSection({ config, onChange }: Props) {
  function toggle(level: CoCLevel) {
    const current = config.grippers;
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    onChange({ grippers: ALL_COC_LEVELS.filter((l) => updated.includes(l)) });
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
        Captains of Crush Grippers
      </h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
        {ALL_COC_LEVELS.map((level) => (
          <label key={level} className="px-4 py-3 flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.grippers.includes(level)}
              onChange={() => toggle(level)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <span className="font-medium">CoC #{level}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
