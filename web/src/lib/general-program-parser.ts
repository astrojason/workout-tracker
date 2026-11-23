import * as XLSX from "xlsx";
import type { EquipmentType, Phase, Program, ProgressionRule, RepTarget } from "./types";
import type { ParsedExercise, ParsedWorkout } from "./exercise-import";

// "General" program workbooks: one sheet per weekday, a free-text table per sheet and no
// Week / Phase / Equip columns. Example row layout (header on row 3):
//
//   Exercise            | Sets | Reps / Time | Weight   | Notes
//   Lat Pulldown        | 2+1  | 10          | 42.5 lb  | Last set AMRAP
//   Lat Pulldown (AMRAP)| 1    | AMRAP       | 42.5 lb  | Log reps; +weight when AMRAP >13
//
// The sheet's second line ("LVAC · Back + Chest · ~45 min") names the location; the
// first segment decides whether lb weights are machines (a gym) or free weights (Home).
// A general program is a single repeating week, so it always has totalWeeks = 1.

export const GENERAL_DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

type Cell = unknown;

function text(value: Cell): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

const PLACEHOLDER = /^[—–-]*$/; // "", "-", "—"

// ── Sets ─────────────────────────────────────────────────────────────────────

function parseSets(raw: Cell): { sets: number; lastSetAmrap: boolean } {
  const s = text(raw);
  if (PLACEHOLDER.test(s)) return { sets: 1, lastSetAmrap: false };
  const plus = s.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (plus) return { sets: parseInt(plus[1]) + parseInt(plus[2]), lastSetAmrap: true };
  if (/^\d+$/.test(s)) return { sets: parseInt(s), lastSetAmrap: false };
  throw new Error(`invalid Sets '${s}' (expected a number or 'N+1')`);
}

// ── Reps / time ──────────────────────────────────────────────────────────────

interface RepSpec {
  repMin: number;
  repMax: RepTarget;
  timed: boolean;
  amrap: boolean; // the cell itself says AMRAP / Max (to failure)
  note?: string;  // detail the numeric target can't carry, e.g. "30 ft"
}

function parseReps(raw: Cell): RepSpec {
  const s = text(raw);
  const lower = s.toLowerCase();
  if (PLACEHOLDER.test(s)) return { repMin: 1, repMax: { type: "count", value: 1 }, timed: false, amrap: false };
  if (typeof raw === "number") return { repMin: raw, repMax: { type: "count", value: raw }, timed: false, amrap: false };

  if (/^max\s+hold$|^hold\s+max$/.test(lower)) {
    return { repMin: 30, repMax: { type: "failure" }, timed: true, amrap: true };
  }
  if (/^(amrap|max|failure)$/.test(lower)) {
    return { repMin: 1, repMax: { type: "failure" }, timed: false, amrap: true };
  }
  const min = lower.match(/^(\d+(?:\.\d+)?)\s*(?:min|mins|minutes?)\b/);
  if (min) {
    const secs = Math.round(parseFloat(min[1]) * 60);
    return { repMin: secs, repMax: { type: "count", value: secs }, timed: true, amrap: false };
  }
  const sec = lower.match(/^(\d+)\s*(?:s|secs?|seconds?)\b/);
  if (sec) {
    const secs = parseInt(sec[1]);
    return { repMin: secs, repMax: { type: "count", value: secs }, timed: true, amrap: false };
  }
  const range = lower.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) {
    return { repMin: parseInt(range[1]), repMax: { type: "count", value: parseInt(range[2]) }, timed: false, amrap: false };
  }
  if (/^\d+$/.test(lower)) {
    const n = parseInt(lower);
    return { repMin: n, repMax: { type: "count", value: n }, timed: false, amrap: false };
  }
  // A count with a unit, e.g. "30 ft": keep the number as the target and the text as a note.
  const unit = lower.match(/^(\d+)\s*[a-z]+\b/);
  if (unit) {
    const n = parseInt(unit[1]);
    return { repMin: n, repMax: { type: "count", value: n }, timed: false, amrap: false, note: s };
  }
  throw new Error(`invalid Reps / Time '${s}'`);
}

// ── Weight → equipment ───────────────────────────────────────────────────────

interface WeightSpec {
  equipmentType: EquipmentType;
  seedWeight?: number;
  note?: string;
}

function parseWeight(raw: Cell, ctx: { name: string; notes: string; isHome: boolean }): WeightSpec {
  const s = text(raw);
  const lower = s.toLowerCase();
  if (PLACEHOLDER.test(s) || lower === "bw" || lower === "bodyweight") return { equipmentType: "bodyweight" };

  const bands = lower.match(/^(\d+(?:\.\d+)?)\s*bands?$/);
  if (bands) return { equipmentType: "assisted_pullup", seedWeight: parseFloat(bands[1]) };

  if (/^loop\s*band/.test(lower)) return { equipmentType: "loop_band" };

  const lb = lower.match(/^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b\s*(.*)$/);
  if (lb) {
    const weight = parseFloat(lb[1]);
    const tail = lb[2];
    const hay = `${ctx.name} ${ctx.notes}`.toLowerCase();
    let equipmentType: EquipmentType;
    if (/^(kb|kettlebell)/.test(tail) || /\b(kb|kettlebell)\b/.test(ctx.name.toLowerCase())) equipmentType = "kettlebell";
    else if (/\bez\b/.test(hay)) equipmentType = "barbell_ez";
    else if (/barbell|landmine|deadlift|hip thrust/.test(hay)) equipmentType = "barbell_45";
    else if (!ctx.isHome) equipmentType = "machine";
    else if (weight > 50) equipmentType = "barbell_45";
    else if (weight >= 5) equipmentType = "powerblock";
    else equipmentType = "dumbbell";
    return { equipmentType, seedWeight: weight };
  }

  // Unrecognised: never drop it silently — keep the original text visible in the notes.
  return { equipmentType: "bodyweight", note: `Weight: ${s}` };
}

function progressionFor(equipmentType: EquipmentType, hasAmrap: boolean, companionNotes: string): ProgressionRule {
  if (!hasAmrap) return "none";
  switch (equipmentType) {
    case "machine":
    case "kettlebell":
      return "add_weight";
    case "barbell_45":
    case "barbell_35":
      return "add_5lb";
    case "barbell_ez":
    case "powerblock":
      return "add_2.5lb";
    case "assisted_pullup":
      return /drop a band/i.test(companionNotes) ? "reduce_assistance" : "none";
    default:
      return "none";
  }
}

// ── Notes ────────────────────────────────────────────────────────────────────

function notePieces(raw: string): string[] {
  return raw
    .split(/\s*[·;]\s*/)
    .map((p) => p.trim())
    .filter((p) => p && !/^last set amrap$/i.test(p) && !/^log reps$/i.test(p));
}

// ── Sheet parser ─────────────────────────────────────────────────────────────

const AMRAP_SUFFIX = /\s*\(amrap\)\s*$/i;

function parseDaySheet(sheetName: string, sheet: XLSX.WorkSheet): ParsedExercise[] {
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: "", raw: true });

  const headerIdx = rows.findIndex((r) => text(r[0]).toLowerCase() === "exercise");
  if (headerIdx === -1) {
    throw new Error(`Sheet '${sheetName}': no header row with an 'Exercise' column`);
  }
  const header = rows[headerIdx].map((c) => text(c).toLowerCase());
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix));
  const cSets = col("sets");
  const cReps = col("reps");
  const cWeight = col("weight");
  const cNotes = col("notes");
  if (cSets === -1 || cReps === -1 || cWeight === -1) {
    throw new Error(`Sheet '${sheetName}': header needs 'Sets', 'Reps / Time' and 'Weight' columns`);
  }

  // Location is the first segment of the line under the title: "LVAC · Back + Chest · ~45 min".
  const locationLine = headerIdx >= 2 ? text(rows[1][0]) : "";
  const location = locationLine.split(/[·•]/)[0].trim();
  const isHome = /^home$/i.test(location);

  const exercises: ParsedExercise[] = [];
  let previousHadAmrapSet = false;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = text(row[0]);
    if (!name || name.startsWith("■")) continue;
    const rowNum = i + 1; // sheet_to_json starts at A1, so index + 1 is the spreadsheet row

    try {
      const rowNotes = cNotes === -1 ? "" : text(row[cNotes]);
      const setsInfo = parseSets(row[cSets]);
      const reps = parseReps(row[cReps]);

      // "(AMRAP)" companion row directly after an "N+1" row: it records the same final set
      // plus the progression trigger, so fold its notes into the exercise instead of duplicating it.
      if (AMRAP_SUFFIX.test(name) && reps.amrap && previousHadAmrapSet && exercises.length > 0) {
        const base = exercises[exercises.length - 1];
        const merged = new Set([...notePieces(base.notes ?? ""), ...notePieces(rowNotes)]);
        base.notes = merged.size ? [...merged].join(" · ") : null;
        base.progressionRule = progressionFor(base.equipmentType, true, rowNotes);
        previousHadAmrapSet = false;
        continue;
      }

      const exerciseName = name.replace(AMRAP_SUFFIX, "").trim();
      const weight = parseWeight(row[cWeight], { name: exerciseName, notes: rowNotes, isHome });
      const hasAmrapSet = setsInfo.lastSetAmrap || reps.amrap;

      const pieces = [...notePieces(rowNotes)];
      if (reps.note) pieces.push(reps.note);
      if (weight.note) pieces.push(weight.note);
      const notes = pieces.length ? [...new Set(pieces)].join(" · ") : null;

      const phase: Phase = /warm-?up|activation/i.test(rowNotes) ? "warmup" : "main";
      const restMatch = rowNotes.match(/(\d+)\s*s(?:ec)?\s+rest/i);
      const restSeconds = restMatch ? parseInt(restMatch[1]) : phase === "warmup" ? 30 : 90;

      const exercise: ParsedExercise = {
        order: exercises.length + 1,
        name: exerciseName,
        phase,
        equipmentType: weight.equipmentType,
        equipmentDetail: null,
        sets: setsInfo.sets,
        repMin: reps.repMin,
        repMax: reps.repMax,
        restSeconds,
        progressionRule: progressionFor(weight.equipmentType, setsInfo.lastSetAmrap, ""),
        isUnilateral: false,
        isTimeBased: reps.timed,
        notes,
        ...(weight.seedWeight !== undefined ? { seedWeight: weight.seedWeight } : {}),
        ...(setsInfo.lastSetAmrap ? { lastSetAmrap: true } : {}),
        ...(phase === "warmup" ? { restAfter: false as const } : {}),
      };
      exercises.push(exercise);
      previousHadAmrapSet = hasAmrapSet && setsInfo.lastSetAmrap;
    } catch (err) {
      throw new Error(`Sheet '${sheetName}': Row ${rowNum}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return exercises;
}

/** True when any day sheet has the weekly-cycle columns (Week + Exercise on one header row). */
export function isWeeklyCycleWorkbook(workbook: XLSX.WorkBook): boolean {
  for (const name of workbook.SheetNames) {
    if (!GENERAL_DAY_NAMES.includes(name)) continue;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[name], { header: 1, defval: "", raw: true });
    const header = (rows[0] ?? []).map((c) => text(c).toLowerCase());
    if (header.includes("week") && header.includes("exercise")) return true;
  }
  return false;
}

export function parseGeneralProgram(
  workbook: XLSX.WorkBook,
  programName: string,
): { programs: Omit<Program, "createdAt">[]; workouts: ParsedWorkout[] } {
  const programId = programName.toLowerCase().replace(/\s+/g, "-");
  const workouts: ParsedWorkout[] = [];

  for (const day of GENERAL_DAY_NAMES) {
    const sheet = workbook.Sheets[day];
    if (!sheet) continue;
    const exercises = parseDaySheet(day, sheet);
    if (exercises.length === 0) continue;
    workouts.push({
      id: `${programName}_1_${day}`.toLowerCase().replace(/\s+/g, "-"),
      programId,
      programName,
      week: 1,
      dayOfWeek: day,
      exercises,
    });
  }

  if (workouts.length === 0) {
    throw new Error(
      "No workouts found: expected sheets named Monday–Sunday, each with an 'Exercise' header row.",
    );
  }

  return { programs: [{ id: programId, name: programName, totalWeeks: 1 }], workouts };
}
