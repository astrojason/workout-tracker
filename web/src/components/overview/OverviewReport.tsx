"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BodyMeasurementDoc, ExerciseDefinition, Program, WorkoutSessionDoc } from "@/lib/types";
import { formatDuration, scopeDefinitions } from "@/lib/types";
import { useError } from "@/components/providers/ErrorProvider";
import {
  bodyweightTrend, buildOverview, dailyStatus, isWorkingSet, rangeStart, sessionDate, sessionVolume,
} from "@/lib/overview-stats";
import type { DayStatus, LiftSummary } from "@/lib/overview-stats";

export const RANGES = [
  { weeks: 4, label: "4 wk" },
  { weeks: 12, label: "12 wk" },
  { weeks: 26, label: "6 mo" },
  { weeks: 52, label: "1 yr" },
] as const;

// The consistency grid always covers the last 12 weeks, whatever the range.
export const CONSISTENCY_WEEKS = 12;
const RECENT_SHOWN = 8;

export interface OverviewReportProps {
  sessions: WorkoutSessionDoc[];
  measurements: BodyMeasurementDoc[];
  programs: Program[];
  definitions: Record<string, ExerciseDefinition>;
  weeks: number;
  onWeeksChange: (weeks: number) => void;
  programId: string | null; // null = all programs
  onProgramChange: (programId: string | null) => void;
  onSaveWeight: (programId: string, definitionId: string, weight: number, hardStreak: number) => Promise<void>;
  now: Date;
  reloading?: boolean;  // a wider range is loading; the numbers shown are for the previous one
  truncated?: boolean;  // the session load hit its limit, so the oldest sessions are missing
}

const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits });

function sparkPoints(values: number[], w: number, h: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  return values.map((v, i) => `${(2 + (i * (w - 4)) / (values.length - 1)).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
}

function Spark({ values, w = 84, h = 24 }: { values: number[]; w?: number; h?: number }) {
  const points = sparkPoints(values, w, h);
  if (!points) return null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={points} fill="none" className="stroke-indigo-400" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Delta({ current, prior, unit = "", label, lowerIsGood = false }: { current: number; prior: number; unit?: string; label: string; lowerIsGood?: boolean }) {
  if (prior === 0 && current === 0) return <span className="text-gray-500">No sessions in either period</span>;
  if (prior === 0) return <span className="text-gray-400">Nothing in the prior {label}</span>;
  const diff = current - prior;
  if (diff === 0) return <span className="text-gray-400">Same as prior {label}</span>;
  const good = lowerIsGood ? diff < 0 : diff > 0;
  return (
    <span className={good ? "text-green-400" : "text-orange-400"}>
      {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff), 1)}{unit} vs prior {label}
    </span>
  );
}

function Kpi({ id, label, value, unit, children, spark }: { id: string; label: string; value: string; unit?: string; children: React.ReactNode; spark?: number[] }) {
  return (
    <div data-testid={id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        {unit && <span className="text-gray-400">{unit}</span>}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        {children}
        {spark && <Spark values={spark} />}
      </div>
    </div>
  );
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "invalid"; message: string };

// The working weight for one lift in one program, edited in place. Enter or leaving the field saves.
function WeightCell({ name, weight, onSave }: { name: string; weight: number; onSave: (w: number) => Promise<void> }) {
  const { showError } = useError();
  const [draft, setDraft] = useState(String(weight));
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    if (state.kind !== "saving") setDraft(String(weight));
    // Only resync when the saved weight itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weight]);

  async function commit() {
    if (draft.trim() === String(weight)) return;
    const next = Number(draft.trim());
    if (!draft.trim() || !Number.isFinite(next) || next <= 0) {
      setState({ kind: "invalid", message: "Enter a weight above 0" });
      return;
    }
    setState({ kind: "saving" });
    try {
      await onSave(next);
      setState({ kind: "saved" });
    } catch (err) {
      setDraft(String(weight));
      setState({ kind: "idle" });
      showError(err);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {state.kind === "saving" && (
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-400" aria-hidden="true" />Saving…
        </span>
      )}
      {state.kind === "saved" && <span className="text-xs text-green-400">&#x2713; Saved</span>}
      {state.kind === "invalid" && <span className="text-xs text-orange-400">{state.message}</span>}
      <label className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-2 h-8 focus-within:border-indigo-500">
        <span className="sr-only">Working weight for {name}</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={state.kind === "saving"}
          aria-busy={state.kind === "saving"}
          onChange={(e) => { setDraft(e.target.value); if (state.kind !== "saving") setState({ kind: "idle" }); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          onBlur={commit}
          className="w-14 bg-transparent text-right font-semibold tabular-nums outline-none disabled:opacity-60"
        />
        <span className="text-xs text-gray-400">lb</span>
      </label>
    </div>
  );
}

const DAY_STYLE: Record<DayStatus, string> = {
  completed: "bg-indigo-500",
  partial: "bg-indigo-900 border border-indigo-500",
  skipped: "border-2 border-amber-500",
  rest: "bg-gray-800",
  upcoming: "border border-dashed border-gray-700",
};
const DAY_LABEL: Record<DayStatus, string> = {
  completed: "Completed", partial: "Partial", skipped: "Skipped", rest: "No session", upcoming: "Upcoming",
};

function Section({ title, sub, action, children, className = "" }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = `overview-${title.toLowerCase().replace(/\W+/g, "-")}`;
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

export function OverviewReport(props: OverviewReportProps) {
  const { sessions, measurements, programs, definitions, weeks, programId, now } = props;
  const range = RANGES.find((r) => r.weeks === weeks)?.label ?? `${weeks} wk`;
  const overview = buildOverview(sessions, { weeks, now, programId });
  const start = rangeStart(weeks, now);
  const bodyweight = bodyweightTrend(measurements, start);
  const days = dailyStatus(programId ? sessions.filter((s) => s.programId === programId) : sessions, CONSISTENCY_WEEKS, now);
  const daysDone = days.filter((d) => d.status === "completed").length;
  const program = programs.find((p) => p.id === programId) ?? null;
  const scoped = program ? scopeDefinitions(definitions, program) : null;

  const vols = overview.weeklyVolume;
  const maxVol = Math.max(1, ...vols.map((w) => w.volume));
  const chartTop = Math.ceil(maxVol / 5000) * 5000;
  const slot = 736 / vols.length;
  const labelEvery = Math.ceil(vols.length / 13);
  const nameFor = (definitionId: string) =>
    definitions[definitionId]?.name ?? overview.lifts.find((l) => l.definitionId === definitionId)?.name ?? `Unknown exercise (${definitionId})`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="text-gray-400">
            {program ? program.name : "All programs"} &middot;{" "}
            {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
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
            <select
              value={programId ?? ""}
              onChange={(e) => props.onProgramChange(e.target.value || null)}
              className="input-field !w-auto h-9 !py-0"
            >
              <option value="">All programs</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {props.truncated && (
        <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Only the latest sessions could be loaded for this range, so the oldest ones are missing from these numbers.
        </p>
      )}

      <section aria-label="Key numbers" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <Kpi id="kpi-sessions" label="Sessions" value={fmt(overview.sessions.current)}>
          <Delta current={overview.sessions.current} prior={overview.sessions.prior} label={range} />
        </Kpi>
        <Kpi id="kpi-volume" label="Volume" value={fmt(overview.volume.current)} unit="lb" spark={vols.map((w) => w.volume)}>
          <Delta current={overview.volume.current} prior={overview.volume.prior} unit=" lb" label={range} />
        </Kpi>
        <Kpi id="kpi-duration" label="Avg duration" value={overview.avgDurationSeconds.current === null ? "—" : formatDuration(overview.avgDurationSeconds.current)}>
          {overview.avgDurationSeconds.current !== null && overview.avgDurationSeconds.prior !== null ? (
            <Delta current={Math.round(overview.avgDurationSeconds.current / 60)} prior={Math.round(overview.avgDurationSeconds.prior / 60)} unit=" min" label={range} lowerIsGood />
          ) : <span className="text-gray-500">Finished sessions only</span>}
        </Kpi>
        <Kpi id="kpi-sets" label="Working sets" value={fmt(overview.workingSets.current)}>
          <Delta current={overview.workingSets.current} prior={overview.workingSets.prior} label={range} />
        </Kpi>
        <Kpi id="kpi-bodyweight" label="Bodyweight" value={bodyweight ? fmt(bodyweight.latest, 1) : "—"} unit={bodyweight ? "lb" : undefined} spark={bodyweight?.points}>
          {bodyweight ? (
            <span className="text-gray-400">{bodyweight.change === 0 ? "No change" : `${bodyweight.change > 0 ? "▲" : "▼"} ${fmt(Math.abs(bodyweight.change), 1)} lb`} in {range}</span>
          ) : <Link href="/history" className="text-indigo-400 hover:text-indigo-300">Add a weigh-in</Link>}
        </Kpi>
      </section>

      <div className="flex flex-wrap gap-5">
        <Section title="Weekly volume" sub="Working sets, weight × reps" className="flex-[999_1_560px]">
          <div className="px-5 py-4 overflow-x-auto">
            <svg viewBox="0 0 800 250" className="w-full min-w-[560px] block" role="img"
              aria-label={`Weekly volume over ${vols.length} weeks: ${vols.map((w) => fmt(w.volume)).join(", ")} lb`}>
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <g key={f}>
                  <line x1="56" x2="800" y1={210 - f * 200} y2={210 - f * 200} className={f === 0 ? "stroke-gray-600" : "stroke-gray-800"} />
                  <text x="48" y={214 - f * 200} textAnchor="end" className="fill-gray-400 text-[11px]">{fmt((chartTop * f) / 1000, 1)}k</text>
                </g>
              ))}
              {vols.map((w, i) => {
                const h = (w.volume / chartTop) * 200;
                const x = 64 + i * slot;
                const bw = Math.max(4, slot * 0.62);
                return (
                  <g key={w.weekStart.getTime()}>
                    <title>{`Week of ${w.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${fmt(w.volume)} lb`}</title>
                    <rect x={x} y={210 - h} width={bw} height={h} rx="3" className="fill-indigo-500" />
                    {i % labelEvery === 0 && (
                      <text x={x + bw / 2} y="230" textAnchor="middle" className="fill-gray-400 text-[11px]">
                        {w.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </Section>

        <Section title="Consistency" sub={`${daysDone} training days in the last ${CONSISTENCY_WEEKS} weeks`} className="flex-[1_1_340px]">
          <div className="px-5 py-4 flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="grid grid-rows-7 gap-1 text-[10px] leading-[18px] text-gray-400">
                {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="grid grid-flow-col grid-rows-7 auto-cols-[18px] gap-1">
                {days.map((d) => (
                  <span
                    key={d.date.getTime()}
                    title={`${d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}: ${DAY_LABEL[d.status]}`}
                    className={`h-[18px] w-[18px] rounded box-border ${DAY_STYLE[d.status]}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              {(["completed", "partial", "skipped", "rest"] as DayStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm box-border ${DAY_STYLE[s]}`} />{DAY_LABEL[s]}</span>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <Section
        title="Lift progression"
        sub={program ? `Working weight is editable — it changes ${program.name} only.` : "Choose a program to edit working weights."}
      >
        {overview.lifts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">No weighted working sets in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Exercise</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Working weight</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Change</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Top set trend</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Best e1RM</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Last top set</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Hard streak</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {overview.lifts.map((lift: LiftSummary) => {
                  const def = lift.definitionId && scoped ? scoped[lift.definitionId] : undefined;
                  return (
                    <tr key={lift.key} className="border-t border-gray-800 whitespace-nowrap">
                      <td className="px-5 py-2.5">
                        <Link href={`/exercise/${encodeURIComponent(lift.name)}`} className="font-semibold text-indigo-400 hover:text-indigo-300">{lift.name}</Link>
                        {def && def.muscleGroups.length > 0 && <div className="text-xs text-gray-400">{def.muscleGroups.join(" · ")}</div>}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {program && def ? (
                          <WeightCell
                            name={lift.name}
                            weight={def.currentWeight}
                            onSave={(w) => props.onSaveWeight(program.id, def.id, w, def.hardStreak)}
                          />
                        ) : <span className="text-gray-500">—</span>}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-medium ${lift.change > 0 ? "text-green-400" : lift.change < 0 ? "text-orange-400" : "text-gray-400"}`}>
                        {lift.change > 0 ? "+" : lift.change < 0 ? "−" : ""}{fmt(Math.abs(lift.change), 2)} lb
                      </td>
                      <td className="px-3 py-2.5"><Spark values={lift.topWeights} w={96} /></td>
                      <td className="px-3 py-2.5 text-right">{lift.bestE1RM === null ? "—" : `${fmt(lift.bestE1RM)} lb`}</td>
                      <td className="px-3 py-2.5 text-right text-gray-300">{fmt(lift.latestTop.weight, 2)} × {lift.latestTop.reps}</td>
                      <td className="px-3 py-2.5 text-right text-gray-300">{def ? def.hardStreak : "—"}</td>
                      <td className="px-5 py-2.5 text-right text-gray-300">{lift.sessions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="flex flex-wrap gap-5">
        <Section
          title="Recent sessions"
          action={<Link href="/history" className="text-sm text-indigo-400 hover:text-indigo-300">All history →</Link>}
          className="flex-[999_1_560px]"
        >
          {overview.recent.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">No sessions in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Date</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Workout</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold text-right">Sets</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold text-right">Volume</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold text-right">Duration</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent.slice(0, RECENT_SHOWN).map((s) => {
                    const vol = sessionVolume(s);
                    const status = s.skipped ? "Skipped" : s.completed ? "Completed" : "Partial";
                    return (
                      <tr key={s.id} className="border-t border-gray-800 whitespace-nowrap">
                        <td className="px-5 py-2.5">
                          <Link href={`/session/${s.id}`} className="text-indigo-400 hover:text-indigo-300">
                            {sessionDate(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">{s.programName} &middot; {s.dayOfWeek} &middot; W{s.week}</td>
                        <td className="px-3 py-2.5 text-right">{(s.sets ?? []).filter(isWorkingSet).length}</td>
                        <td className="px-3 py-2.5 text-right">{vol > 0 ? `${fmt(vol)} lb` : "—"}</td>
                        <td className="px-3 py-2.5 text-right">{s.skipped ? "—" : formatDuration(s.durationSeconds)}</td>
                        <td className="px-5 py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status === "Completed" ? "bg-green-500/15 text-green-400" : status === "Skipped" ? "bg-amber-500/15 text-amber-400" : "bg-gray-800 text-gray-300"}`}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Progression changes" className="flex-[1_1_340px]">
          {overview.changes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">No automatic weight changes in this range.</p>
          ) : (
            <ul>
              {overview.changes.slice(0, RECENT_SHOWN).map((c) => (
                <li key={`${c.sessionId}-${c.definitionId}`} className="flex justify-between gap-3 px-5 py-3 border-t border-gray-800 first:border-t-0">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{nameFor(c.definitionId)}</div>
                    <Link href={`/session/${c.sessionId}`} className="text-xs text-gray-400 hover:text-gray-300">
                      {c.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Link>
                  </div>
                  <span className={`whitespace-nowrap font-semibold tabular-nums ${c.after > c.before ? "text-green-400" : c.after < c.before ? "text-orange-400" : "text-gray-300"}`}>
                    {fmt(c.before, 2)} → {fmt(c.after, 2)} lb
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
