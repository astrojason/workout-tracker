import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { resolve } from "path";

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), addDoc: vi.fn(),
  updateDoc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { parseXLSX } from "../xlsx-parser";

// A "general" program: one sheet per weekday, no Week/Phase/Equip columns, free-text
// sets ("2+1"), reps ("AMRAP", "5 min") and weight ("42.5 lb", "3 bands", "BW").
const HEADER = ["Exercise", "Sets", "Reps / Time", "Weight", "Notes"];

function daySheet(title: string, subtitle: string, rows: unknown[][]) {
  return XLSX.utils.aoa_to_sheet([
    [title], [subtitle], HEADER, ...rows, [""], ["■ Warmup / Activation   ■ Working set   ■ AMRAP"],
  ]);
}

function workbook(sheets: Record<string, XLSX.WorkSheet>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["PROGRAM"], ["Day", "Focus"], ["Monday", "Back"]]), "Overview");
  for (const [name, ws] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, ws, name);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

function parseDay(rows: unknown[][], subtitle = "Home · Test · 30 min") {
  const result = parseXLSX(workbook({ Monday: daySheet("MONDAY", subtitle, rows) }), "Gen");
  return result.workouts[0].exercises;
}

describe("parseXLSX - general program format", () => {
  it("produces one program, one week, and a workout per day sheet", () => {
    const buf = workbook({
      Monday: daySheet("MONDAY", "Home · A", [["Push-ups", 3, "Max", "BW", ""]]),
      Tuesday: daySheet("TUESDAY", "Home · B", [["Plank", 3, 10, "BW", ""]]),
    });
    const r = parseXLSX(buf, "General Plan");
    expect(r.programs).toHaveLength(1);
    expect(r.programs[0]).toMatchObject({ id: "general-plan", name: "General Plan", totalWeeks: 1 });
    expect(r.workouts.map((w) => [w.dayOfWeek, w.week, w.programId])).toEqual([
      ["Monday", 1, "general-plan"],
      ["Tuesday", 1, "general-plan"],
    ]);
  });

  it("merges 'N+1' rows with their (AMRAP) companion row into one exercise", () => {
    const ex = parseDay([
      ["Cable Row", "2+1", 10, "70 lb", "Last set AMRAP"],
      ["Cable Row (AMRAP)", 1, "AMRAP", "70 lb", "Log reps; +weight when AMRAP >13"],
      ["Face Pulls", 3, 15, "15 lb", "Warmup — no AMRAP"],
    ]);
    expect(ex.map((e) => e.name)).toEqual(["Cable Row", "Face Pulls"]);
    expect(ex[0]).toMatchObject({ sets: 3, repMin: 10, lastSetAmrap: true, seedWeight: 70, order: 1 });
    expect(ex[0].notes).toContain("+weight when AMRAP >13");
    expect(ex[0].notes).not.toContain("Log reps");
  });

  it("merges companion rows whose name differs slightly from the base row", () => {
    const ex = parseDay([
      ["Ab Crunch Machine", "2+1", 10, "70 lb", "Last set AMRAP"],
      ["Ab Crunch (AMRAP)", 1, "AMRAP", "70 lb", "Log reps; +weight when AMRAP >13"],
    ], "LVAC · Core · 45 min");
    expect(ex).toHaveLength(1);
    expect(ex[0].name).toBe("Ab Crunch Machine");
  });

  it("treats warmup/activation notes as the warmup phase, everything else as main", () => {
    const ex = parseDay([
      ["Exercise Bike", 1, "5 min", "—", "Easy pace warmup"],
      ["Lateral Band Walks", 3, "30 ft", "Loop band", "Activation — no AMRAP"],
      ["Pallof Press", 3, 10, "BW", "Anti-rotation core"],
    ]);
    expect(ex.map((e) => e.phase)).toEqual(["warmup", "warmup", "main"]);
    expect(ex[0].restAfter).toBe(false);
  });

  it("parses time values into seconds and flags them as timed", () => {
    const ex = parseDay([
      ["Exercise Bike", 1, "5 min", "—", ""],
      ["Scapular Hangs", 3, "Max hold", "BW", ""],
      ["Heavy Bag", 8, "1 min on", "—", "30s rest between rounds"],
    ]);
    expect(ex[0]).toMatchObject({ isTimeBased: true, repMin: 300, repMax: { type: "count", value: 300 } });
    expect(ex[1]).toMatchObject({ isTimeBased: true, repMax: { type: "failure" } });
    expect(ex[2]).toMatchObject({ isTimeBased: true, repMin: 60, sets: 8, restSeconds: 30 });
  });

  it("treats 'Max' reps as to-failure", () => {
    const [pushups] = parseDay([["Push-ups", 3, "Max", "BW", ""]]);
    expect(pushups).toMatchObject({ sets: 3, repMax: { type: "failure" }, isTimeBased: false, equipmentType: "bodyweight" });
  });

  it("infers equipment and progression from the weight text and location", () => {
    const home = parseDay([
      ["Assisted Pull-ups", "2+1", 5, "3 bands", "Last set AMRAP"],
      ["Assisted Pull-ups (AMRAP)", 1, "AMRAP", "3 bands", "Drop a band when AMRAP >8"],
      ["EZ Bar Curls", "2+1", 15, "52 lb", "Last set AMRAP"],
      ["EZ Bar Curls (AMRAP)", 1, "AMRAP", "52 lb", "+weight when AMRAP >18"],
      ["Hammer Curls", "2+1", 12, "15 lb", "Last set AMRAP"],
      ["Hammer Curls (AMRAP)", 1, "AMRAP", "15 lb", "+weight when AMRAP >15"],
      ["Lateral Raises", "2+1", 12, "2 lb", "Last set AMRAP"],
      ["Lateral Raises (AMRAP)", 1, "AMRAP", "2 lb", "+weight when AMRAP >15"],
      ["Goblet Squat", "2+1", 10, "15 lb KB", "Last set AMRAP"],
      ["Goblet Squat (AMRAP)", 1, "AMRAP", "15 lb KB", "+weight when AMRAP >13"],
      ["Romanian Deadlift", "2+1", 10, "90 lb", "Last set AMRAP"],
      ["Romanian Deadlift (AMRAP)", 1, "AMRAP", "90 lb", "+weight when AMRAP >13"],
      ["Lateral Band Walks", 3, "30 ft", "Loop band", ""],
      ["Pallof Press", 3, 10, "BW", ""],
    ]);
    const by = Object.fromEntries(home.map((e) => [e.name, e]));
    expect(by["Assisted Pull-ups"]).toMatchObject({ equipmentType: "assisted_pullup", seedWeight: 3, progressionRule: "reduce_assistance" });
    expect(by["EZ Bar Curls"]).toMatchObject({ equipmentType: "barbell_ez", seedWeight: 52, progressionRule: "add_2.5lb" });
    expect(by["Hammer Curls"]).toMatchObject({ equipmentType: "powerblock", seedWeight: 15, progressionRule: "add_2.5lb" });
    expect(by["Lateral Raises"]).toMatchObject({ equipmentType: "dumbbell", seedWeight: 2, progressionRule: "none" });
    expect(by["Goblet Squat"]).toMatchObject({ equipmentType: "kettlebell", seedWeight: 15, progressionRule: "add_weight" });
    expect(by["Romanian Deadlift"]).toMatchObject({ equipmentType: "barbell_45", seedWeight: 90, progressionRule: "add_5lb" });
    expect(by["Lateral Band Walks"]).toMatchObject({ equipmentType: "loop_band", progressionRule: "none" });
    expect(by["Pallof Press"]).toMatchObject({ equipmentType: "bodyweight", progressionRule: "none" });
    expect(by["Pallof Press"].seedWeight).toBeUndefined();
  });

  it("treats lb weights at a non-Home location as machine weights", () => {
    const [press] = parseDay([
      ["Chest Press", "2+1", 10, "90 lb", "Last set AMRAP"],
      ["Chest Press (AMRAP)", 1, "AMRAP", "90 lb", "+weight when AMRAP >13"],
    ], "LVAC · Back + Chest · ~45 min");
    expect(press).toMatchObject({ equipmentType: "machine", seedWeight: 90, progressionRule: "add_weight" });
  });

  it("handles placeholder rows ('—' sets/reps) as a single untracked set", () => {
    const [yoga] = parseDay([["YouTube Yoga Workout", "—", "—", "—", "Follow chosen YouTube yoga session"]]);
    expect(yoga).toMatchObject({ sets: 1, repMin: 1, equipmentType: "bodyweight" });
    expect(yoga.notes).toContain("Follow chosen YouTube yoga session");
  });

  it("keeps unrecognised weight text visible in the notes instead of dropping it", () => {
    const [ex] = parseDay([["Mystery Lift", 3, 10, "red plate", ""]]);
    expect(ex.notes).toContain("red plate");
  });

  it("reports the sheet and row for an unparseable sets value", () => {
    expect(() => parseDay([["Bad Row", "lots", 10, "BW", ""]])).toThrow(/Sheet 'Monday'.*Row 4.*Sets/);
  });

  it("still parses the weekly-cycle format when a Week/Phase header is present", () => {
    const ws = XLSX.utils.json_to_sheet([{
      Week: 1, Phase: "main", Order: 1, Exercise: "Bench", "Equip Type": "barbell_45", "Equip Detail": "",
      "Total Weight": 135, Sets: 3, "Rep Min": 8, "Rep Max": 10, "Rest (s)": 120, Progression: "add_5lb",
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monday");
    const r = parseXLSX(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(r.workouts[0].exercises[0].equipmentType).toBe("barbell_45");
  });
});

describe("general program - data/Reacher_Build.xlsx", () => {
  let data: Buffer | null = null;
  try { data = readFileSync(resolve(__dirname, "../../../../data/Reacher_Build.xlsx")); } catch { data = null; }

  it("parses every day sheet with valid, non-empty exercises", () => {
    if (!data) return; // data/ is not tracked in git
    const r = parseXLSX(data, "Reacher Build 2");
    expect(r.programs[0].totalWeeks).toBe(1);
    expect(r.workouts.map((w) => w.dayOfWeek)).toEqual([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ]);
    for (const w of r.workouts) {
      expect(w.exercises.length).toBeGreaterThan(0);
      for (const e of w.exercises) {
        expect(e.name).not.toMatch(/\(AMRAP\)/);
        expect(e.sets).toBeGreaterThan(0);
      }
    }
    const monday = r.workouts[0].exercises.map((e) => e.name);
    expect(monday).toContain("Lat Pulldown");
    expect(monday).not.toContain("Lat Pulldown (AMRAP)");
  });
});
