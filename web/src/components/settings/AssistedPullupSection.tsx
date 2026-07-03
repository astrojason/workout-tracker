"use client";

import type { UserEquipmentConfig } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

export function AssistedPullupSection({ config, onChange }: Props) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
        Pull-Up Assist Bands
      </h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 flex justify-between items-center">
          <div>
            <span className="font-medium">Max assist bands</span>
            <p className="text-xs text-gray-500 mt-0.5">Caps band count input for assisted pull-ups</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onChange({ assistedPullupBands: Math.max(0, config.assistedPullupBands - 1) })}
              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-lg font-bold transition"
              aria-label="Decrease band count"
            >
              −
            </button>
            <span className="w-6 text-center font-mono">{config.assistedPullupBands}</span>
            <button
              onClick={() => onChange({ assistedPullupBands: config.assistedPullupBands + 1 })}
              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-lg font-bold transition"
              aria-label="Increase band count"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
