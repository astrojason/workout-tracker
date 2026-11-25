import type { BodyMeasurementDoc, CompletedSet, WorkoutSessionDoc } from "./types";
import { estimate1RM } from "./one-rep-max";

// Numbers for the desktop Overview: everything is computed from the logged sessions in a range of
// whole weeks ending today, compared with the equal period just before it.

const DAY_MS = 86_400_000;

export interface PeriodPair<T> {
  current: T;
  prior: T;
}

export interface LiftSummary {
  key: string;               // definitionId, or the name for sets logged before the exercise library
  name: string;
  definitionId: string | null;
  topWeights: number[];      // heaviest working set of each session, oldest first
  latestTop: { weight: number; reps: number };
  change: number;            // latest top set minus the first one in the range
  bestE1RM: number | null;
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
export function isWorkingSet(s: CompletedSet): boolean {
  return s.completed && !s.skipped && s.phase !== "warmup" && !s.isTimeBased && s.actualWeight > 0 && s.actualReps > 0;
}

export function sessionVolume(session: WorkoutSessionDoc): number {
  return (session.sets ?? []).filter(isWorkingSet).reduce((sum, s) => sum + s.actualWeight * s.actualReps, 0);
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

  const lifts = new Map<string, LiftSummary & { tops: { weight: number; reps: number }[] }>();
  for (const s of [...current].reverse()) {
    const top = new Map<string, CompletedSet>();
    for (const set of (s.sets ?? []).filter(isWorkingSet)) {
      const key = set.definitionId ?? set.exerciseName;
      const best = top.get(key);
      if (!best || set.actualWeight > best.actualWeight || (set.actualWeight === best.actualWeight && set.actualReps > best.actualReps)) {
        top.set(key, set);
      }
      const lift = lifts.get(key) ?? {
        key, name: set.exerciseName, definitionId: set.definitionId ?? null, topWeights: [], tops: [],
        latestTop: { weight: 0, reps: 0 }, change: 0, bestE1RM: null, sessions: 0,
      };
      const e = estimate1RM(set.actualWeight, set.actualReps);
      if (e !== null && (lift.bestE1RM === null || e > lift.bestE1RM)) lift.bestE1RM = e;
      lifts.set(key, lift);
    }
    for (const [key, set] of top) {
      const lift = lifts.get(key)!;
      lift.tops.push({ weight: set.actualWeight, reps: set.actualReps });
      lift.sessions += 1;
    }
  }
  const liftList: LiftSummary[] = [...lifts.values()].map(({ tops, ...lift }) => ({
    ...lift,
    topWeights: tops.map((t) => t.weight),
    latestTop: tops[tops.length - 1],
    change: tops[tops.length - 1].weight - tops[0].weight,
  })).sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));

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
