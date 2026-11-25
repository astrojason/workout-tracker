"use client";

import { useEffect, useId, useState } from "react";
import type { UserEquipmentConfig } from "@/lib/types";
import { powerBlockWeights } from "@/lib/equipment-calculator";
import { parsePowerBlockWeights } from "@/lib/powerblock";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

export function PowerBlockSection({ config, onChange }: Props) {
  const { powerBlock } = config;

  function setPowerBlock(patch: Partial<UserEquipmentConfig["powerBlock"]>) {
    onChange({ powerBlock: { ...powerBlock, ...patch } });
  }

  // The weights as typed. A valid list goes straight into the equipment (min and max kept in step
  // for older readers); an invalid one is pointed out and leaves the equipment as it was.
  const weightsId = useId();
  const weights = powerBlockWeights(config);
  const weightsKey = weights.join(",");
  const [text, setText] = useState(weights.join(", "));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Saved or discarded elsewhere: show the weights now in effect, unless that's what's typed.
    const typed = parsePowerBlockWeights(text);
    if (!typed.ok || typed.weights.join(",") !== weightsKey) { setText(weightsKey.split(",").join(", ")); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightsKey]);

  function onWeightsText(value: string) {
    setText(value);
    const parsed = parsePowerBlockWeights(value);
    if (!parsed.ok) { setError(parsed.error); return; }
    setError(null);
    if (parsed.weights.join(",") !== weightsKey) {
      setPowerBlock({ weights: parsed.weights, minLbs: parsed.weights[0], maxLbs: parsed.weights[parsed.weights.length - 1] });
    }
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
          <div className="px-4 py-3">
            <label htmlFor={weightsId} className="text-sm text-gray-400 block mb-1">Adjustable dumbbell weights (lb)</label>
            <input
              id={weightsId}
              type="text"
              inputMode="decimal"
              value={text}
              onChange={(e) => onWeightsText(e.target.value)}
              aria-invalid={error !== null}
              aria-describedby={`${weightsId}-help`}
              className="input-field"
            />
            {error
              ? <p role="alert" className="mt-1 text-xs text-red-400">{error}</p>
              : <p id={`${weightsId}-help`} className="mt-1 text-xs text-gray-500">Every weight a dumbbell can be set to, separated by commas, like a machine&apos;s stack. Uneven steps are fine.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
