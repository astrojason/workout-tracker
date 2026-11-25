"use client";

import { useState, type FormEvent } from "react";
import type { BodyMeasurementDoc, BodyMeasurementInput } from "@/lib/types";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { RANGES } from "@/components/overview/OverviewReport";
import { rangeStart } from "@/lib/overview-stats";
import {
  CIRCUMFERENCE_METRICS, METRICS, SMART_SCALE_METRICS, bodyCsv, entryDate, metricDefinition, metricSummary,
  movingAverage, parseMeasurementFields, sideDifferences, tapeChanges,
} from "@/lib/body-report";
import type { MetricDefinition, MetricKey } from "@/lib/body-report";
import { useMeasurementImport } from "./useMeasurementImport";

// Each handler reports its own errors and resolves false when it failed.
export interface BodyReportProps {
  entries: BodyMeasurementDoc[];
  onSave: (measurement: BodyMeasurementInput) => Promise<boolean>;
  onUpdate: (id: string, measurement: BodyMeasurementInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  now: Date;
}

const HEADLINE: MetricKey[] = ["weight", "bodyFatPercentage", "waist", "muscleMass", "heartRate"];
const TABLE_ROWS = 10;
const ALL = 0;

const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const longDate = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const num = (n: number) => String(Math.round(n * 1000) / 1000);
const unitText = (m: MetricDefinition) => (m.unit === "lbs" ? "lb" : m.unit);
const withUnit = (m: MetricDefinition, n: number) => (m.unit === "%" ? `${num(n)}%` : m.unit ? `${num(n)} ${unitText(m)}` : num(n));
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function spark(values: number[], w = 84, h = 24): string {
  if (values.length < 2) return "";
  const min = Math.min(...values), span = Math.max(...values) - min || 1;
  return values.map((v, i) => `${(2 + (i * (w - 4)) / (values.length - 1)).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
}

function Section({ title, sub, action, children, className = "" }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = `body-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={`bg-gray-900 border border-gray-800 rounded-xl min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
        <div>
          <h2 id={id} className="font-semibold">{title}</h2>
          {sub && <p className="text-sm text-gray-400">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function BodyReport({ entries, onSave, onUpdate, onDelete, now }: BodyReportProps) {
  const [weeks, setWeeks] = useState(12);
  const [chartKey, setChartKey] = useState<MetricKey>("weight");
  const [showComposition, setShowComposition] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [exported, setExported] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BodyMeasurementDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<BodyMeasurementDoc | null>(null);
  const measurementImport = useMeasurementImport(onSave);

  const start = weeks === ALL ? new Date(0) : rangeStart(weeks, now);
  const inRange = entries.filter((e) => entryDate(e) >= start);
  const rangeLabel = weeks === ALL ? "all time" : `the last ${RANGES.find((r) => r.weeks === weeks)?.long ?? `${weeks} weeks`}`;
  const latest = [...entries].sort((a, b) => entryDate(b).getTime() - entryDate(a).getTime())[0];
  const charted = METRICS.filter((m) => inRange.some((e) => typeof e[m.key] === "number"));
  const chartMetric = charted.find((m) => m.key === chartKey) ?? charted[0];
  const tape = tapeChanges(inRange);
  const sides = sideDifferences(entries);
  const firstInRange = [...inRange].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime())[0];

  const composition = SMART_SCALE_METRICS.filter((m) => !HEADLINE.includes(m.key) && inRange.some((e) => typeof e[m.key] === "number"));
  // Newest first; check-ins on the same day keep the one added last on top.
  const rows = inRange.map((e, i) => ({ e, i })).sort((a, b) => entryDate(b.e).getTime() - entryDate(a.e).getTime() || b.i - a.i).map((x) => x.e);
  const shownRows = showAll ? rows : rows.slice(0, TABLE_ROWS);

  function exportCsv() {
    const blob = new Blob([bodyCsv(inRange)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "body-measurements.csv";
    a.click();
    URL.revokeObjectURL(url);
    setExported(inRange.length);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await onDelete(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      if (editing?.id === deleteTarget.id) setEditing(null);
      setDeleteTarget(null);
    }
  }

  const cell = (e: BodyMeasurementDoc, key: MetricKey) => (typeof e[key] === "number" ? num(e[key] as number) : "—");
  const pair = (e: BodyMeasurementDoc, l: MetricKey, r: MetricKey) =>
    typeof e[l] !== "number" && typeof e[r] !== "number" ? "—" : `${cell(e, l)} / ${cell(e, r)}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Body</h1>
          <p className="text-gray-400">
            {entries.length === 0 ? "No check-ins yet" : `${entries.length} check-ins · last logged ${longDate(entryDate(latest))}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Date range" className="flex rounded-xl border border-gray-700 overflow-hidden">
            {[...RANGES, { weeks: ALL, label: "All" }].map((r) => (
              <button
                key={r.weeks}
                type="button"
                aria-pressed={r.weeks === weeks}
                onClick={() => { setWeeks(r.weeks); setShowAll(false); }}
                className={`px-3.5 h-9 text-sm transition ${r.weeks === weeks ? "bg-indigo-600 text-white font-semibold" : "text-gray-300 hover:bg-gray-800"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {measurementImport.fileInput}
          <button type="button" onClick={measurementImport.open} className="h-9 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold">Import spreadsheet</button>
          <button type="button" onClick={exportCsv} disabled={inRange.length === 0} className="h-9 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">Export CSV</button>
          {exported !== null && <span role="status" className="text-xs text-green-400">&#x2713; Downloaded {exported} check-ins</span>}
        </div>
      </div>

      {measurementImport.panel}

      <section aria-label="Key numbers" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        {HEADLINE.map((key) => {
          const m = metricDefinition(key);
          const s = metricSummary(inRange, key);
          const id = key === "bodyFatPercentage" ? "fat" : key === "muscleMass" ? "muscle" : key === "heartRate" ? "heart" : key;
          return (
            <div key={key} data-testid={`kpi-${id}`} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{key === "heartRate" ? "Resting heart rate" : m.label}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums">{s ? num(s.latest) : "—"}</span>
                {s && <span className="text-gray-400">{unitText(m)}</span>}
              </div>
              <div className="flex items-end justify-between gap-2 text-sm">
                {/* Neutral colours: the app doesn't know whether you're aiming up or down. */}
                <span className="flex flex-col">
                  <span className="font-medium text-gray-300">
                    {!s ? "No entries" : s.points.length < 2 ? "One entry" : s.change === 0 ? "No change" : `${s.change > 0 ? "▲" : "▼"} ${withUnit(m, Math.abs(s.change))}`}
                  </span>
                  <span className="text-xs text-gray-500">{s && s.points.length >= 2 ? `over ${rangeLabel.replace("the last ", "")}` : `in ${rangeLabel}`}</span>
                </span>
                {s && s.points.length >= 2 && (
                  <svg width="84" height="24" viewBox="0 0 84 24" aria-hidden="true"><polyline points={spark(s.points)} fill="none" className="stroke-indigo-400" strokeWidth="1.75" strokeLinejoin="round" /></svg>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-5 items-start">
        <Section
          title={chartMetric ? `${chartMetric.label} trend` : "Trend"}
          sub={`Each check-in, with the 4-entry average · ${rangeLabel}`}
          className="flex-[999_1_600px]"
          action={(
            <div role="group" aria-label="Measurement" className="flex flex-wrap items-center gap-1.5">
              {charted.filter((m) => HEADLINE.includes(m.key)).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={m.key === chartMetric?.key}
                  onClick={() => setChartKey(m.key)}
                  className={`h-7 px-3 rounded-full text-xs font-semibold ${m.key === chartMetric?.key ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
                >
                  {m.label}
                </button>
              ))}
              {charted.some((m) => !HEADLINE.includes(m.key)) && (
                <select
                  aria-label="Other measurement"
                  value={chartMetric && !HEADLINE.includes(chartMetric.key) ? chartMetric.key : ""}
                  onChange={(e) => e.target.value && setChartKey(e.target.value as MetricKey)}
                  className="input-field !w-auto h-7 !py-0 text-xs"
                >
                  <option value="">More…</option>
                  {charted.filter((m) => !HEADLINE.includes(m.key)).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              )}
            </div>
          )}
        >
          <div className="px-5 py-4 overflow-x-auto">
            <TrendChart entries={inRange} metric={chartMetric} />
          </div>
        </Section>

        <CheckInForm
          key={editing?.id ?? "new"}
          editing={editing}
          onSubmit={(m) => (editing ? onUpdate(editing.id, m) : onSave(m))}
          onDone={() => setEditing(null)}
        />
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <Section
          title={firstInRange ? `Tape changes since ${shortDate(entryDate(firstInRange))}` : "Tape changes"}
          sub="First and latest measurement in the range, in inches"
          className="flex-[999_1_560px]"
        >
          {tape.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">Measure the same spot twice in this range to see how it changed.</p>
          ) : (
            <ul className="px-5 py-3 flex flex-col gap-1.5">
              {tape.map((t) => {
                const w = Math.min(50, Math.abs(t.change) * 50);
                return (
                  <li key={t.key} className="grid grid-cols-[120px_100px_minmax(0,1fr)_64px] items-center gap-3 text-sm">
                    <span className="text-gray-300">{t.label}</span>
                    <span className="text-gray-400 tabular-nums">{num(t.first)} → {num(t.latest)}</span>
                    <span className="relative h-3.5 block" aria-hidden="true">
                      <span className="absolute left-1/2 -top-0.5 -bottom-0.5 w-px bg-gray-700" />
                      <span
                        className={`absolute top-0.5 h-2.5 rounded-sm ${t.change < 0 ? "bg-orange-400" : "bg-indigo-400"}`}
                        style={{ left: `${t.change < 0 ? 50 - w : 50}%`, width: `${w}%` }}
                      />
                    </span>
                    <span className={`text-right font-semibold tabular-nums ${t.change === 0 ? "text-gray-400" : ""}`}>
                      {t.change === 0 ? "0" : `${t.change > 0 ? "+" : "−"}${num(Math.abs(t.change))}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Left vs right" sub="Latest check-in measuring both sides · in" className="flex-[1_1_340px]">
          {sides.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">No left and right measurements yet.</p>
          ) : (
            <>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-800/40 text-left">
                    <th scope="col" className="px-5 py-2"><span className="sr-only">Measurement</span></th>
                    <th scope="col" className="px-3 py-2 font-semibold text-right">Left</th>
                    <th scope="col" className="px-3 py-2 font-semibold text-right">Right</th>
                    <th scope="col" className="px-5 py-2 font-semibold text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {sides.map((d) => (
                    <tr key={d.label} className="border-t border-gray-800">
                      <th scope="row" className="px-5 py-2.5 font-semibold text-left">{d.label}</th>
                      <td className="px-3 py-2.5 text-right">{num(d.left)}</td>
                      <td className="px-3 py-2.5 text-right">{num(d.right)}</td>
                      <td className={`px-5 py-2.5 text-right ${d.difference === 0 ? "text-gray-400" : Math.abs(d.difference) >= 0.5 ? "text-amber-300 font-semibold" : "text-gray-300"}`}>
                        {d.difference === 0 ? "Even" : `${d.difference > 0 ? "Right" : "Left"} +${num(Math.abs(d.difference))}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-5 py-3 text-xs text-gray-500">Differences of 0.5 in or more are highlighted.</p>
            </>
          )}
        </Section>
      </div>

      <Section
        title="Measurements"
        sub={`${rows.length} check-ins in ${rangeLabel} · newest first · blank where not measured`}
        action={composition.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={showComposition} onChange={(e) => setShowComposition(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
            Show composition columns
          </label>
        )}
      >
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">No check-ins in {rangeLabel}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Weight</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Body fat</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Muscle</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Chest</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Waist</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Hips</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Bicep L / R</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Thigh L / R</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Calf L / R</th>
                  {showComposition && composition.map((m) => <th key={m.key} scope="col" className="px-3 py-2.5 font-semibold text-right">{m.label}</th>)}
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map((e) => {
                  const day = longDate(entryDate(e));
                  return (
                    <tr key={e.id} className={`border-t border-gray-800 whitespace-nowrap ${editing?.id === e.id ? "bg-indigo-950/50" : ""}`}>
                      <td className="px-5 py-2">{day}</td>
                      <td className="px-3 py-2 text-right font-semibold">{typeof e.weight === "number" ? `${num(e.weight)} lb` : "—"}</td>
                      <td className="px-3 py-2 text-right">{typeof e.bodyFatPercentage === "number" ? `${num(e.bodyFatPercentage)}%` : "—"}</td>
                      <td className="px-3 py-2 text-right">{typeof e.muscleMass === "number" ? `${num(e.muscleMass)} lb` : "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{cell(e, "chest")}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{cell(e, "waist")}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{cell(e, "hips")}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{pair(e, "leftBicep", "rightBicep")}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{pair(e, "leftThigh", "rightThigh")}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{pair(e, "leftCalf", "rightCalf")}</td>
                      {showComposition && composition.map((m) => (
                        <td key={m.key} className="px-3 py-2 text-right text-gray-300">{typeof e[m.key] === "number" ? withUnit(m, e[m.key] as number) : "—"}</td>
                      ))}
                      <td className="px-5 py-1.5 text-right">
                        <button type="button" aria-label={`Edit ${day}`} onClick={() => setEditing(e)} className="h-8 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300">Edit</button>
                        <button type="button" aria-label={`Delete ${day}…`} onClick={() => setDeleteTarget(e)} className="ml-1 h-8 px-2.5 rounded-lg text-xs text-red-400 hover:bg-gray-800">Delete…</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > TABLE_ROWS && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 text-sm text-gray-400">
            <span>Showing {shownRows.length} of {rows.length}</span>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="h-8 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white">{showAll ? "Show fewer" : "Show all"}</button>
          </div>
        )}
      </Section>

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Delete check-in"
          message={`Delete the ${longDate(entryDate(deleteTarget))} check-in and all its measurements? This cannot be undone.`}
          isConfirming={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function TrendChart({ entries, metric }: { entries: BodyMeasurementDoc[]; metric: MetricDefinition | undefined }) {
  if (!metric) return <p className="py-10 text-center text-sm text-gray-500">No check-ins in this range.</p>;
  const points = [...entries]
    .filter((e) => typeof e[metric.key] === "number")
    .sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime())
    .map((e) => ({ date: entryDate(e), value: e[metric.key] as number }));
  if (points.length < 2) return <p className="py-10 text-center text-sm text-gray-500">Log {metric.label.toLowerCase()} at least twice to see a trend.</p>;
  const values = points.map((p) => p.value);
  const avg = movingAverage(values, 4);
  const min = Math.min(...values), max = Math.max(...values);
  const pad = (max - min) * 0.2 || 1;
  const lo = min - pad, hi = max + pad;
  const W = 800, H = 260, L = 56, R = 12, T = 16, B = 36;
  const x = (i: number) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = (vs: number[]) => vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const every = Math.ceil(points.length / 10);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] block" role="img"
        aria-label={`${metric.label} over ${points.length} check-ins: ${withUnit(metric, values[0])} to ${withUnit(metric, values[values.length - 1])}`}>
        {[0, 1 / 3, 2 / 3, 1].map((f) => {
          const v = lo + f * (hi - lo);
          return (
            <g key={f}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-gray-800" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-gray-400 text-[11px]">{num(Math.round(v * 10) / 10)}</text>
            </g>
          );
        })}
        <polyline points={line(avg)} fill="none" className="stroke-orange-400" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />
        <polyline points={line(values)} fill="none" className="stroke-indigo-400" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.date.getTime() + i}>
            <title>{`${shortDate(p.date)}: ${withUnit(metric, p.value)}`}</title>
            <circle cx={x(i)} cy={y(p.value)} r="4" className="fill-gray-900 stroke-indigo-400" strokeWidth="2" />
            {i % every === 0 && <text x={x(i)} y={H - 12} textAnchor="middle" className="fill-gray-400 text-[11px]">{shortDate(p.date)}</text>}
          </g>
        ))}
      </svg>
      <div className="flex gap-4 text-xs text-gray-400 pt-1">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-indigo-400" />Check-in</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-orange-400" />4-entry average</span>
      </div>
    </>
  );
}

const SIDE_ROWS: { label: string; left: MetricKey; right: MetricKey }[] = [
  { label: "Bicep", left: "leftBicep", right: "rightBicep" },
  { label: "Thigh", left: "leftThigh", right: "rightThigh" },
  { label: "Calf", left: "leftCalf", right: "rightCalf" },
];
const FORM_TOP: MetricKey[] = ["weight", "bodyFatPercentage", "muscleMass"];
const FORM_TAPE: MetricKey[] = ["chest", "waist", "hips"];
const FORM_MORE = SMART_SCALE_METRICS.filter((m) => !FORM_TOP.includes(m.key));

// Logging a new check-in, or editing one picked from the table.
function CheckInForm({ editing, onSubmit, onDone }: {
  editing: BodyMeasurementDoc | null;
  onSubmit: (m: BodyMeasurementInput) => Promise<boolean>;
  onDone: () => void;
}) {
  const initialFields = () => Object.fromEntries(
    METRICS.filter((m) => editing && typeof editing[m.key] === "number").map((m) => [m.key, num(editing![m.key] as number)]),
  ) as Partial<Record<MetricKey, string>>;
  const [date, setDate] = useState(() => isoDay(editing ? entryDate(editing) : new Date()));
  const [fields, setFields] = useState<Partial<Record<MetricKey, string>>>(initialFields);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const hasMore = FORM_MORE.some((m) => fields[m.key]);

  const set = (key: MetricKey, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setState("idle");
    setError(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseMeasurementFields(date, fields);
    if (!parsed.ok) { setError(parsed.error); return; }
    setState("saving");
    const ok = await onSubmit(parsed.value);
    if (!ok) { setState("idle"); return; }
    setState("saved");
    if (editing) onDone();
    else setFields({});
  }

  const input = (key: MetricKey, label?: string) => {
    const m = metricDefinition(key);
    return (
      <input
        aria-label={label ? undefined : m.inputLabel}
        value={fields[key] ?? ""}
        disabled={state === "saving"}
        inputMode="decimal"
        onChange={(e) => set(key, e.target.value)}
        className="input-field !py-1.5"
      />
    );
  };
  const field = (key: MetricKey) => (
    <label key={key} className="flex flex-col gap-1 text-xs text-gray-400">
      {metricDefinition(key).inputLabel}
      {input(key, "visible")}
    </label>
  );

  const title = editing ? `Edit ${entryDate(editing).toLocaleDateString("en-US", { month: "short", day: "numeric" })} check-in` : "Log a check-in";
  return (
    <section aria-labelledby="body-form-title" className="flex-[1_1_340px] min-w-0 bg-gray-900 border border-gray-800 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-800">
        <h2 id="body-form-title" className="font-semibold">{title}</h2>
        <p className="text-sm text-gray-400">{editing ? "Clear a field to remove that measurement." : "Fill in what you measured; leave the rest blank."}</p>
      </div>
      <form onSubmit={submit} className="px-5 py-4 flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Date
            <input type="date" value={date} disabled={state === "saving"} onChange={(e) => { setDate(e.target.value); setState("idle"); setError(null); }} className="input-field !py-1.5" />
          </label>
          {FORM_TOP.map(field)}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Tape (in)</legend>
          <div className="grid grid-cols-3 gap-3">
            {FORM_TAPE.map((key) => (
              <label key={key} className="flex flex-col gap-1 text-xs text-gray-400">
                {metricDefinition(key).label}
                <input
                  aria-label={metricDefinition(key).inputLabel}
                  value={fields[key] ?? ""}
                  disabled={state === "saving"}
                  inputMode="decimal"
                  onChange={(e) => set(key, e.target.value)}
                  className="input-field !py-1.5"
                />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 items-center text-sm text-gray-300">
            <span /><span className="text-xs text-gray-500">Left</span><span className="text-xs text-gray-500">Right</span>
            {SIDE_ROWS.map((r) => [
              <span key={`${r.label}-l`}>{r.label}</span>,
              <span key={r.left}>{input(r.left)}</span>,
              <span key={r.right}>{input(r.right)}</span>,
            ])}
          </div>
        </fieldset>
        <details open={hasMore} className="rounded-xl border border-gray-800 px-3 py-2">
          <summary className="cursor-pointer text-sm text-gray-300">Scale and composition · {FORM_MORE.length} more fields</summary>
          <div className="grid grid-cols-2 gap-3 pt-3">{FORM_MORE.map((m) => field(m.key))}</div>
        </details>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          {state === "saved" && !editing && <span role="status" className="mr-auto text-sm text-green-400">&#x2713; Saved</span>}
          {editing ? (
            <button type="button" onClick={onDone} disabled={state === "saving"} className="h-9 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">Cancel edit</button>
          ) : (
            <button type="button" onClick={() => { setFields({}); setError(null); setState("idle"); }} disabled={state === "saving"} className="h-9 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">Clear</button>
          )}
          <button type="submit" disabled={state === "saving"} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2">
            {state === "saving" && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" aria-hidden="true" />}
            {state === "saving" ? "Saving…" : editing ? "Save changes" : "Save check-in"}
          </button>
        </div>
      </form>
    </section>
  );
}
