import type { BodyMeasurementDoc, BodyMeasurementInput } from "./types";

// Body measurement definitions (shared by History's body metrics and the Body page) and the
// numbers the desktop Body page reports.

export type MetricKey = keyof Omit<BodyMeasurementInput, "date">;

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: "lbs" | "in" | "%" | "bpm" | "kcal" | "years" | "";
  inputLabel: string;
}

export const CIRCUMFERENCE_METRICS: MetricDefinition[] = [
  { key: "chest", label: "Chest", unit: "in", inputLabel: "Chest (in)" },
  { key: "waist", label: "Waist", unit: "in", inputLabel: "Waist (in)" },
  { key: "hips", label: "Hips", unit: "in", inputLabel: "Hips (in)" },
  { key: "rightBicep", label: "Right bicep", unit: "in", inputLabel: "Right bicep (in)" },
  { key: "leftBicep", label: "Left bicep", unit: "in", inputLabel: "Left bicep (in)" },
  { key: "rightThigh", label: "Right thigh", unit: "in", inputLabel: "Right thigh (in)" },
  { key: "leftThigh", label: "Left thigh", unit: "in", inputLabel: "Left thigh (in)" },
  { key: "rightCalf", label: "Right calf", unit: "in", inputLabel: "Right calf (in)" },
  { key: "leftCalf", label: "Left calf", unit: "in", inputLabel: "Left calf (in)" },
];

// Superseded by the left/right measurements; kept so older check-ins still display and chart.
export const LEGACY_METRICS: MetricDefinition[] = [
  { key: "arm", label: "Arm", unit: "in", inputLabel: "Arm (in)" },
  { key: "thigh", label: "Thigh", unit: "in", inputLabel: "Thigh (in)" },
];

export const SMART_SCALE_METRICS: MetricDefinition[] = [
  { key: "bodyFatPercentage", label: "Body fat", unit: "%", inputLabel: "Body fat (%)" },
  { key: "bmi", label: "BMI", unit: "", inputLabel: "BMI" },
  { key: "heartRate", label: "Heart rate", unit: "bpm", inputLabel: "Heart rate (bpm)" },
  { key: "muscleMass", label: "Muscle mass", unit: "lbs", inputLabel: "Muscle mass (lbs)" },
  { key: "boneMass", label: "Bone mass", unit: "lbs", inputLabel: "Bone mass (lbs)" },
  { key: "bodyWaterPercentage", label: "Body water", unit: "%", inputLabel: "Body water (%)" },
  { key: "visceralFat", label: "Visceral fat", unit: "", inputLabel: "Visceral fat rating" },
  { key: "proteinMass", label: "Protein mass", unit: "lbs", inputLabel: "Protein mass (lbs)" },
  { key: "bmr", label: "BMR", unit: "kcal", inputLabel: "BMR (kcal)" },
  { key: "metabolicAge", label: "Metabolic age", unit: "years", inputLabel: "Metabolic age (years)" },
  { key: "standardWeight", label: "Standard weight", unit: "lbs", inputLabel: "Standard weight (lbs)" },
  { key: "fatFreeBodyWeight", label: "Fat-free weight", unit: "lbs", inputLabel: "Fat-free weight (lbs)" },
  { key: "proteinPercentage", label: "Protein", unit: "%", inputLabel: "Protein (%)" },
  { key: "subcutaneousFatPercentage", label: "Subcutaneous fat", unit: "%", inputLabel: "Subcutaneous fat (%)" },
  { key: "skeletalMusclePercentage", label: "Skeletal muscle", unit: "%", inputLabel: "Skeletal muscle (%)" },
  { key: "waterWeight", label: "Water weight", unit: "lbs", inputLabel: "Water weight (lbs)" },
];

export const METRICS: MetricDefinition[] = [
  { key: "weight", label: "Body weight", unit: "lbs", inputLabel: "Body weight (lbs)" },
  ...CIRCUMFERENCE_METRICS,
  ...LEGACY_METRICS,
  ...SMART_SCALE_METRICS,
];

const TAPE_KEYS = new Set<MetricKey>(CIRCUMFERENCE_METRICS.map((m) => m.key));

export function metricDefinition(key: MetricKey): MetricDefinition {
  return METRICS.find((m) => m.key === key)!;
}

export function entryDate(entry: Pick<BodyMeasurementDoc, "date">): Date {
  return entry.date instanceof Date ? entry.date : entry.date.toDate();
}

function chronological(entries: BodyMeasurementDoc[]): BodyMeasurementDoc[] {
  return [...entries].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime());
}

// Tape is recorded in eighths of an inch; three decimals keeps them exact without float noise.
const round = (n: number) => Math.round(n * 1000) / 1000;

export function metricSummary(entries: BodyMeasurementDoc[], key: MetricKey): { latest: number; change: number; points: number[]; latestDate: Date } | null {
  const withValue = chronological(entries).filter((e) => typeof e[key] === "number");
  if (withValue.length === 0) return null;
  const points = withValue.map((e) => e[key] as number);
  return { latest: points[points.length - 1], change: round(points[points.length - 1] - points[0]), points, latestDate: entryDate(withValue[withValue.length - 1]) };
}

export function movingAverage(values: number[], n: number): number[] {
  return values.map((_, i) => {
    const window = values.slice(Math.max(0, i - n + 1), i + 1);
    return window.reduce((a, b) => a + b, 0) / window.length;
  });
}

export function tapeChanges(entries: BodyMeasurementDoc[]): { key: MetricKey; label: string; first: number; latest: number; change: number }[] {
  return CIRCUMFERENCE_METRICS.flatMap(({ key, label }) => {
    const s = metricSummary(entries, key);
    return s && s.points.length >= 2 ? [{ key, label, first: s.points[0], latest: s.latest, change: s.change }] : [];
  });
}

const PAIRS: { label: string; left: MetricKey; right: MetricKey }[] = [
  { label: "Bicep", left: "leftBicep", right: "rightBicep" },
  { label: "Thigh", left: "leftThigh", right: "rightThigh" },
  { label: "Calf", left: "leftCalf", right: "rightCalf" },
];

// Each left/right pair from the latest check-in that measured both sides.
export function sideDifferences(entries: BodyMeasurementDoc[]): { label: string; left: number; right: number; difference: number }[] {
  const latestFirst = chronological(entries).reverse();
  return PAIRS.flatMap(({ label, left, right }) => {
    const e = latestFirst.find((x) => typeof x[left] === "number" && typeof x[right] === "number");
    return e ? [{ label, left: e[left] as number, right: e[right] as number, difference: round((e[right] as number) - (e[left] as number)) }] : [];
  });
}

export type ParsedMeasurement = { ok: true; value: BodyMeasurementInput } | { ok: false; error: string };

// A check-in from form text: a date and at least one positive number. Blank fields are left out.
export function parseMeasurementFields(date: string, fields: Partial<Record<MetricKey, string>>): ParsedMeasurement {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Choose the date you measured" };
  const value: BodyMeasurementInput = { date: new Date(`${date}T12:00:00`) };
  for (const m of METRICS) {
    const text = fields[m.key]?.trim();
    if (!text) continue;
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `${m.label} must be a number above 0` };
    (value as unknown as Record<string, number>)[m.key] = n;
  }
  if (Object.keys(value).length === 1) return { ok: false, error: "Fill in at least one measurement" };
  return { ok: true, value };
}

export function isTapeMetric(key: MetricKey): boolean {
  return TAPE_KEYS.has(key);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// One row per check-in, oldest first, with a column for each measurement any of them has.
export function bodyCsv(entries: BodyMeasurementDoc[]): string {
  const sorted = chronological(entries);
  const columns = METRICS.filter((m) => sorted.some((e) => typeof e[m.key] === "number"));
  const lines = sorted.map((e) => [isoDate(entryDate(e)), ...columns.map((m) => (typeof e[m.key] === "number" ? String(e[m.key]) : ""))].join(","));
  return [["Date", ...columns.map((m) => m.inputLabel)].join(","), ...lines].join("\n") + "\n";
}
