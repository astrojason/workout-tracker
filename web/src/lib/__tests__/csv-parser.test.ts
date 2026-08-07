import { describe, it, expect, vi } from "vitest";

// csv-parser.ts also exports resolveExerciseDefinitions, which pulls in firestore.ts
// (and transitively firebase.ts). This file only exercises the synchronous parseCSV
// path, but the module-level import still needs a working mock.
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), addDoc: vi.fn(),
  updateDoc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { parseCSV } from "../csv-parser";

const VALID_HEADER = "program_name,week,day_of_week,phase,exercise_order,exercise_name,equipment_type,equipment_detail,base_weight,sets,rep_min,rep_max,rest_seconds,progression_rule,unilateral,notes";

function makeRow(overrides: Partial<Record<string, string>> = {}): string {
  const defaults: Record<string, string> = {
    program_name: "Test Program",
    week: "1",
    day_of_week: "Monday",
    phase: "main",
    exercise_order: "1",
    exercise_name: "Bench Press",
    equipment_type: "barbell_45",
    equipment_detail: "",
    base_weight: "135",
    sets: "3",
    rep_min: "8",
    rep_max: "12",
    rest_seconds: "120",
    progression_rule: "add_5lb",
    unilateral: "FALSE",
    notes: "",
  };
  const merged = { ...defaults, ...overrides };
  return Object.values(merged).join(",");
}

describe("parseCSV - valid parsing", () => {
  it("parses minimal valid CSV with one row", () => {
    const csv = `${VALID_HEADER}\n${makeRow()}`;
    const result = parseCSV(csv);

    expect(result.programs).toHaveLength(1);
    expect(result.programs[0].name).toBe("Test Program");
    expect(result.programs[0].totalWeeks).toBe(1);

    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].exercises).toHaveLength(1);
    expect(result.workouts[0].exercises[0].name).toBe("Bench Press");
  });

  it("groups multiple exercises into same workout", () => {
    const csv = [
      VALID_HEADER,
      makeRow({ exercise_order: "1", exercise_name: "Bench Press" }),
      makeRow({ exercise_order: "2", exercise_name: "Squat" }),
      makeRow({ exercise_order: "3", exercise_name: "Deadlift" }),
    ].join("\n");

    const result = parseCSV(csv);
    expect(result.programs).toHaveLength(1);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].exercises).toHaveLength(3);
  });

  it("sorts exercises by order within workout", () => {
    const csv = [
      VALID_HEADER,
      makeRow({ exercise_order: "3", exercise_name: "Third" }),
      makeRow({ exercise_order: "1", exercise_name: "First" }),
      makeRow({ exercise_order: "2", exercise_name: "Second" }),
    ].join("\n");

    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].name).toBe("First");
    expect(result.workouts[0].exercises[1].name).toBe("Second");
    expect(result.workouts[0].exercises[2].name).toBe("Third");
  });

  it("sets totalWeeks to max week number", () => {
    const csv = [
      VALID_HEADER,
      makeRow({ week: "1" }),
      makeRow({ week: "2" }),
      makeRow({ week: "4" }),
    ].join("\n");

    const result = parseCSV(csv);
    expect(result.programs[0].totalWeeks).toBe(4);
  });

  it("parses 'progressive' base_weight as no seed weight", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ base_weight: "progressive" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].seedWeight).toBeUndefined();
  });

  it("parses 'Progressive' (case-insensitive) base_weight as no seed weight", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ base_weight: "Progressive" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].seedWeight).toBeUndefined();
  });

  it("parses numeric base_weight as a seed weight", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ base_weight: "185" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].seedWeight).toBe(185);
  });

  it("parses 'failure' rep_max correctly", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ rep_max: "failure" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].repMax).toEqual({ type: "failure" });
  });

  it("parses 'Failure' (case-insensitive) rep_max", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ rep_max: "Failure" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].repMax).toEqual({ type: "failure" });
  });

  it("parses numeric rep_max as count", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ rep_max: "12" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].repMax).toEqual({ type: "count", value: 12 });
  });

  it("parses TRUE unilateral (case-insensitive)", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ unilateral: "TRUE" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].isUnilateral).toBe(true);
  });

  it("parses 'true' (lowercase) unilateral", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ unilateral: "true" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].isUnilateral).toBe(true);
  });

  it("parses FALSE unilateral", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ unilateral: "FALSE" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].isUnilateral).toBe(false);
  });

  it("sets empty equipment_detail and notes to null", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ equipment_detail: "", notes: "" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].equipmentDetail).toBeNull();
    expect(result.workouts[0].exercises[0].notes).toBeNull();
  });

  it("preserves non-empty equipment_detail and notes", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ equipment_detail: "10lbs", notes: "Go slow" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].equipmentDetail).toBe("10lbs");
    expect(result.workouts[0].exercises[0].notes).toBe("Go slow");
  });

  it("handles quoted fields with commas", () => {
    const csv = `${VALID_HEADER}\nTest Program,1,Monday,main,1,Bench Press,barbell_45,,135,3,8,12,120,add_5lb,FALSE,"Use slow, controlled form"`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].notes).toBe("Use slow, controlled form");
  });

  it("handles \\r\\n line endings", () => {
    const csv = `${VALID_HEADER}\r\n${makeRow()}`;
    const result = parseCSV(csv);
    expect(result.programs).toHaveLength(1);
  });

  it("filters trailing empty lines", () => {
    const csv = `${VALID_HEADER}\n${makeRow()}\n\n\n`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises).toHaveLength(1);
  });

  it("parses base_weight 0 as no seed weight", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ base_weight: "0" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].seedWeight).toBeUndefined();
  });

  it("sorts programs alphabetically", () => {
    const csv = [
      VALID_HEADER,
      makeRow({ program_name: "Zebra Program" }),
      makeRow({ program_name: "Alpha Program" }),
    ].join("\n");

    const result = parseCSV(csv);
    expect(result.programs[0].name).toBe("Alpha Program");
    expect(result.programs[1].name).toBe("Zebra Program");
  });
});

describe("parseCSV - error handling", () => {
  it("throws on empty CSV", () => {
    expect(() => parseCSV("")).toThrow("CSV file is empty");
  });

  it("throws on whitespace-only CSV", () => {
    expect(() => parseCSV("  \n  \n  ")).toThrow("CSV file is empty");
  });

  it("throws on wrong header - missing column", () => {
    const badHeader = "program_name,week,day_of_week";
    expect(() => parseCSV(`${badHeader}\ndata`)).toThrow("Invalid header");
  });

  it("throws on wrong header - wrong column name", () => {
    const badHeader = VALID_HEADER.replace("program_name", "program");
    expect(() => parseCSV(`${badHeader}\n${makeRow()}`)).toThrow("Invalid header");
  });

  it("throws on too few columns in data row", () => {
    const csv = `${VALID_HEADER}\nTest,1,Monday`;
    expect(() => parseCSV(csv)).toThrow("expected 16 columns");
  });

  it("throws on invalid phase", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ phase: "invalid_phase" })}`;
    expect(() => parseCSV(csv)).toThrow("invalid phase");
  });

  it("throws on invalid equipment type", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ equipment_type: "laser_gun" })}`;
    expect(() => parseCSV(csv)).toThrow("invalid equipment");
  });

  it("throws on invalid week (non-numeric)", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ week: "abc" })}`;
    expect(() => parseCSV(csv)).toThrow("invalid week");
  });

  it("throws on invalid exercise order (non-numeric)", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ exercise_order: "abc" })}`;
    expect(() => parseCSV(csv)).toThrow("invalid order");
  });

  it("includes line number in error messages", () => {
    const csv = [
      VALID_HEADER,
      makeRow(), // line 2 - valid
      makeRow({ phase: "bad" }), // line 3 - invalid
    ].join("\n");
    expect(() => parseCSV(csv)).toThrow("Line 3");
  });
});

describe("parseCSV - grouping logic", () => {
  it("creates separate workouts for different days", () => {
    const csv = [
      VALID_HEADER,
      makeRow({ day_of_week: "Monday" }),
      makeRow({ day_of_week: "Tuesday" }),
    ].join("\n");

    const result = parseCSV(csv);
    expect(result.workouts).toHaveLength(2);
  });

  it("creates separate workouts for different weeks", () => {
    const csv = [
      VALID_HEADER,
      makeRow({ week: "1" }),
      makeRow({ week: "2" }),
    ].join("\n");

    const result = parseCSV(csv);
    expect(result.workouts).toHaveLength(2);
  });

  it("handles 'Daily' day_of_week", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ day_of_week: "Daily" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].dayOfWeek).toBe("Daily");
  });

  it("slugifies program ID correctly", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ program_name: "Reacher Build" })}`;
    const result = parseCSV(csv);
    expect(result.programs[0].id).toBe("reacher-build");
  });

  it("slugifies workout ID correctly", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ program_name: "Test Program", week: "2", day_of_week: "Monday" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].id).toBe("test-program_2_monday");
  });

  it("passes through free-form progression_rule strings (band colors, band counts)", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ progression_rule: "Blue" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].progressionRule).toBe("Blue");
  });

  it("passes through arbitrary non-empty progression_rule strings", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ progression_rule: "2 bands" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].progressionRule).toBe("2 bands");
  });

  it("defaults empty progression_rule to 'none'", () => {
    const csv = `${VALID_HEADER}\n${makeRow({ progression_rule: "" })}`;
    const result = parseCSV(csv);
    expect(result.workouts[0].exercises[0].progressionRule).toBe("none");
  });

  it("parses all valid phases", () => {
    const phases = ["warmup", "main", "finisher", "cooldown", "mobility"];
    for (const phase of phases) {
      const csv = `${VALID_HEADER}\n${makeRow({ phase })}`;
      const result = parseCSV(csv);
      expect(result.workouts[0].exercises[0].phase).toBe(phase);
    }
  });

  it("parses all valid equipment types", () => {
    const types = ["barbell_45", "barbell_35", "barbell_ez", "powerblock", "band", "kettlebell", "bodyweight", "assisted_pullup"];
    for (const type of types) {
      const csv = `${VALID_HEADER}\n${makeRow({ equipment_type: type })}`;
      const result = parseCSV(csv);
      expect(result.workouts[0].exercises[0].equipmentType).toBe(type);
    }
  });
});
