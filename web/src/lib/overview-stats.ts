import type { BodyMeasurementDoc, CompletedSet, EquipmentType, WorkoutSessionDoc } from "./types";
import { cleanWeight, formatTimeValue } from "./types";
import { estimate1RM } from "./one-rep-max";

// Numbers for the desktop Overview: everything is computed from the logged sessions in a range of
// whole weeks ending today, compared with the equal period just before it.

const DAY_MS = 86_400_000;

export interface PeriodPair<T> {
  current: T;
  prior: T;
}

// What a lift's progress is measured in. Weighted lifts in pounds; assisted pull-ups in assistance
// bands (actualWeight holds the band count, and fewer is progress); timed exercises by the longest
// hold (actualReps holds seconds); unweighted exercises by reps.
export type LiftMeasure = "weight" | "bands" | "time" | "reps";

export interface LiftSummary {
  key: string;               // definitionId, or the name for sets logged before the exercise library
  name: string;
  definitionId: string | null;
  measure: LiftMeasure;
  values: number[];          // each session's best in `measure`, oldest first
  latest: { value: number; reps: number }; // the latest session's best set
  change: number;            // latest best minus the first one in the range, in `measure`
  progress: number;          // that change as a fraction of the first, positive = better (fewer bands)
  bestE1RM: number | null;   // weighted lifts only
  sessions: number;
}

export interface OverviewChange {
  sessionId: string;
  date: Date;
  definitionId: string;
  before: number;
  after: number;
}

export interface Overview {
  sessions: PeriodPair<number>;
  volume: PeriodPair<number>;
  workingSets: PeriodPair<number>;
  avgDurationSeconds: PeriodPair<number | null>;
  weeklyVolume: { weekStart: Date; volume: number }[];
  lifts: LiftSummary[];
  recent: WorkoutSessionDoc[];
  changes: OverviewChange[];
}

export type DayStatus = "completed" | "partial" | "skipped" | "rest" | "upcoming";

export function sessionDate(value: WorkoutSessionDoc["date"] | BodyMeasurementDoc["date"]): Date {
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate: () => Date }).toDate();
  return new Date(value as unknown as string);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, day.getDay() === 0 ? -6 : 1 - day.getDay());
}

// First day of a range of `weeks` whole weeks ending with the current week.
export function rangeStart(weeks: number, now: Date): Date {
  return addDays(startOfWeek(now), -7 * (weeks - 1));
}

// A set that counts toward volume and lift trends: lifted (not failed or skipped), a working set
// (not a warm-up), loaded, and counted in reps rather than seconds.
// Assisted pull-ups store a band count in actualWeight, so they never count as pounds lifted.
export function isWorkingSet(s: CompletedSet): boolean {
  return isLoggedWorkSet(s) && !s.isTimeBased && s.equipmentType !== "assisted_pullup" && s.actualWeight > 0;
}

export function isLoggedWorkSet(s: CompletedSet): boolean {
  return s.completed && !s.skipped && s.phase !== "warmup" && s.actualReps > 0;
}

export function measureFor(s: Pick<CompletedSet, "isTimeBased" | "actualWeight"> & { equipmentType?: EquipmentType }): LiftMeasure {
  if (s.isTimeBased) return "time";
  if (s.equipmentType === "assisted_pullup") return "bands";
  return s.actualWeight > 0 ? "weight" : "reps";
}

// The number a set contributes to its lift's trend, and whether `a` is a better set than `b`.
function measureValue(measure: LiftMeasure, s: CompletedSet): number {
  return measure === "weight" || measure === "bands" ? s.actualWeight : s.actualReps;
}
function isBetter(measure: LiftMeasure, a: CompletedSet, b: CompletedSet): boolean {
  const va = measureValue(measure, a), vb = measureValue(measure, b);
  if (va !== vb) return measure === "bands" ? va < vb : va > vb;
  return a.actualReps > b.actualReps;
}

const plural = (n: number, one: string, many: string) => `${cleanWeight(n)} ${n === 1 ? one : many}`;

// A lift's value in its own unit: "225 lb × 6", "2 bands × 6", "No assist × 8", "1:30", "12 reps".
export function formatMeasure(measure: LiftMeasure, value: number, reps?: number): string {
  const times = reps === undefined ? "" : ` × ${reps}`;
  switch (measure) {
    case "weight": return `${cleanWeight(value)} lb${times}`;
    case "bands": return `${value === 0 ? "No assist" : plural(value, "band", "bands")}${times}`;
    case "time": return formatTimeValue(value);
    case "reps": return plural(value, "rep", "reps");
  }
}

// A change in a lift's own unit, signed: "+10 lb", "−1 band", "+30s", "+2 reps", "No change".
export function formatChange(measure: LiftMeasure, change: number): string {
  if (change === 0) return "No change";
  const sign = change > 0 ? "+" : "−";
  const n = Math.abs(change);
  switch (measure) {
    case "weight": return `${sign}${cleanWeight(n)} lb`;
    case "bands": return `${sign}${plural(n, "band", "bands")}`;
    case "time": return `${sign}${formatTimeValue(n)}`;
    case "reps": return `${sign}${plural(n, "rep", "reps")}`;
  }
}

// A set that counts toward a session's volume: any loaded set lifted, warm-ups included. Volume is a
// guide to recovery, and a warm-up moves real weight; PRs and lift trends still use work sets only.
export function isVolumeSet(s: CompletedSet): boolean {
  return s.completed && !s.skipped && s.actualReps > 0 && !s.isTimeBased && s.equipmentType !== "assisted_pullup" && s.actualWeight > 0;
}

export function setsVolume(sets: CompletedSet[]): number {
  return sets.filter(isVolumeSet).reduce((sum, s) => sum + s.actualWeight * s.actualReps, 0);
}

export function sessionVolume(session: WorkoutSessionDoc): number {
  return setsVolume(session.sets ?? []);
}

function isFinished(session: WorkoutSessionDoc): boolean {
  return session.completed && !session.skipped;
}

function periodTotals(sessions: WorkoutSessionDoc[]) {
  const finished = sessions.filter(isFinished);
  const working = sessions.flatMap((s) => (s.sets ?? []).filter(isWorkingSet));
  return {
    sessions: finished.length,
    volume: sessions.reduce((sum, s) => sum + sessionVolume(s), 0),
    workingSets: working.length,
    avgDurationSeconds: finished.length === 0 ? null : finished.reduce((sum, s) => sum + s.durationSeconds, 0) / finished.length,
  };
}

export function buildOverview(
  all: WorkoutSessionDoc[],
  { weeks, now, programId }: { weeks: number; now: Date; programId?: string | null },
): Overview {
  const start = rangeStart(weeks, now);
  const priorStart = addDays(start, -7 * weeks);
  const scoped = programId ? all.filter((s) => s.programId === programId) : all;
  const byDate = [...scoped].sort((a, b) => sessionDate(b.date).getTime() - sessionDate(a.date).getTime());
  const current = byDate.filter((s) => sessionDate(s.date) >= start);
  const prior = byDate.filter((s) => sessionDate(s.date) >= priorStart && sessionDate(s.date) < start);
  const c = periodTotals(current);
  const p = periodTotals(prior);

  const weeklyVolume = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(start, 7 * i), volume: 0 }));
  for (const s of current) {
    const index = Math.floor((startOfWeek(sessionDate(s.date)).getTime() - start.getTime()) / (7 * DAY_MS) + 0.5);
    if (weeklyVolume[index]) weeklyVolume[index].volume += sessionVolume(s);
  }

  const lifts = new Map<string, { key: string; name: string; definitionId: string | null; measure: LiftMeasure; bestE1RM: number | null; tops: CompletedSet[] }>();
  for (const s of [...current].reverse()) {
    const top = new Map<string, CompletedSet>();
    for (const set of (s.sets ?? []).filter(isLoggedWorkSet)) {
      const key = set.definitionId ?? set.exerciseName;
      // A lift keeps the measure of its first set in the range, so a series never mixes units.
      const lift = lifts.get(key) ?? {
        key, name: set.exerciseName, definitionId: set.definitionId ?? null, measure: measureFor(set), bestE1RM: null, tops: [],
      };
      lifts.set(key, lift);
      if (measureFor(set) !== lift.measure && !(lift.measure === "bands" && set.equipmentType === "assisted_pullup")) continue;
      const best = top.get(key);
      if (!best || isBetter(lift.measure, set, best)) top.set(key, set);
      const e = lift.measure === "weight" ? estimate1RM(set.actualWeight, set.actualReps) : null;
      if (e !== null && (lift.bestE1RM === null || e > lift.bestE1RM)) lift.bestE1RM = e;
    }
    for (const [key, set] of top) lifts.get(key)!.tops.push(set);
  }
  const liftList: LiftSummary[] = [...lifts.values()].filter((l) => l.tops.length > 0).map(({ tops, ...lift }) => {
    const values = tops.map((t) => measureValue(lift.measure, t));
    const first = values[0], last = values[values.length - 1];
    const change = last - first;
    const better = lift.measure === "bands" ? -change : change;
    const progress = first === 0 ? (better > 0 ? 1 : 0) : better / first;
    return { ...lift, values, latest: { value: last, reps: tops[tops.length - 1].actualReps }, change, progress, sessions: tops.length };
  }).sort((a, b) => b.progress - a.progress || b.sessions - a.sessions || a.name.localeCompare(b.name));

  const changes: OverviewChange[] = current.flatMap((s) => (s.progressionChanges ?? []).map((ch) => ({
    sessionId: s.id,
    date: sessionDate(s.date),
    definitionId: ch.definitionId,
    before: ch.before.currentWeight,
    after: ch.after.currentWeight,
  })));

  return {
    sessions: { current: c.sessions, prior: p.sessions },
    volume: { current: c.volume, prior: p.volume },
    workingSets: { current: c.workingSets, prior: p.workingSets },
    avgDurationSeconds: { current: c.avgDurationSeconds, prior: p.avgDurationSeconds },
    weeklyVolume,
    lifts: liftList,
    recent: current,
    changes,
  };
}

// One entry per day for the last `weeks` whole weeks (Monday first), oldest first.
export function dailyStatus(sessions: WorkoutSessionDoc[], weeks: number, now: Date): { date: Date; status: DayStatus }[] {
  const rank: Record<DayStatus, number> = { completed: 3, partial: 2, skipped: 1, rest: 0, upcoming: 0 };
  const byDay = new Map<number, DayStatus>();
  for (const s of sessions) {
    const status: DayStatus = s.skipped ? "skipped" : s.completed ? "completed" : "partial";
    const key = startOfDay(sessionDate(s.date)).getTime();
    const existing = byDay.get(key);
    if (!existing || rank[status] > rank[existing]) byDay.set(key, status);
  }
  const start = rangeStart(weeks, now);
  const today = startOfDay(now).getTime();
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(start, i);
    const status = byDay.get(date.getTime()) ?? (date.getTime() > today ? "upcoming" : "rest");
    return { date, status };
  });
}

// Latest bodyweight and its change since the first weigh-in on or after `since`.
export function bodyweightTrend(entries: BodyMeasurementDoc[], since: Date): { latest: number; change: number; points: number[] } | null {
  const weighed = entries
    .filter((e) => typeof e.weight === "number")
    .sort((a, b) => sessionDate(a.date).getTime() - sessionDate(b.date).getTime());
  if (weighed.length === 0) return null;
  const inRange = weighed.filter((e) => sessionDate(e.date) >= since);
  const points = (inRange.length > 0 ? inRange : weighed.slice(-1)).map((e) => e.weight as number);
  const latest = weighed[weighed.length - 1].weight as number;
  return { latest, change: Math.round((latest - points[0]) * 10) / 10, points };
}
