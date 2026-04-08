import * as XLSX from "xlsx";
import type {
  Exercise, Program, Workout, Phase, EquipmentType,
  ProgressionRule, RepTarget,
} from "./types";
import { PHASE_ORDER } from "./types";

// Sheet names that map to days of the week
const DAY_OF_WEEK_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

const VALID_PHASES = new Set<Phase>(["warmup", "main", "finisher", "cooldown", "mobility"]);
const VALID_EQUIPMENT: Set<string> = new Set([
  "barbell_45", "barbell_35", "barbell_ez", "powerblock",
  "band", "kettlebell", "bodyweight", "assisted_pullup", "gripper",
]);

// ── Column name mapping ──────────────────────────────────────────────────────
//
// The XLSX uses human-readable column headers that differ from the CSV spec:
//   "Week"          → week
//   "Phase"         → phase
//   "Order"         → exercise_order
//   "Exercise"      → exercise_name
//   "Equip Category"→ equipment_category (display only, not stored)
//   "Equip Type"    → equipment_type
//   "Equip Detail"  → equipment_detail
//   "Total Weight"  → totalWeight (seeds progressive starting weight when > 0)
//   "Sets"          → sets
//   "Rep Min"       → rep_min
//   "Rep Max"       → rep_max
//   "Rest (s)"      → rest_seconds
//   "Rest After"    → rest_after (FALSE = no rest; number/string = seconds)
//   "Progression"   → progression_rule
//   "Unilateral"    → unilateral
//   "Last Set AMRAP"→ last_set_amrap
//   "Notes"         → notes
//
// There is no program_name column; the program name is passed as a parameter.
// There is no base_weight column; all exercises use progressive weight resolution.
// totalWeight > 0 seeds the first-session weight when no history exists.

// ── rest_after parsing ───────────────────────────────────────────────────────
// Returns false (no rest), a number of seconds, or undefined (fall back to rest_seconds).
function parseRestAfter(value: unknown): false | number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value ? undefined : false;
  const str = String(value).trim();
  if (str.toUpperCase() === "FALSE") return false;
  const num = Number(str);
  if (!isNaN(num) && str !== "") return num;
  // "90s"
  const sMatch = str.match(/^(\d+)s$/i);
  if (sMatch) return parseInt(sMatch[1]);
  // "2m"
  const mMatch = str.match(/^(\d+)m$/i);
  if (mMatch) return parseInt(mMatch[1]) * 60;
  // "2:30"
  const mmssMatch = str.match(/^(\d+):(\d+)$/);
  if (mmssMatch) return parseInt(mmssMatch[1]) * 60 + parseInt(mmssMatch[2]);
  return undefined;
}

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toUpperCase() === "TRUE";
  return false;
}

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function parseString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

// ── Phase sort ───────────────────────────────────────────────────────────────

function phaseIndex(phase: Phase): number {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx === -1 ? PHASE_ORDER.length : idx;
}

// ── Row parser ───────────────────────────────────────────────────────────────

interface ParsedRow {
  week: number;
  day: string;
  exercise: Exercise;
}

function parseRow(row: Record<string, unknown>, rowNum: number, sheetDay: string): ParsedRow {
  const weekRaw = parseNumber(row["Week"]);
  if (weekRaw === null) throw new Error(`Row ${rowNum}: invalid Week '${row["Week"]}'`);

  const phaseStr = parseString(row["Phase"]).toLowerCase() as Phase;
  if (!VALID_PHASES.has(phaseStr)) throw new Error(`Row ${rowNum}: invalid Phase '${row["Phase"]}'`);

  const orderRaw = parseNumber(row["Order"]);
  if (orderRaw === null) throw new Error(`Row ${rowNum}: invalid Order '${row["Order"]}'`);

  const name = parseString(row["Exercise"]);
  if (!name) throw new Error(`Row ${rowNum}: missing Exercise name`);

  const equipmentType = parseString(row["Equip Type"]) as EquipmentType;
  if (!VALID_EQUIPMENT.has(equipmentType)) {
    throw new Error(`Row ${rowNum}: invalid Equip Type '${row["Equip Type"]}'`);
  }

  const equipmentDetail = parseString(row["Equip Detail"]) || null;

  // Total Weight: used as totalWeight field to seed progressive starting weight.
  // All exercises use progressive weight resolution (history-based).
  const totalWeightRaw = parseNumber(row["Total Weight"]);
  const totalWeight = totalWeightRaw !== null && totalWeightRaw > 0 ? totalWeightRaw : undefined;

  const sets = parseNumber(row["Sets"]) ?? 0;
  const repMin = parseNumber(row["Rep Min"]) ?? 0;

  const repMaxRaw = parseString(row["Rep Max"]);
  const repMax: RepTarget = repMaxRaw.toLowerCase() === "failure"
    ? { type: "failure" }
    : { type: "count", value: parseInt(repMaxRaw) || repMin };

  // last_set_amrap: TRUE = final set is AMRAP
  const lastSetAmrap = parseBool(row["Last Set AMRAP"]) || undefined;

  const restSeconds = parseNumber(row["Rest (s)"]) ?? 0;

  // rest_after: FALSE = suppress timer; number/time string = override seconds
  // Warmup exercises always get restAfter=false when column is absent
  let restAfter: false | number | undefined = parseRestAfter(row["Rest After"]);
  if (phaseStr === "warmup" && restAfter === undefined) {
    restAfter = false;
  }

  const progressionRule: ProgressionRule = parseString(row["Progression"]) || "none";
  const isUnilateral = parseBool(row["Unilateral"]);
  const notes = parseString(row["Notes"]) || null;

  const exercise: Exercise = {
    id: crypto.randomUUID(),
    order: orderRaw,
    name,
    phase: phaseStr,
    equipmentType,
    equipmentDetail,
    baseWeight: { type: "fixed", value: totalWeight ?? 0 },
    sets,
    repMin,
    repMax,
    restSeconds,
    progressionRule,
    isUnilateral,
    notes,
    ...(totalWeight !== undefined ? { totalWeight } : {}),
    ...(lastSetAmrap ? { lastSetAmrap: true } : {}),
    ...(restAfter !== undefined ? { restAfter } : {}),
  };

  return { week: weekRaw, day: sheetDay, exercise };
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseXLSX(
  data: ArrayBuffer | Uint8Array | Buffer,
  programName = "Reacher Build"
): { programs: Omit<Program, "createdAt">[]; workouts: Workout[] } {
  const workbook = XLSX.read(data, { type: "array" });

  let maxWeek = 0;
  const workoutMap = new Map<string, { week: number; day: string; exercises: Exercise[] }>();

  for (const sheetName of workbook.SheetNames) {
    if (!DAY_OF_WEEK_NAMES.includes(sheetName)) continue;

    const sheet = workbook.Sheets[sheetName];
    // raw: true preserves booleans as booleans, numbers as numbers
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true,
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Skip blank/divider rows
      if (!row["Exercise"] || String(row["Exercise"]).trim() === "") continue;

      let parsed: ParsedRow;
      try {
        parsed = parseRow(row, i + 2, sheetName); // +2: 1-indexed, row 1 is header
      } catch (err) {
        throw new Error(`Sheet '${sheetName}': ${(err as Error).message}`);
      }

      const { week, day, exercise } = parsed;
      if (week > maxWeek) maxWeek = week;

      const key = `${programName}_${week}_${day}`;
      const wk = workoutMap.get(key);
      if (wk) {
        wk.exercises.push(exercise);
      } else {
        workoutMap.set(key, { week, day, exercises: [exercise] });
      }
    }
  }

  const programs: Omit<Program, "createdAt">[] = [
    {
      id: programName.toLowerCase().replace(/\s+/g, "-"),
      name: programName,
      totalWeeks: maxWeek || 1,
    },
  ];

  const workouts: Workout[] = [];
  for (const [key, data] of workoutMap) {
    // Sort: phase order (warmup → main → finisher), then exercise Order within phase.
    data.exercises.sort((a, b) => {
      const pDiff = phaseIndex(a.phase) - phaseIndex(b.phase);
      if (pDiff !== 0) return pDiff;
      return a.order - b.order;
    });

    // Re-assign order as a globally unique 1-N index within this workout.
    data.exercises.forEach((e, i) => { e.order = i + 1; });

    workouts.push({
      id: key.toLowerCase().replace(/\s+/g, "-"),
      programName,
      week: data.week,
      dayOfWeek: data.day,
      exercises: data.exercises,
      isChecklist: data.day === "Daily",
    });
  }

  return {
    programs,
    workouts,
  };
}
