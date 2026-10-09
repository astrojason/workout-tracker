import * as XLSX from "xlsx";
import type { BodyMeasurementInput } from "./types";

// ── Body measurements in a program spreadsheet ───────────────────────────────
//
// The optional "Measurements" sheet lists tape measurements down column A and
// check-in columns across the top (Baseline, Week 4, Week 8, ...). Column headers
// are labels, not dates, so callers supply the date for each column.

export type MeasurementValues = Omit<BodyMeasurementInput, "date" | "weight">;

export interface MeasurementColumn {
  label: string;
  values: MeasurementValues;
}

const MEASUREMENT_ROWS: Record<string, keyof MeasurementValues> = {
  "RIGHT BICEP": "rightBicep",
  "LEFT BICEP": "leftBicep",
  "CHEST": "chest",
  "STOMACH": "waist",
  "RIGHT THIGH": "rightThigh",
  "LEFT THIGH": "leftThigh",
  "RIGHT CALF": "rightCalf",
  "LEFT CALF": "leftCalf",
};

// Accepts 47, "47\"", "12 7/8\"" and "15.5". Returns undefined for blank/unparseable cells.
export function parseInches(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*(?:"|in)?$/);
  if (!match) return undefined;
  const fraction = match[2] && match[3] && Number(match[3]) > 0 ? Number(match[2]) / Number(match[3]) : 0;
  const inches = Number(match[1]) + fraction;
  return inches > 0 ? inches : undefined;
}

// One entry per column that has at least one reading, left to right.
export function parseMeasurementColumns(data: ArrayBuffer | Uint8Array | Buffer): MeasurementColumn[] {
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets["Measurements"];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const header = rows[0] ?? [];
  const columns: MeasurementColumn[] = [];
  for (let col = 1; col < header.length; col++) {
    const values: MeasurementValues = {};
    for (const row of rows.slice(1)) {
      const field = MEASUREMENT_ROWS[String(row[0] ?? "").trim().toUpperCase()];
      if (!field) continue;
      const inches = parseInches(row[col]);
      if (inches !== undefined) values[field] = inches;
    }
    if (Object.keys(values).length > 0) {
      columns.push({ label: String(header[col] ?? "").trim() || `Column ${col}`, values });
    }
  }
  return columns;
}

export function parseBaselineMeasurements(data: ArrayBuffer | Uint8Array | Buffer): MeasurementValues | null {
  return parseMeasurementColumns(data)[0]?.values ?? null;
}
