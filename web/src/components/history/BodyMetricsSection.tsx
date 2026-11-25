"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useMeasurementImport } from "@/components/body/useMeasurementImport";
import { cleanWeight } from "@/lib/types";
import { CIRCUMFERENCE_METRICS, METRICS, SMART_SCALE_METRICS, type MetricDefinition, type MetricKey } from "@/lib/body-report";
import type { BodyMeasurementDoc, BodyMeasurementInput } from "@/lib/types";

type OptionalMetricKey = Exclude<MetricKey, "weight">;

function asDate(value: BodyMeasurementDoc["date"]): Date {
  return value instanceof Date ? value : value.toDate();
}

function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

// Tape measurements are recorded in eighths of an inch, so keep three decimals.
function cleanValue(metric: MetricDefinition, value: number): string {
  return metric.unit === "in" ? parseFloat(value.toFixed(3)).toString() : cleanWeight(value);
}

function formatMetric(metric: MetricDefinition, value: number): string {
  const number = cleanValue(metric, value);
  const label = metric.label.toLowerCase();
  switch (metric.unit) {
    case "%": return `${number}% ${label}`;
    case "": return metric.key === "bmi" ? `${number} BMI` : `${number} ${label}`;
    default: return `${number} ${metric.unit} ${label}`;
  }
}

function tooltipValue(value: number, metric: MetricDefinition): string {
  const number = cleanValue(metric, value);
  if (metric.unit === "%") return `${number}%`;
  return metric.unit ? `${number} ${metric.unit}` : number;
}

interface BodyMetricsSectionProps {
  entries: BodyMeasurementDoc[];
  loading: boolean;
  saving: boolean;
  deletingId?: string | null;
  onSave: (measurement: BodyMeasurementInput) => Promise<boolean>;
  onDelete: (measurementId: string) => Promise<boolean>;
}

export function BodyMetricsSection({
  entries,
  loading,
  saving,
  deletingId = null,
  onSave,
  onDelete,
}: BodyMetricsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const measurementImport = useMeasurementImport(onSave);
  const [date, setDate] = useState(localDateInputValue());
  const [weight, setWeight] = useState("");
  const [measurements, setMeasurements] = useState<Partial<Record<OptionalMetricKey, string>>>({});
  const [metric, setMetric] = useState<MetricKey>("weight");
  const [deleteTarget, setDeleteTarget] = useState<BodyMeasurementDoc | null>(null);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => asDate(a.date).getTime() - asDate(b.date).getTime()),
    [entries],
  );
  const latest = sortedEntries.at(-1);
  const availableMetrics = METRICS.filter(({ key }) =>
    sortedEntries.some((entry) => entry[key] !== undefined),
  );
  const selectedMetric = availableMetrics.some((item) => item.key === metric)
    ? metric
    : (availableMetrics[0]?.key ?? "weight");
  const selectedDefinition = METRICS.find((item) => item.key === selectedMetric) ?? METRICS[0];
  const chartData = sortedEntries
    .filter((entry) => entry[selectedMetric] !== undefined)
    .map((entry) => ({
      date: asDate(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: entry[selectedMetric],
    }));

  function resetForm() {
    setDate(localDateInputValue());
    setWeight("");
    setMeasurements({});
    setShowForm(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bodyWeight = Number(weight);
    if (!date || !Number.isFinite(bodyWeight) || bodyWeight <= 0) return;
    const optional = Object.fromEntries(
      Object.entries(measurements)
        .map(([key, value]) => [key, optionalNumber(value)] as const)
        .filter((entry): entry is [string, number] => entry[1] !== undefined),
    );
    const saved = await onSave({
      date: new Date(`${date}T12:00:00`),
      weight: bodyWeight,
      ...optional,
    });
    if (saved) resetForm();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const deleted = await onDelete(deleteTarget.id);
    if (deleted) setDeleteTarget(null);
  }

  return (
    <section className="mb-6" aria-labelledby="body-metrics-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="body-metrics-heading" className="text-sm font-bold uppercase tracking-wider text-gray-400">
          Body metrics
        </h2>
        <div className="flex items-center gap-2">
          {measurementImport.fileInput}
          <button
            type="button"
            onClick={measurementImport.open}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800"
          >
            Import from spreadsheet
          </button>
          <button
            type="button"
            onClick={() => setShowForm((visible) => !visible)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500"
          >
            {showForm ? "Cancel" : "Log check-in"}
          </button>
        </div>
      </div>

      {measurementImport.panel}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-3 space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col justify-between text-sm text-gray-400">
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
              />
            </label>
            <label className="flex flex-col justify-between text-sm text-gray-400">
              Body weight (lbs)
              <input
                type="number"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                min="0.1"
                step="any"
                required
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
              />
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Optional measurements</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CIRCUMFERENCE_METRICS.map(({ key, inputLabel }) => (
                <label key={key} className="flex flex-col justify-between text-sm text-gray-400">
                  {inputLabel}
                  <input
                    type="number"
                    value={measurements[key as OptionalMetricKey] ?? ""}
                    onChange={(event) => setMeasurements((current) => ({ ...current, [key]: event.target.value }))}
                    min="0.1"
                    step="any"
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                  />
                </label>
              ))}
            </div>
          </div>
          <details className="rounded-lg border border-gray-800 bg-gray-950/40 p-3" open>
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-gray-500">
              Smart scale metrics (optional)
            </summary>
            <p className="mt-2 text-xs text-gray-500">
              Body-composition readings are scale estimates. Use them to follow trends, not as medical measurements.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SMART_SCALE_METRICS.map(({ key, inputLabel }) => (
                <label key={key} className="flex flex-col justify-between text-sm text-gray-400">
                  {inputLabel}
                  <input
                    type="number"
                    value={measurements[key as OptionalMetricKey] ?? ""}
                    onChange={(event) => setMeasurements((current) => ({ ...current, [key]: event.target.value }))}
                    min="0.1"
                    step="any"
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                  />
                </label>
              ))}
            </div>
          </details>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-green-600 py-3 font-bold hover:bg-green-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save check-in"}
          </button>
        </form>
      )}

      <div className="desk-flat rounded-xl border border-gray-800 bg-gray-900 p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-indigo-500" />
          </div>
        ) : sortedEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No check-ins yet. Log your first weekly weigh-in.
          </p>
        ) : (
          <>
            {latest && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Latest check-in</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {latest.weight !== undefined && (
                    <span className="text-2xl font-bold">{cleanWeight(latest.weight)} lbs</span>
                  )}
                  {METRICS.filter(({ key }) => key !== "weight" && latest[key] !== undefined).map((definition) => (
                    <span key={definition.key} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                      {formatMetric(definition, latest[definition.key] as number)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <label className="mb-3 block text-sm text-gray-400">
              Chart metric
              <select
                value={selectedMetric}
                onChange={(event) => setMetric(event.target.value as MetricKey)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
              >
                {availableMetrics.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <div role="img" aria-label="Body metrics trend chart" className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} domain={["auto", "auto"]} width={42} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                    formatter={(value) => [tooltipValue(Number(value), selectedDefinition)]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={2} dot={{ fill: "#22C55E", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 divide-y divide-gray-800 border-t border-gray-800">
              {sortedEntries.slice(-6).reverse().map((entry) => {
                const entryDate = asDate(entry.date);
                const dateLabel = entryDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold">
                        {entry.weight !== undefined ? `${cleanWeight(entry.weight)} lbs` : "Baseline measurements"}
                      </p>
                      <p className="text-xs text-gray-500">{dateLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(entry)}
                      aria-label={`Delete ${dateLabel} check-in`}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete check-in?"
          message="This body measurement entry will be permanently removed."
          isConfirming={deletingId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
}
