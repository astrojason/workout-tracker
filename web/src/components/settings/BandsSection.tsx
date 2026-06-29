import type { UserEquipmentConfig, BandColor } from "@/lib/types";
import { ALL_BAND_COLORS } from "@/lib/types";

interface Props {
  config: UserEquipmentConfig;
  onChange: (patch: Partial<UserEquipmentConfig>) => void;
}

const BAND_RANGES: Record<BandColor, string> = {
  Orange: "2–12 lbs",
  Purple: "5–35 lbs",
  Red: "10–50 lbs",
  Blue: "20–80 lbs",
  Green: "50–120 lbs",
  Black: "60–150 lbs",
};

const BAND_COLORS: Record<BandColor, string> = {
  Orange: "bg-orange-500",
  Purple: "bg-purple-500",
  Red: "bg-red-500",
  Blue: "bg-blue-500",
  Green: "bg-green-500",
  Black: "bg-gray-800 border border-gray-600",
};

export function BandsSection({ config, onChange }: Props) {
  function toggle(color: BandColor) {
    const current = config.bands;
    const updated = current.includes(color)
      ? current.filter((c) => c !== color)
      : [...current, color];
    // Preserve canonical order
    onChange({ bands: ALL_BAND_COLORS.filter((c) => updated.includes(c)) });
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
        Serious Steel Bands
      </h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
        {ALL_BAND_COLORS.map((color) => (
          <label key={color} className="px-4 py-3 flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.bands.includes(color)}
              onChange={() => toggle(color)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${BAND_COLORS[color]}`} />
            <span className="font-medium flex-1">{color}</span>
            <span className="text-sm text-gray-500">{BAND_RANGES[color]}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
