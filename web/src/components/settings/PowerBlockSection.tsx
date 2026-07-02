import type { UserEquipmentConfig } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

export function PowerBlockSection({ config, onChange }: Props) {
  const { powerBlock } = config;

  function setPowerBlock(patch: Partial<UserEquipmentConfig["powerBlock"]>) {
    onChange({ powerBlock: { ...powerBlock, ...patch } });
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">PowerBlock</h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="font-medium">Adjustable Dumbbells</span>
          <button
            onClick={() => setPowerBlock({ owned: !powerBlock.owned })}
            className={`w-12 h-7 rounded-full transition relative ${
              powerBlock.owned ? "bg-indigo-600" : "bg-gray-700"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                powerBlock.owned ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {powerBlock.owned && (
          <>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-400">Min weight (lbs)</span>
              <input
                type="number"
                min={2.5}
                step={2.5}
                value={powerBlock.minLbs}
                onChange={(e) => {
                  const minLbs = parseFloat(e.target.value) || 5;
                  setPowerBlock({ minLbs: Math.min(minLbs, powerBlock.maxLbs) });
                }}
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-right"
              />
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-400">Max weight (lbs)</span>
              <input
                type="number"
                min={2.5}
                step={2.5}
                value={powerBlock.maxLbs}
                onChange={(e) => {
                  const maxLbs = parseFloat(e.target.value) || 50;
                  setPowerBlock({ maxLbs: Math.max(maxLbs, powerBlock.minLbs) });
                }}
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-right"
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
