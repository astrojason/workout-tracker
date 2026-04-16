import type {
  Exercise, Program, Workout, Phase, EquipmentType,
  ProgressionRule, WeightSpec, RepTarget,
} from "./types";

const EXPECTED_HEADERS = [
  "program_name", "week", "day_of_week", "phase", "exercise_order",
  "exercise_name", "equipment_type", "equipment_detail", "base_weight",
  "sets", "rep_min", "rep_max", "rest_seconds", "progression_rule",
  "unilateral", "notes",
];

const VALID_PHASES = new Set<Phase>(["warmup", "main", "finisher", "cooldown", "mobility"]);
const VALID_EQUIPMENT: Set<string> = new Set([
  "barbell_45", "barbell_35", "barbell_ez", "powerblock",
  "band", "kettlebell", "bodyweight", "assisted_pullup", "gripper",
]);
// Known keyword rules — any other non-empty string is treated as a free-form progression rule
const KEYWORD_PROGRESSIONS: Set<string> = new Set([
  "add_5lb", "add_2.5lb", "add_10lb",
  "add_reps", "add_time", "add_rounds",
  "maintain", "deload", "progress_gripper", "none",
]);

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseCSV(csvString: string): { programs: Omit<Program, "createdAt">[]; workouts: Workout[] } {
  const lines = csvString
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) throw new Error("CSV file is empty");

  // Validate header
  const headerCols = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (i >= headerCols.length || headerCols[i] !== EXPECTED_HEADERS[i]) {
      throw new Error(`Invalid header: expected '${EXPECTED_HEADERS[i]}' at column ${i + 1}`);
    }
  }

  // Parse rows
  interface RawRow {
    programName: string;
    week: number;
    day: string;
    exercise: Exercise;
  }

  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]).map((c) => c.trim());
    if (cols.length < EXPECTED_HEADERS.length) {
      throw new Error(`Line ${i + 1}: expected ${EXPECTED_HEADERS.length} columns, got ${cols.length}`);
    }

    const programName = cols[0];
    const week = parseInt(cols[1]);
    if (isNaN(week)) throw new Error(`Line ${i + 1}: invalid week '${cols[1]}'`);

    const day = cols[2];
    const phase = cols[3].toLowerCase() as Phase;
    if (!VALID_PHASES.has(phase)) throw new Error(`Line ${i + 1}: invalid phase '${cols[3]}'`);

    const order = parseInt(cols[4]);
    if (isNaN(order)) throw new Error(`Line ${i + 1}: invalid order '${cols[4]}'`);

    const name = cols[5];
    const equipmentType = cols[6] as EquipmentType;
    if (!VALID_EQUIPMENT.has(equipmentType)) throw new Error(`Line ${i + 1}: invalid equipment '${cols[6]}'`);

    const equipmentDetail = cols[7] || null;

    const baseWeight: WeightSpec = cols[8].toLowerCase() === "progressive"
      ? { type: "progressive" }
      : { type: "fixed", value: parseFloat(cols[8]) || 0 };

    const sets = parseInt(cols[9]) || 0;
    const repMin = parseInt(cols[10]) || 0;

    const repMax: RepTarget = cols[11].toLowerCase() === "failure"
      ? { type: "failure" }
      : { type: "count", value: parseInt(cols[11]) || 0 };

    const restSeconds = parseInt(cols[12]) || 0;

    // Known keywords are accepted as-is; any other non-empty string is a free-form rule
    const progressionRule: ProgressionRule = cols[13] || "none";

    const isUnilateral = cols[14].toUpperCase() === "TRUE";
    const notes = cols.length > 15 && cols[15] ? cols[15] : null;

    rows.push({
      programName,
      week,
      day,
      exercise: {
        id: crypto.randomUUID(),
        order,
        name,
        phase,
        equipmentType,
        equipmentDetail,
        baseWeight,
        sets,
        repMin,
        repMax,
        restSeconds,
        progressionRule,
        isUnilateral,
        isTimeBased: progressionRule === "add_time" || repMin >= 30,
        notes,
      },
    });
  }

  // Group into programs and workouts
  const programMap = new Map<string, { maxWeek: number }>();
  const workoutMap = new Map<string, { programName: string; week: number; day: string; exercises: Exercise[] }>();

  for (const row of rows) {
    const existing = programMap.get(row.programName);
    if (!existing || row.week > existing.maxWeek) {
      programMap.set(row.programName, { maxWeek: row.week });
    }

    const key = `${row.programName}_${row.week}_${row.day}`;
    const wk = workoutMap.get(key);
    if (wk) {
      wk.exercises.push(row.exercise);
    } else {
      workoutMap.set(key, {
        programName: row.programName,
        week: row.week,
        day: row.day,
        exercises: [row.exercise],
      });
    }
  }

  const programs: Omit<Program, "createdAt">[] = [];
  for (const [name, data] of programMap) {
    programs.push({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      totalWeeks: data.maxWeek,
    });
  }

  const workouts: Workout[] = [];
  for (const [key, data] of workoutMap) {
    data.exercises.sort((a, b) => a.order - b.order);
    workouts.push({
      id: key.toLowerCase().replace(/\s+/g, "-"),
      programName: data.programName,
      week: data.week,
      dayOfWeek: data.day,
      exercises: data.exercises,
      isChecklist: data.day === "Daily",
    });
  }

  return { programs: programs.sort((a, b) => a.name.localeCompare(b.name)), workouts };
}
