"use client";

import type { UserEquipmentConfig } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

const BARBELLS = [
  { key: "has45lb" as const, label: "Olympic Bar", weight: "45 lb" },
  { key: "has35lb" as const, label: "35 lb Bar", weight: "35 lb" },
  { key: "hasEZBar" as const, label: "EZ Bar", weight: "15 lb" },
];

export function BarbellSection({ config, onChange }: Props) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Barbells</h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
        {BARBELLS.map(({ key, label, weight }) => (
          <div key={key} className="px-4 py-3 flex justify-between items-center">
            <div>
              <span className="font-medium">{label}</span>
              <span className="text-sm text-gray-500 ml-2">{weight}</span>
            </div>
            <button
              onClick={() => onChange({ barbells: { ...config.barbells, [key]: !config.barbells[key] } })}
              className={`w-12 h-7 rounded-full transition relative ${
                config.barbells[key] ? "bg-indigo-600" : "bg-gray-700"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                  config.barbells[key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
