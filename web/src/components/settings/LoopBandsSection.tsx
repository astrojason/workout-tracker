"use client";

import type { UserEquipmentConfig, LoopBandSize } from "@/lib/types";
import { ALL_LOOP_BAND_SIZES } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

export function LoopBandsSection({ config, onChange }: Props) {
  function toggle(size: LoopBandSize) {
    const current = config.loopBands;
    const updated = current.includes(size)
      ? current.filter((s) => s !== size)
      : [...current, size];
    onChange({ loopBands: ALL_LOOP_BAND_SIZES.filter((s) => updated.includes(s)) });
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Loop Bands</h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
        {ALL_LOOP_BAND_SIZES.map((size) => (
          <label key={size} className="px-4 py-3 flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.loopBands.includes(size)}
              onChange={() => toggle(size)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <span className="font-medium">{size}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
