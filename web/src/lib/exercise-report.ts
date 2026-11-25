import type { CompletedSet, WorkoutSessionDoc } from "./types";
import { estimate1RM } from "./one-rep-max";
import { isLoggedWorkSet, measureFor, rangeStart, sessionDate } from "./overview-stats";
import type { LiftMeasure } from "./overview-stats";

// Numbers for the desktop exercise page: one exercise's sessions in a range of whole weeks.

export interface ExercisePoint {
  sessionId: string;
  date: Date;
  best: number;            // the session's best set in the report's measure
  reps: number;            // reps of that best set (seconds for a timed exercise)
  e1rm: number | null;     // best estimated 1RM that session (weighted only)
  volume: number;          // weight × reps over the session's working sets (weighted only)
  isPR: boolean;           // beat every earlier session in the range
}

export type SetStatus = "done" | "warmup" | "failed" | "skipped";

export interface ExerciseLogRow {
  sessionId: string;
  date: Date;
  programName: string;
  dayOfWeek: string;
  week: number;
  setNumber: number;
  phase: string;
  status: SetStatus;
  targetWeight: number;
  targetReps: number;
  weight: number;
  reps: number;
  e1rm: number | null;
  rating: CompletedSet["rating"] | null;
  notes: string | null;
}

export interface ExerciseReportData {
  measure: LiftMeasure;
  points: ExercisePoint[];
  stats: {
    heaviest: { value: number; reps: number; date: Date } | null; // best single set in the measure
    bestE1RM: { value: number; date: Date } | null;
    volume: number;
    workingSets: number;
    sessions: number;
    change: number; // latest session's best minus the first one's
  };
  repRecords: { reps: number; weight: number; e1rm: number | null; date: Date; sessionId: string }[];
  ratings: { easy: number; normal: number; hard: number; unrated: number };
  log: ExerciseLogRow[]; // newest first
}

function matches(set: CompletedSet, definitionId: string | null, name: string): boolean {
  if (definitionId && set.definitionId) return set.definitionId === definitionId;
  return set.exerciseName === name;
}

function measureValue(measure: LiftMeasure, s: CompletedSet): number {
  return measure === "weight" || measure === "bands" ? s.actualWeight : s.actualReps;
}

// Is `a` better than `b` in this measure? Fewer bands is better; ties go to more reps.
function better(measure: LiftMeasure, a: number, b: number): boolean {
  return measure === "bands" ? a < b : a > b;
}

function isBetterSet(measure: LiftMeasure, a: CompletedSet, b: CompletedSet): boolean {
  const va = measureValue(measure, a), vb = measureValue(measure, b);
  return va !== vb ? better(measure, va, vb) : a.actualReps > b.actualReps;
}

function setStatus(s: CompletedSet): SetStatus {
  if (s.skipped) return "skipped";
  if (!s.completed) return "failed";
  return s.phase === "warmup" ? "warmup" : "done";
}

export function buildExerciseReport(
  all: WorkoutSessionDoc[],
  { definitionId, name, weeks, now, programId }: { definitionId: string | null; name: string; weeks: number; now: Date; programId?: string | null },
): ExerciseReportData {
  const start = rangeStart(weeks, now);
  const sessions = all
    .filter((s) => (!programId || s.programId === programId) && sessionDate(s.date) >= start)
    .map((s) => ({ session: s, sets: (s.sets ?? []).filter((set) => matches(set, definitionId, name)) }))
    .filter((x) => x.sets.length > 0)
    .sort((a, b) => sessionDate(a.session.date).getTime() - sessionDate(b.session.date).getTime());

  const working = sessions.flatMap((x) => x.sets.filter(isLoggedWorkSet));
  const measure: LiftMeasure = working.length > 0 ? measureFor(working[0]) : "weight";
  const loaded = measure === "weight";

  const points: ExercisePoint[] = [];
  let heaviest: ExerciseReportData["stats"]["heaviest"] = null;
  let heaviestSet: CompletedSet | null = null;
  let bestE1RM: ExerciseReportData["stats"]["bestE1RM"] = null;
  let volume = 0;
  const records = new Map<number, ExerciseReportData["repRecords"][number]>();
  const ratings = { easy: 0, normal: 0, hard: 0, unrated: 0 };

  for (const { session, sets } of sessions) {
    const date = sessionDate(session.date);
    const work = sets.filter((s) => isLoggedWorkSet(s) && measureFor(s) === measure);
    if (work.length === 0) continue;
    const top = work.reduce((b, s) => (isBetterSet(measure, s, b) ? s : b), work[0]);
    let e1rm: number | null = null;
    let sessionVolume = 0;
    for (const s of work) {
      if (!loaded) continue;
      sessionVolume += s.actualWeight * s.actualReps;
      const e = estimate1RM(s.actualWeight, s.actualReps);
      if (e !== null && (e1rm === null || e > e1rm)) e1rm = e;
      const rec = records.get(s.actualReps);
      if (!rec || s.actualWeight > rec.weight) {
        records.set(s.actualReps, { reps: s.actualReps, weight: s.actualWeight, e1rm: e, date, sessionId: session.id });
      }
    }
    volume += sessionVolume;
    const best = measureValue(measure, top);
    // A PR is judged on the estimated 1RM for weighted lifts (heavier-for-fewer-reps and
    // lighter-for-more both count), and on the plain best value otherwise.
    const score = loaded && e1rm !== null ? e1rm : best;
    const isPR = points.length > 0 && points.every((p) => better(measure, score, loaded && p.e1rm !== null ? p.e1rm : p.best));
    points.push({ sessionId: session.id, date, best, reps: top.actualReps, e1rm, volume: sessionVolume, isPR });

    if (!heaviestSet || isBetterSet(measure, top, heaviestSet)) {
      heaviestSet = top;
      heaviest = { value: best, reps: top.actualReps, date };
    }
    if (e1rm !== null && (!bestE1RM || e1rm > bestE1RM.value)) bestE1RM = { value: e1rm, date };

    const final = sets.filter((s) => s.phase !== "warmup").sort((a, b) => b.setNumber - a.setNumber)[0];
    if (final?.rating) ratings[final.rating] += 1;
    else ratings.unrated += 1;
  }

  const log: ExerciseLogRow[] = [...sessions].reverse().flatMap(({ session, sets }) =>
    [...sets].sort((a, b) => a.setNumber - b.setNumber).map((s) => ({
      sessionId: session.id,
      date: sessionDate(session.date),
      programName: session.programName,
      dayOfWeek: session.dayOfWeek,
      week: session.week,
      setNumber: s.setNumber,
      phase: s.phase ?? "main",
      status: setStatus(s),
      targetWeight: s.targetWeight,
      targetReps: s.targetReps,
      weight: s.actualWeight,
      reps: s.actualReps,
      e1rm: loaded && setStatus(s) === "done" ? estimate1RM(s.actualWeight, s.actualReps) : null,
      rating: s.rating ?? null,
      notes: s.notes,
    })),
  );

  return {
    measure,
    points,
    stats: {
      heaviest,
      bestE1RM,
      volume,
      workingSets: sessions.reduce((n, x) => n + x.sets.filter((s) => isLoggedWorkSet(s) && measureFor(s) === measure).length, 0),
      sessions: points.length,
      change: points.length > 0 ? points[points.length - 1].best - points[0].best : 0,
    },
    repRecords: [...records.values()].sort((a, b) => a.reps - b.reps),
    ratings,
    log,
  };
}

function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function exerciseLogCsv(rows: ExerciseLogRow[]): string {
  const header = ["Date", "Program", "Day", "Week", "Set", "Phase", "Status", "Target weight", "Target reps", "Weight", "Reps", "Rating", "Notes"];
  const lines = rows.map((r) => [
    isoDate(r.date), r.programName, r.dayOfWeek, r.week, r.setNumber, r.phase, r.status,
    r.targetWeight, r.targetReps, r.weight, r.reps, r.rating, r.notes,
  ].map(csvField).join(","));
  return [header.join(","), ...lines].join("\n") + "\n";
}
