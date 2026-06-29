"use client";

import { useState } from "react";
import type { UserEquipmentConfig } from "@/lib/types";
import { cleanWeight } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

export function FixedDumbbellsSection({ config, onChange }: Props) {
  const [input, setInput] = useState("");

  function remove(weight: number) {
    onChange({ fixedDumbbells: config.fixedDumbbells.filter((w) => w !== weight) });
  }

  function add() {
    const val = parseFloat(input);
    if (!val || val <= 0 || config.fixedDumbbells.includes(val)) {
      setInput("");
      return;
    }
    const updated = [...config.fixedDumbbells, val].sort((a, b) => a - b);
    onChange({ fixedDumbbells: updated });
    setInput("");
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
        Fixed Dumbbells
      </h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {config.fixedDumbbells.length === 0 && (
            <span className="text-sm text-gray-500">None added</span>
          )}
          {config.fixedDumbbells.map((weight) => (
            <div
              key={weight}
              className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-3 py-1.5 text-sm"
            >
              <span>{cleanWeight(weight)} lb</span>
              <button
                onClick={() => remove(weight)}
                className="text-gray-500 hover:text-red-400 transition"
                aria-label={`Remove ${weight} lb dumbbell`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Weight (lbs)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={add}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
          >
            Add
          </button>
        </div>
      </div>
    </section>
  );
}
