import { DEFAULT_PLATES } from "@/lib/equipment-calculator";
import type { UserEquipmentConfig } from "@/lib/types";
import { cleanWeight } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

export function PlatesSection({ config, onChange }: Props) {
  function setCount(weight: number, totalOwned: number) {
    // Rebuild from DEFAULT_PLATES (not config.plates) so every canonical
    // denomination is present and editable, even if it was missing from a
    // previously-saved config — mapping over config.plates alone would
    // silently no-op for a denomination that isn't in it yet.
    const updated = DEFAULT_PLATES.map(({ weight: w }) => {
      if (w === weight) return { weight: w, totalOwned };
      return config.plates.find((p) => p.weight === w) ?? { weight: w, totalOwned: 0 };
    });
    onChange({ plates: updated });
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
        Weight Plates
      </h2>
      <p className="text-xs text-gray-500 mb-3">Total plates owned (both sides combined)</p>
      <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
        {DEFAULT_PLATES.map(({ weight }) => {
          const entry = config.plates.find((p) => p.weight === weight) ?? { weight, totalOwned: 0 };
          return (
            <div key={weight} className={`px-4 py-3 flex justify-between items-center ${entry.totalOwned === 0 ? "opacity-40" : ""}`}>
              <span className="font-medium">{cleanWeight(weight)} lb</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCount(weight, Math.max(0, entry.totalOwned - 1))}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-lg font-bold transition"
                  aria-label={`Decrease ${weight} lb plates`}
                >
                  −
                </button>
                <span className="w-6 text-center font-mono">{entry.totalOwned}</span>
                <button
                  onClick={() => setCount(weight, entry.totalOwned + 1)}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-lg font-bold transition"
                  aria-label={`Increase ${weight} lb plates`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
