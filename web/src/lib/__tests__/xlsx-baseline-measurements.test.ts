import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as XLSX from "xlsx";

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), addDoc: vi.fn(),
  updateDoc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(), writeBatch: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) },
}));

import { parseBaselineMeasurements, parseInches } from "../xlsx-parser";
import { parseMeasurementColumns } from "../measurements-import";

function workbook(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

describe("parseInches", () => {
  it("parses whole inches, eighths and plain numbers", () => {
    expect(parseInches('47"')).toBe(47);
    expect(parseInches('12 7/8"')).toBe(12.875);
    expect(parseInches('23 2/8"')).toBe(23.25);
    expect(parseInches("15.5")).toBe(15.5);
    expect(parseInches(43.75)).toBe(43.75);
  });

  it("returns undefined for blank or unparseable cells", () => {
    expect(parseInches("")).toBeUndefined();
    expect(parseInches(undefined)).toBeUndefined();
    expect(parseInches("n/a")).toBeUndefined();
  });
});

describe("parseBaselineMeasurements", () => {
  it("maps the Measurements sheet baseline column to check-in fields", () => {
    const data = workbook({
      Measurements: [
        ["Measurement", "Baseline (Wk2 C3)", "Week 4"],
        ["RIGHT BICEP", '12 7/8"', ""],
        ["LEFT BICEP", '12 6/8"', ""],
        ["CHEST", '43 6/8"', ""],
        ["STOMACH", '47"', ""],
        ["RIGHT THIGH", '23 2/8"', ""],
        ["LEFT THIGH", '23 5/8"', ""],
        ["RIGHT CALF", '15 6/8"', ""],
        ["LEFT CALF", '15 4/8"', ""],
      ],
    });
    expect(parseBaselineMeasurements(data)).toEqual({
      rightBicep: 12.875,
      leftBicep: 12.75,
      chest: 43.75,
      waist: 47,
      rightThigh: 23.25,
      leftThigh: 23.625,
      rightCalf: 15.75,
      leftCalf: 15.5,
    });
  });

  it("returns null when there is no Measurements sheet", () => {
    expect(parseBaselineMeasurements(workbook({ Monday: [["Exercise"]] }))).toBeNull();
  });

  it("returns null when the baseline column is empty", () => {
    const data = workbook({ Measurements: [["Measurement", "Baseline"], ["CHEST", ""]] });
    expect(parseBaselineMeasurements(data)).toBeNull();
  });

  it("parses the real program spreadsheets in data/", () => {
    for (const file of ["Reacher build cycle.xlsx", "reacher_build_cycle4.xlsx"]) {
      const buf = readFileSync(resolve(__dirname, "../../../../data", file));
      expect(parseBaselineMeasurements(buf)).toMatchObject({ chest: 43.75, waist: 47, leftCalf: 15.5 });
    }
  });
});

describe("parseMeasurementColumns", () => {
  const rows = [
    ["Measurement", "Baseline (Wk2 C3)", "Week 4", "Week 8"],
    ["CHEST", '43 6/8"', '44"', ""],
    ["STOMACH", '47"', '46 4/8"', ""],
    ["LEFT CALF", "", '15"', ""],
  ];

  it("returns one entry per column that has readings, skipping empty columns", () => {
    expect(parseMeasurementColumns(workbook({ Measurements: rows }))).toEqual([
      { label: "Baseline (Wk2 C3)", values: { chest: 43.75, waist: 47 } },
      { label: "Week 4", values: { chest: 44, waist: 46.5, leftCalf: 15 } },
    ]);
  });

  it("returns an empty list when there is no Measurements sheet", () => {
    expect(parseMeasurementColumns(workbook({ Monday: [["Exercise"]] }))).toEqual([]);
  });
});
