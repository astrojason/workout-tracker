import { describe, expect, it } from "vitest";
import type { BodyMeasurementDoc } from "../types";
import { bodyCsv, metricSummary, movingAverage, parseMeasurementFields, sideDifferences, tapeChanges } from "../body-report";

const m = (id: string, date: string, values: Partial<BodyMeasurementDoc>): BodyMeasurementDoc => ({ id, date: new Date(`${date}T12:00:00`), ...values });

const entries = [
  m("a", "2026-09-01", { weight: 187.3, waist: 34.25, rightBicep: 15, leftBicep: 14.75 }),
  m("b", "2026-10-01", { weight: 186 }),
  m("c", "2026-11-24", { weight: 184.2, waist: 33.5, rightBicep: 15.25, leftBicep: 15, rightThigh: 24, leftThigh: 23.5, rightCalf: 15.5, leftCalf: 15.5 }),
];

describe("metricSummary", () => {
  it("gives the latest value, the change since the first, and the points, oldest first", () => {
    expect(metricSummary(entries, "weight")).toEqual({ latest: 184.2, change: -3.1, points: [187.3, 186, 184.2], latestDate: new Date("2026-11-24T12:00:00") });
  });
  it("skips entries without the metric and is null when none have it", () => {
    expect(metricSummary(entries, "waist")!.points).toEqual([34.25, 33.5]);
    expect(metricSummary(entries, "bodyFatPercentage")).toBeNull();
  });
});

describe("movingAverage", () => {
  it("averages each value with up to the previous n-1", () => {
    expect(movingAverage([4, 6, 8, 10, 12], 4)).toEqual([4, 5, 6, 7, 9]);
  });
});

describe("tapeChanges", () => {
  it("lists tape measurements measured at least twice, first to latest", () => {
    expect(tapeChanges(entries)).toEqual([
      { key: "waist", label: "Waist", first: 34.25, latest: 33.5, change: -0.75 },
      { key: "rightBicep", label: "Right bicep", first: 15, latest: 15.25, change: 0.25 },
      { key: "leftBicep", label: "Left bicep", first: 14.75, latest: 15, change: 0.25 },
    ]);
  });
});

describe("sideDifferences", () => {
  it("compares each left/right pair from its latest measurement", () => {
    expect(sideDifferences(entries)).toEqual([
      { label: "Bicep", left: 15, right: 15.25, difference: 0.25 },
      { label: "Thigh", left: 23.5, right: 24, difference: 0.5 },
      { label: "Calf", left: 15.5, right: 15.5, difference: 0 },
    ]);
  });
});

describe("parseMeasurementFields", () => {
  it("turns filled-in fields into a measurement, ignoring blanks", () => {
    expect(parseMeasurementFields("2026-11-24", { weight: "184.2", waist: " 33.5 ", chest: "" })).toEqual({
      ok: true, value: { date: new Date("2026-11-24T12:00:00"), weight: 184.2, waist: 33.5 },
    });
  });
  it("needs a date and at least one value, and rejects non-positive numbers with the field name", () => {
    expect(parseMeasurementFields("", { weight: "184" })).toEqual({ ok: false, error: "Choose the date you measured" });
    expect(parseMeasurementFields("2026-11-24", { weight: "" })).toEqual({ ok: false, error: "Fill in at least one measurement" });
    expect(parseMeasurementFields("2026-11-24", { waist: "abc" })).toEqual({ ok: false, error: "Waist must be a number above 0" });
    expect(parseMeasurementFields("2026-11-24", { weight: "0" })).toEqual({ ok: false, error: "Body weight must be a number above 0" });
  });
});

describe("bodyCsv", () => {
  it("writes one row per check-in with a column for each measurement that has data", () => {
    const csv = bodyCsv(entries.slice(0, 2));
    expect(csv).toBe("Date,Body weight (lbs),Waist (in),Right bicep (in),Left bicep (in)\n2026-09-01,187.3,34.25,15,14.75\n2026-10-01,186,,,\n");
  });
});
