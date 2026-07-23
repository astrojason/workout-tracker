import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";

// xlsx-parser.ts also exports resolveExerciseDefinitions, which pulls in firestore.ts
// (and transitively firebase.ts). This file only exercises the synchronous parseXLSX
// path, but the module-level import still needs a working mock to avoid initializing
// a real Firebase app during unit tests.
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { parseXLSX } from "../xlsx-parser";

// ── Helper: build an ArrayBuffer from plain JS objects using actual XLSX column names ──

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Week: 1,
    Phase: "main",
    Order: 1,
    Exercise: "Bench Press",
    "Equip Category": "Barbell",
    "Equip Type": "barbell_45",
    "Equip Detail": "",
    "Total Weight": 135,
    Sets: 3,
    "Rep Min": 8,
    "Rep Max": 10,
    "Rest (s)": 120,
    "Rest After": "",
    Progression: "add_5lb",
    Unilateral: false,
    "Last Set AMRAP": false,
    Notes: "",
    ...overrides,
  };
}

function buildXLSX(sheetData: Record<string, Record<string, unknown>[]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheetData)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

// ── Basic parsing ─────────────────────────────────────────────────────────────

describe("parseXLSX - basic parsing", () => {
  it("parses a single Monday sheet with one exercise", () => {
    const buf = buildXLSX({ Monday: [makeRow()] });
    const result = parseXLSX(buf);
    expect(result.programs).toHaveLength(1);
    expect(result.programs[0].name).toBe("Reacher Build");
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].dayOfWeek).toBe("Monday");
    expect(result.workouts[0].exercises).toHaveLength(1);
    expect(result.workouts[0].exercises[0].name).toBe("Bench Press");
  });

  it("accepts a custom program name parameter", () => {
    const buf = buildXLSX({ Monday: [makeRow()] });
    const result = parseXLSX(buf, "My Program");
    expect(result.programs[0].name).toBe("My Program");
  });

  it("ignores sheets that are not days of the week", () => {
    const buf = buildXLSX({
      Monday: [makeRow()],
      Summary: [makeRow({ Exercise: "Should Be Ignored" })],
    });
    const result = parseXLSX(buf);
    const names = result.workouts.flatMap((w) => w.exercises.map((e) => e.name));
    expect(names).not.toContain("Should Be Ignored");
  });

  it("creates separate workouts for each day sheet", () => {
    const buf = buildXLSX({
      Monday: [makeRow()],
      Tuesday: [makeRow()],
      Friday: [makeRow()],
    });
    const result = parseXLSX(buf);
    expect(result.workouts).toHaveLength(3);
  });

  it("sets totalWeeks from max Week column value across sheets", () => {
    const buf = buildXLSX({
      Monday: [makeRow({ Week: 1 }), makeRow({ Week: 2, Order: 2 }), makeRow({ Week: 4, Order: 3 })],
    });
    const result = parseXLSX(buf);
    expect(result.programs[0].totalWeeks).toBe(4);
  });

  it("skips rows with blank Exercise name", () => {
    const buf = buildXLSX({
      Monday: [makeRow(), makeRow({ Exercise: "", Order: 2 })],
    });
    const result = parseXLSX(buf);
    expect(result.workouts[0].exercises).toHaveLength(1);
  });

  it("parses 'failure' Rep Max as failure RepTarget", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rep Max": "failure" })] });
    const result = parseXLSX(buf);
    expect(result.workouts[0].exercises[0].repMax).toEqual({ type: "failure" });
  });

  it("stores Total Weight > 0 as seedWeight", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Total Weight": 185 })] });
    const result = parseXLSX(buf);
    expect(result.workouts[0].exercises[0].seedWeight).toBe(185);
  });

  it("leaves seedWeight undefined when Total Weight is 0", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Total Weight": 0 })] });
    const result = parseXLSX(buf);
    expect(result.workouts[0].exercises[0].seedWeight).toBeUndefined();
  });
});

// ── Phase sort order ──────────────────────────────────────────────────────────

describe("parseXLSX - phase sort order", () => {
  it("sorts warmup before main before finisher", () => {
    const buf = buildXLSX({
      Monday: [
        makeRow({ Phase: "finisher", Order: 1, Exercise: "Finisher" }),
        makeRow({ Phase: "warmup", Order: 1, Exercise: "Warm Up" }),
        makeRow({ Phase: "main", Order: 1, Exercise: "Main Lift" }),
      ],
    });
    const result = parseXLSX(buf);
    const names = result.workouts[0].exercises.map((e) => e.name);
    expect(names[0]).toBe("Warm Up");
    expect(names[1]).toBe("Main Lift");
    expect(names[2]).toBe("Finisher");
  });

  it("sorts by Order within same phase", () => {
    const buf = buildXLSX({
      Monday: [
        makeRow({ Phase: "main", Order: 3, Exercise: "Third" }),
        makeRow({ Phase: "main", Order: 1, Exercise: "First" }),
        makeRow({ Phase: "main", Order: 2, Exercise: "Second" }),
      ],
    });
    const result = parseXLSX(buf);
    expect(result.workouts[0].exercises.map((e) => e.name)).toEqual(["First", "Second", "Third"]);
  });

  it("re-indexes exercises 1–N after sorting (program-import user story)", () => {
    const buf = buildXLSX({
      Monday: [
        makeRow({ Phase: "finisher", Order: 10, Exercise: "Finisher" }),
        makeRow({ Phase: "warmup",   Order: 5,  Exercise: "Warm Up" }),
        makeRow({ Phase: "main",     Order: 3,  Exercise: "Main Lift" }),
      ],
    });
    const result = parseXLSX(buf);
    const orders = result.workouts[0].exercises.map((e) => e.order);
    expect(orders).toEqual([1, 2, 3]);
  });

});

// ── rest_after column ─────────────────────────────────────────────────────────

describe("parseXLSX - Rest After column", () => {
  it("sets restAfter to false when value is boolean false", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rest After": false })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBe(false);
  });

  it("sets restAfter to false when value is string 'FALSE'", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rest After": "FALSE" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBe(false);
  });

  it("sets restAfter to numeric seconds", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rest After": 90 })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBe(90);
  });

  it("parses '90s' as 90 seconds", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rest After": "90s" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBe(90);
  });

  it("parses '2m' as 120 seconds", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rest After": "2m" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBe(120);
  });

  it("parses '2:30' as 150 seconds", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rest After": "2:30" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBe(150);
  });

  it("leaves restAfter undefined when column is empty", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rest After": "" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBeUndefined();
  });

  it("always sets restAfter to false for warmup phase when column is absent", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Phase: "warmup", "Rest After": "" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBe(false);
  });

  it("respects explicit Rest After value for warmup exercises", () => {
    // If warmup has an explicit numeric rest time, it overrides the default false
    const buf = buildXLSX({ Monday: [makeRow({ Phase: "warmup", "Rest After": 30 })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].restAfter).toBe(30);
  });
});

// ── last_set_amrap column ─────────────────────────────────────────────────────

describe("parseXLSX - Last Set AMRAP column", () => {
  it("sets lastSetAmrap to true when value is boolean true", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Last Set AMRAP": true })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].lastSetAmrap).toBe(true);
  });

  it("sets lastSetAmrap to true when value is string 'TRUE'", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Last Set AMRAP": "TRUE" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].lastSetAmrap).toBe(true);
  });

  it("leaves lastSetAmrap undefined when false", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Last Set AMRAP": false })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].lastSetAmrap).toBeUndefined();
  });

  it("leaves lastSetAmrap undefined when empty string", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Last Set AMRAP": "" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].lastSetAmrap).toBeUndefined();
  });
});

// ── Progression rule ─────────────────────────────────────────────────────────

describe("parseXLSX - Progression column", () => {
  it("passes through keyword rules as-is", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Progression: "add_5lb" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].progressionRule).toBe("add_5lb");
  });

  it("passes through free-form band color rule", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Progression: "Blue" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].progressionRule).toBe("Blue");
  });

  it("passes through free-form band count rule", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Progression: "2 bands" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].progressionRule).toBe("2 bands");
  });

  it("defaults empty Progression to 'none'", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Progression: "" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].progressionRule).toBe("none");
  });
});

// ── time-based-exercises and unilateral-exercises user stories ────────────────

describe("parseXLSX - time-based-exercises user story", () => {
  it("sets isTimeBased=true when progression is add_time", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Progression: "add_time", "Rep Min": 10 })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].isTimeBased).toBe(true);
  });

  it("sets isTimeBased=true when repMin >= 30", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rep Min": 30 })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].isTimeBased).toBe(true);
  });

  it("sets isTimeBased=false when repMin is 29 (boundary: not a duration)", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rep Min": 29 })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].isTimeBased).toBe(false);
  });

  it("sets isTimeBased=true when repMin > 30", () => {
    const buf = buildXLSX({ Monday: [makeRow({ "Rep Min": 45 })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].isTimeBased).toBe(true);
  });
});

describe("parseXLSX - unilateral-exercises user story", () => {
  it("sets isUnilateral=true when Unilateral column is true", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Unilateral: true })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].isUnilateral).toBe(true);
  });

  it("sets isUnilateral=true when Unilateral column is string 'TRUE'", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Unilateral: "TRUE" })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].isUnilateral).toBe(true);
  });

  it("sets isUnilateral=false when Unilateral column is false", () => {
    const buf = buildXLSX({ Monday: [makeRow({ Unilateral: false })] });
    expect(parseXLSX(buf).workouts[0].exercises[0].isUnilateral).toBe(false);
  });
});

// ── Grouping and IDs ─────────────────────────────────────────────────────────

describe("parseXLSX - grouping and IDs", () => {
  it("slugifies program and workout IDs", () => {
    const buf = buildXLSX({ Monday: [makeRow()] });
    const result = parseXLSX(buf, "Reacher Build");
    expect(result.programs[0].id).toBe("reacher-build");
    expect(result.workouts[0].id).toBe("reacher-build_1_monday");
  });

  it("groups exercises from same Week/day into one workout", () => {
    const buf = buildXLSX({
      Monday: [makeRow({ Order: 1, Exercise: "Ex1" }), makeRow({ Order: 2, Exercise: "Ex2" })],
    });
    const result = parseXLSX(buf);
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].exercises).toHaveLength(2);
  });

  it("creates separate workouts for different weeks on same day", () => {
    const buf = buildXLSX({
      Monday: [makeRow({ Week: 1, Exercise: "Week1" }), makeRow({ Week: 2, Exercise: "Week2" })],
    });
    const result = parseXLSX(buf);
    expect(result.workouts).toHaveLength(2);
  });
});
