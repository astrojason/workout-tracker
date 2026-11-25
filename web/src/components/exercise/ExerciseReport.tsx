"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ExerciseDefinition, Program, ProgressionRule, WorkoutSessionDoc } from "@/lib/types";
import { scopeDefinitions } from "@/lib/types";
import { buildExerciseReport, exerciseLogCsv } from "@/lib/exercise-report";
import type { ExercisePoint, ExerciseReportData } from "@/lib/exercise-report";
import { formatChange, formatMeasure } from "@/lib/overview-stats";
import type { LiftMeasure } from "@/lib/overview-stats";
import { RANGES } from "@/components/overview/OverviewReport";

export interface ExerciseReportProps {
  name: string;
  definition: ExerciseDefinition | null; // null for an exercise logged before the exercise library
  sessions: WorkoutSessionDoc[];
  programs: Program[];
  weeks: number;
  onWeeksChange: (weeks: number) => void;
  programId: string | null; // null = all programs
  onProgramChange: (programId: string | null) => void;
  now: Date;
  reloading?: boolean;
  truncated?: boolean;
}

type Metric = "e1rm" | "top" | "volume";
const PAGE_SIZE = 20;

const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits });
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const RULE_LABELS: Record<string, string> = {
  add_5lb: "add 5 lb", "add_2.5lb": "add 2.5 lb", add_10lb: "add 10 lb", add_reps: "add reps", add_time: "add time",
  add_rounds: "add rounds", add_weight: "next weight step", reduce_assistance: "reduce assistance",
  maintain: "maintain", deload: "deload", progress_gripper: "next gripper", none: "none",
};
function ruleLabel(rule: ProgressionRule): string {
  return RULE_LABELS[rule] ?? rule.replace(/_/g, " ");
}
function equipmentLabel(def: ExerciseDefinition): string {
  const type = def.equipmentType.replace(/_/g, " ");
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return def.equipmentDetail ? `${label} · ${def.equipmentDetail}` : label;
}

const BEST_LABEL: Record<LiftMeasure, string> = {
  weight: "Heaviest set", bands: "Least assistance", time: "Longest hold", reps: "Most reps",
};

function withReps(measure: LiftMeasure, value: number, reps: number) {
  return formatMeasure(measure, value, measure === "weight" || measure === "bands" ? reps : undefined);
}

function Stat({ id, label, value, sub }: { id: string; label: string; value: string; sub?: string }) {
  return (
    <div data-testid={id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function Section({ title, sub, action, children, className = "" }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = `exercise-${title.toLowerCase().replace(/\W+/g, "-")}`;
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

// Line chart of one or two series over the sessions in range, with PR markers on the first.
function TrendChart({ report, metric }: { report: ExerciseReportData; metric: Metric }) {
  const { points, measure } = report;
  const weighted = measure === "weight";
  const primary = (p: ExercisePoint) =>
    !weighted ? p.best : metric === "e1rm" ? (p.e1rm ?? p.best) : metric === "top" ? p.best : p.volume;
  const secondary = weighted && metric === "e1rm" ? (p: ExercisePoint) => p.best : null;
  const values = points.flatMap((p) => (secondary ? [primary(p), secondary(p)] : [primary(p)]));
  const min = Math.min(...values), max = Math.max(...values);
  const pad = (max - min) * 0.15 || Math.max(1, max * 0.1);
  const lo = Math.max(0, min - pad), hi = max + pad;
  const W = 800, H = 260, L = 56, R = 16, T = 24, B = 36;
  const x = (i: number) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = (f: (p: ExercisePoint) => number) => points.map((p, i) => `${x(i).toFixed(1)},${y(f(p)).toFixed(1)}`).join(" ");
  const label = (v: number) => (measure === "time" || measure === "reps" || measure === "bands" ? formatMeasure(measure, Math.round(v)) : `${fmt(v)} lb`);
  const labelEvery = Math.ceil(points.length / 10);
  const series = !weighted ? `best ${measure === "time" ? "hold" : measure}` : metric === "e1rm" ? "estimated 1RM" : metric === "top" ? "top set weight" : "volume";
  const first = primary(points[0]), last = primary(points[points.length - 1]);
  const aria = metric === "volume" && weighted
    ? `Volume per session: ${fmt(first)} to ${fmt(last)} lb over ${points.length} sessions`
    : `Strength trend: ${series} from ${label(first)} to ${label(last)} over ${points.length} sessions`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] block" role="img" aria-label={aria}>
      {[0, 1 / 3, 2 / 3, 1].map((f) => {
        const v = lo + f * (hi - lo);
        return (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={f === 0 ? "stroke-gray-600" : "stroke-gray-800"} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-gray-400 text-[11px]">
              {measure === "time" ? formatMeasure("time", Math.round(v)) : fmt(v)}
            </text>
          </g>
        );
      })}
      {secondary && (
        <polyline points={line(secondary)} fill="none" className="stroke-orange-400" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />
      )}
      <polyline points={line(primary)} fill="none" className="stroke-indigo-400" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.sessionId}>
          <title>{`${shortDate(p.date)}: ${withReps(measure, p.best, p.reps)}${p.e1rm !== null ? ` · e1RM ${fmt(p.e1rm)} lb` : ""}${p.isPR ? " · PR" : ""}`}</title>
          {secondary && <circle cx={x(i)} cy={y(secondary(p))} r="3" className="fill-orange-400" />}
          <circle cx={x(i)} cy={y(primary(p))} r="4" className="fill-gray-900 stroke-indigo-400" strokeWidth="2" />
          {p.isPR && <path d={`M${x(i)} ${y(primary(p)) - 19}l5 5-5 5-5-5z`} className="fill-amber-400" />}
          {i % labelEvery === 0 && (
            <text x={x(i)} y={H - 12} textAnchor="middle" className="fill-gray-400 text-[11px]">{shortDate(p.date)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function ExerciseReport(props: ExerciseReportProps) {
  const { name, definition, sessions, programs, weeks, programId, now } = props;
  const [metric, setMetric] = useState<Metric>("e1rm");
  const [includeWarmups, setIncludeWarmups] = useState(false);
  const [page, setPage] = useState(0);
  const [exported, setExported] = useState<number | null>(null);
  const report = buildExerciseReport(sessions, { definitionId: definition?.id ?? null, name, weeks, now, programId });
  const { measure, stats } = report;
  const range = RANGES.find((r) => r.weeks === weeks)?.label ?? `${weeks} wk`;
  const program = programs.find((p) => p.id === programId) ?? null;
  const scoped = definition && program ? scopeDefinitions({ [definition.id]: definition }, program)[definition.id] : null;
  const loadTracked = measure === "weight" || measure === "bands";

  const rows = report.log.filter((r) => includeWarmups || r.status !== "warmup");
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => setPage(0), [weeks, programId, includeWarmups]);

  function exportCsv() {
    const blob = new Blob([exerciseLogCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-sets.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(rows.length);
  }

  const ratingTotal = report.ratings.easy + report.ratings.normal + report.ratings.hard;
  const ratingLabel = `Final-set ratings: ${report.ratings.easy} easy, ${report.ratings.normal} normal, ${report.ratings.hard} hard${report.ratings.unrated ? `, ${report.ratings.unrated} unrated` : ""}`;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/history" className="text-sm text-indigo-400 hover:text-indigo-300 w-fit">&larr; History</Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{name}</h1>
          {definition && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{equipmentLabel(definition)}</span>
              {definition.muscleGroups.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{definition.muscleGroups.join(" · ")}</span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">Progression: {ruleLabel(definition.progressionRule)}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {props.reloading && (
            <span role="status" className="flex items-center gap-2 text-sm text-gray-400">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400" aria-hidden="true" />Loading {range}…
            </span>
          )}
          <div role="group" aria-label="Date range" className="flex rounded-xl border border-gray-700 overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.weeks}
                type="button"
                aria-pressed={r.weeks === weeks}
                disabled={props.reloading}
                onClick={() => props.onWeeksChange(r.weeks)}
                className={`px-3.5 h-9 text-sm transition disabled:opacity-60 ${r.weeks === weeks ? "bg-indigo-600 text-white font-semibold" : "text-gray-300 hover:bg-gray-800"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Program
            <select value={programId ?? ""} onChange={(e) => props.onProgramChange(e.target.value || null)} className="input-field !w-auto h-9 !py-0">
              <option value="">All programs</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {measure === "weight" && (
            <label className="flex items-center gap-2 text-sm text-gray-400">
              Metric
              <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="input-field !w-auto h-9 !py-0">
                <option value="e1rm">Estimated 1RM</option>
                <option value="top">Top set weight</option>
                <option value="volume">Volume</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {props.truncated && (
        <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Only the latest sessions could be loaded for this range, so the oldest ones are missing from this report.
        </p>
      )}

      {report.points.length === 0 ? (
        <p className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-10 text-center text-gray-400">
          No sets of {name} in the last {range}{program ? ` in ${program.name}` : ""}. Try a longer range or All programs.
        </p>
      ) : (
        <>
          <section aria-label="Key numbers" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
            <Stat
              id="stat-working-load"
              label="Working load"
              value={scoped && loadTracked ? formatMeasure(measure, scoped.currentWeight) : "—"}
              sub={scoped && loadTracked ? `${program!.name} · hard streak ${scoped.hardStreak}` : program ? "Not tracked for this exercise" : "Choose a program"}
            />
            {stats.heaviest && (
              <Stat id="stat-heaviest" label={BEST_LABEL[measure]} value={withReps(measure, stats.heaviest.value, stats.heaviest.reps)} sub={shortDate(stats.heaviest.date)} />
            )}
            {stats.bestE1RM && (
              <Stat id="stat-e1rm" label="Best e1RM" value={`${fmt(stats.bestE1RM.value)} lb`} sub={shortDate(stats.bestE1RM.date)} />
            )}
            <Stat id="stat-change" label="Change" value={formatChange(measure, stats.change)} sub={`First to latest session in ${range}`} />
            {measure === "weight" && (
              <Stat id="stat-volume" label="Volume" value={`${fmt(stats.volume)} lb`} sub={`${stats.workingSets} working sets`} />
            )}
            <Stat id="stat-sessions" label="Sessions" value={String(stats.sessions)} sub={measure === "weight" ? undefined : `${stats.workingSets} working sets`} />
          </section>

          <div className="flex flex-wrap gap-5">
            <Section
              title="Trend"
              sub={`${range}${program ? ` · ${program.name}` : ""}`}
              className="flex-[999_1_560px]"
              action={(
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-indigo-400" />
                    {measure !== "weight" ? "Best set" : metric === "e1rm" ? "Estimated 1RM" : metric === "top" ? "Top set weight" : "Volume"}
                  </span>
                  {measure === "weight" && metric === "e1rm" && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-orange-400" />Top set weight</span>}
                  <span className="flex items-center gap-1.5"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0l5 5-5 5-5-5z" className="fill-amber-400" /></svg>PR</span>
                </div>
              )}
            >
              <div className="px-5 py-4 overflow-x-auto"><TrendChart report={report} metric={metric} /></div>
            </Section>

            <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-5">
              {measure === "weight" && (
                <Section title="Rep records" sub="Heaviest weight at each rep count">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="text-xs text-gray-400 bg-gray-800/40 text-left">
                        <th scope="col" className="px-5 py-2 font-semibold">Reps</th>
                        <th scope="col" className="px-3 py-2 font-semibold text-right">Weight</th>
                        <th scope="col" className="px-3 py-2 font-semibold text-right">e1RM</th>
                        <th scope="col" className="px-5 py-2 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.repRecords.map((r) => (
                        <tr key={r.reps} className="border-t border-gray-800">
                          <td className="px-5 py-2 font-semibold">{r.reps}</td>
                          <td className="px-3 py-2 text-right">{formatMeasure("weight", r.weight)}</td>
                          <td className="px-3 py-2 text-right text-gray-300">{r.e1rm === null ? "—" : `${fmt(r.e1rm)} lb`}</td>
                          <td className="px-5 py-2"><Link href={`/session/${r.sessionId}`} className="text-indigo-400 hover:text-indigo-300">{shortDate(r.date)}</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}
              <Section title="Final-set rating" sub={`How the last set of each session felt · ${range}`}>
                <div className="px-5 py-4 flex flex-col gap-2">
                  {ratingTotal === 0 ? (
                    <p className="text-sm text-gray-500">No rated sets in this range.</p>
                  ) : (
                    <div role="img" aria-label={ratingLabel} className="flex h-2.5 rounded overflow-hidden">
                      <span className="bg-indigo-800" style={{ flex: report.ratings.easy }} />
                      <span className="bg-indigo-400" style={{ flex: report.ratings.normal }} />
                      <span className="bg-orange-400" style={{ flex: report.ratings.hard }} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>Easy {report.ratings.easy}</span><span>Normal {report.ratings.normal}</span><span>Hard {report.ratings.hard}</span>
                    {report.ratings.unrated > 0 && <span>Unrated {report.ratings.unrated}</span>}
                  </div>
                </div>
              </Section>
            </div>
          </div>

          <Section
            title="Set log"
            sub={`${rows.length} ${includeWarmups ? "sets" : "working sets"} across ${report.points.length} sessions`}
            action={(
              <div className="flex flex-wrap items-center gap-3">
                {exported !== null && <span role="status" className="text-xs text-green-400">&#x2713; Downloaded {exported} sets</span>}
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={includeWarmups} onChange={(e) => setIncludeWarmups(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                  Include warm-ups
                </label>
                <button type="button" onClick={exportCsv} className="h-9 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition">Export CSV</button>
              </div>
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Date</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Session</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold text-right">Set</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold text-right">Target</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold text-right">{measure === "time" ? "Time" : measure === "reps" ? "Reps" : "Load"}</th>
                    {loadTracked && <th scope="col" className="px-3 py-2.5 font-semibold text-right">Reps</th>}
                    {measure === "weight" && <th scope="col" className="px-3 py-2.5 font-semibold text-right">e1RM</th>}
                    <th scope="col" className="px-3 py-2.5 font-semibold">Rating</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => {
                    const firstOfSession = i === 0 || shown[i - 1].sessionId !== r.sessionId;
                    return (
                      <tr key={`${r.sessionId}-${r.setNumber}-${r.phase}-${i}`} className={`whitespace-nowrap border-t ${firstOfSession ? "border-gray-800" : "border-gray-800/40"} ${r.status === "done" ? "" : "text-gray-400"}`}>
                        <td className="px-5 py-2">
                          {firstOfSession && <Link href={`/session/${r.sessionId}`} className="text-indigo-400 hover:text-indigo-300">{r.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</Link>}
                        </td>
                        <td className="px-3 py-2">{firstOfSession && `${r.programName} · ${r.dayOfWeek} · W${r.week}`}</td>
                        <td className="px-3 py-2 text-right">
                          {r.status === "warmup" ? <span className="text-xs text-gray-500">Warm-up</span> : r.setNumber}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400">
                          {measure === "time" ? formatMeasure("time", r.targetReps) : loadTracked ? `${formatMeasure(measure, r.targetWeight)} × ${r.targetReps}` : `${r.targetReps} reps`}
                        </td>
                        {r.status === "skipped" ? (
                          <td colSpan={loadTracked ? 2 : 1} className="px-3 py-2 text-right text-gray-500">Skipped</td>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-right font-semibold">
                              {loadTracked ? formatMeasure(measure, r.weight) : formatMeasure(measure, r.reps)}
                            </td>
                            {loadTracked && <td className="px-3 py-2 text-right">{r.reps}{r.status === "failed" && <span className="ml-1.5 text-xs text-red-400">Failed</span>}</td>}
                          </>
                        )}
                        {measure === "weight" && <td className="px-3 py-2 text-right text-gray-300">{r.e1rm === null ? "—" : fmt(r.e1rm)}</td>}
                        <td className={`px-3 py-2 capitalize ${r.rating === "hard" ? "text-orange-400" : r.rating === "easy" ? "text-indigo-300" : "text-gray-300"}`}>{r.rating ?? "—"}</td>
                        <td className="px-5 py-2 text-gray-400">{r.notes ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 text-sm text-gray-400">
                <span>Showing {page * PAGE_SIZE + 1}–{Math.min(rows.length, (page + 1) * PAGE_SIZE)} of {rows.length}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="h-8 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40">Previous</button>
                  <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="h-8 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
