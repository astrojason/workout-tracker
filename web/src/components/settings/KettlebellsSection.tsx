"use client";

import { useState } from "react";
import type { UserEquipmentConfig } from "@/lib/types";
import { cleanWeight } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

const COMMON_KETTLEBELLS = [5, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 44, 45, 53, 62, 70, 80];

export function KettlebellsSection({ config, onChange }: Props) {
  const [customInput, setCustomInput] = useState("");

  function toggle(weight: number) {
    const current = config.kettlebells;
    const updated = current.includes(weight)
      ? current.filter((w) => w !== weight)
      : [...current, weight].sort((a, b) => a - b);
    onChange({ kettlebells: updated });
  }

  function addCustom() {
    const val = parseFloat(customInput);
    if (!val || val <= 0 || config.kettlebells.includes(val)) {
      setCustomInput("");
      return;
    }
    const updated = [...config.kettlebells, val].sort((a, b) => a - b);
    onChange({ kettlebells: updated });
    setCustomInput("");
  }

  const allWeights = [...new Set([...COMMON_KETTLEBELLS, ...config.kettlebells])].sort((a, b) => a - b);

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Kettlebells</h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {allWeights.map((weight) => (
            <button
              key={weight}
              onClick={() => toggle(weight)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                config.kettlebells.includes(weight)
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {cleanWeight(weight)} lb
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Custom weight"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={addCustom}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
          >
            Add
          </button>
        </div>
      </div>
    </section>
  );
}
