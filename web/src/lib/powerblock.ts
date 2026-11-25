// Reading the adjustable dumbbells' weights as typed in Equipment settings.
export type PowerBlockWeightsResult = { ok: true; weights: number[] } | { ok: false; error: string };

export function parsePowerBlockWeights(text: string): PowerBlockWeightsResult {
  const parts = text.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Enter the weights your dumbbells can be set to, e.g. 5, 7.5, 10." };
  const weights: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `"${p}" isn't a weight. Use numbers in lb, separated by commas.` };
    weights.push(n);
  }
  return { ok: true, weights: [...new Set(weights)].sort((a, b) => a - b) };
}
