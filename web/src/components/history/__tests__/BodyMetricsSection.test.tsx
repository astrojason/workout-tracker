import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BodyMetricsSection } from "../BodyMetricsSection";
import * as XLSX from "xlsx";
import type { BodyMeasurementDoc } from "@/lib/types";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="metrics-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const entries: BodyMeasurementDoc[] = [
  {
    id: "entry-1",
    date: new Date("2026-08-31T12:00:00"),
    weight: 180,
    waist: 34,
  },
  {
    id: "entry-2",
    date: new Date("2026-09-07T12:00:00"),
    weight: 178.5,
    waist: 33.5,
    chest: 42,
    bodyFatPercentage: 21.3,
    muscleMass: 132.4,
    bodyWaterPercentage: 55.8,
  },
];

describe("BodyMetricsSection", () => {
  it("shows the latest check-in and chartable optional metrics", () => {
    render(
      <BodyMetricsSection entries={entries} loading={false} saving={false} onSave={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getAllByText("178.5 lbs")).toHaveLength(2);
    expect(screen.getByText("33.5 in waist")).toBeInTheDocument();
    expect(screen.getByText("21.3% body fat")).toBeInTheDocument();
    expect(screen.getByText("132.4 lbs muscle mass")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Waist" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Body fat" })).toBeInTheDocument();
    expect(screen.getByTestId("metrics-chart")).toBeInTheDocument();
  });

  it("shows an imported baseline check-in that has no body weight", () => {
    const baseline: BodyMeasurementDoc[] = [
      {
        id: "baseline",
        date: new Date("2026-09-01T12:00:00"),
        chest: 43.75,
        waist: 47,
        rightBicep: 12.875,
        leftBicep: 12.75,
        rightThigh: 23.25,
        leftThigh: 23.625,
        rightCalf: 15.75,
        leftCalf: 15.5,
      },
    ];
    render(
      <BodyMetricsSection entries={baseline} loading={false} saving={false} onSave={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument();
    expect(screen.getByText("47 in waist")).toBeInTheDocument();
    expect(screen.getByText("12.875 in right bicep")).toBeInTheDocument();
    expect(screen.getByText("15.5 in left calf")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Right thigh" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Body weight" })).not.toBeInTheDocument();
    expect(screen.getByTestId("metrics-chart")).toBeInTheDocument();
  });

  it("collects a dated weight with optional measurements", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <BodyMetricsSection entries={[]} loading={false} saving={false} onSave={onSave} onDelete={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log check-in" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-07" } });
    fireEvent.change(screen.getByLabelText("Body weight (lbs)"), { target: { value: "178.5" } });
    fireEvent.change(screen.getByLabelText("Waist (in)"), { target: { value: "33.25" } });
    fireEvent.change(screen.getByLabelText("Body fat (%)"), { target: { value: "20.8" } });
    fireEvent.change(screen.getByLabelText("BMI"), { target: { value: "24.2" } });
    fireEvent.change(screen.getByLabelText("Muscle mass (lbs)"), { target: { value: "131.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        date: new Date("2026-09-07T12:00:00"),
        weight: 178.5,
        waist: 33.25,
        bodyFatPercentage: 20.8,
        bmi: 24.2,
        muscleMass: 131.5,
      });
    });
  });

  it("imports dated check-ins from a measurements spreadsheet", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <BodyMetricsSection entries={[]} loading={false} saving={false} onSave={onSave} onDelete={vi.fn()} />,
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Measurement", "Baseline", "Week 4"],
      ["CHEST", '43 6/8"', '44"'],
      ["STOMACH", '47"', ""],
    ]), "Measurements");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([bytes], "plan.xlsx");
    Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });

    fireEvent.change(screen.getByLabelText("Measurements spreadsheet"), { target: { files: [file] } });

    await screen.findByText("Import measurements");
    fireEvent.change(screen.getByLabelText("Date for Baseline"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Date for Week 4"), { target: { value: "2026-09-29" } });
    fireEvent.click(screen.getByRole("button", { name: "Import 2 check-ins" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenNthCalledWith(1, { date: new Date("2026-09-01T12:00:00"), chest: 43.75, waist: 47 });
    expect(onSave).toHaveBeenNthCalledWith(2, { date: new Date("2026-09-29T12:00:00"), chest: 44 });
  });

  it("skips columns whose date is left blank", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <BodyMetricsSection entries={[]} loading={false} saving={false} onSave={onSave} onDelete={vi.fn()} />,
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Measurement", "Baseline", "Week 4"],
      ["CHEST", '43"', '44"'],
    ]), "Measurements");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([bytes], "plan.xlsx");
    Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });

    fireEvent.change(screen.getByLabelText("Measurements spreadsheet"), { target: { files: [file] } });
    await screen.findByText("Import measurements");
    fireEvent.change(screen.getByLabelText("Date for Baseline"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Import 1 check-in" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ date: new Date("2026-09-01T12:00:00"), chest: 43 });
  });

  it("asks for confirmation before deleting a check-in", () => {
    render(
      <BodyMetricsSection entries={entries} loading={false} saving={false} onSave={vi.fn()} onDelete={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Sep 7 check-in" }));
    expect(screen.getByText("Delete check-in?")).toBeInTheDocument();
  });
});
