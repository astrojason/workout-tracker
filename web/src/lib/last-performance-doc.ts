import { exerciseKey } from "./custom-workout";
import type { CompletedSet, WorkoutSessionDoc } from "./types";

// A small per-user summary of each exercise's most recent completed sets, kept in
// users/{uid}/settings/lastPerformance. Starting a workout and suggesting a custom weight only
// need the last time each exercise was done, so they read this one document instead of loading
// the whole session history. It holds the sets themselves (not pre-computed weights), so the
// existing buildPreviousPerformanceMap / suggestCustomWeight logic runs on it unchanged.

export const LAST_PERFORMANCE_VERSION = 1;

export interface LastPerformanceEntry {
  sessionId: string;
  dateMs: number;
  sets: CompletedSet[]; // completed sets of that exercise from that session
}

export interface LastPerformanceDoc {
  version: number;
  entries: Record<string, LastPerformanceEntry>; // keyed by exerciseKey(exerciseName)
}

export function emptyLastPerformance(): LastPerformanceDoc {
  return { version: LAST_PERFORMANCE_VERSION, entries: {} };
}

function sessionMs(session: WorkoutSessionDoc): number {
  return session.date instanceof Date ? session.date.getTime() : session.date.toDate().getTime();
}

// Firestore rejects `undefined` field values; leave Dates and Timestamps untouched.
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)]),
    ) as T;
  }
  return value;
}

export function applySessionToLastPerformance(
  doc: LastPerformanceDoc,
  session: WorkoutSessionDoc,
): LastPerformanceDoc {
  const byName = new Map<string, CompletedSet[]>();
  for (const s of session.sets ?? []) {
    if (!s.completed) continue;
    const key = exerciseKey(s.exerciseName);
    byName.set(key, [...(byName.get(key) ?? []), s]);
  }
  const dateMs = sessionMs(session);
  const entries = { ...doc.entries };
  // A re-saved session (a checklist edited later in the day) replaces what it recorded before,
  // including exercises it no longer has completed.
  for (const [key, entry] of Object.entries(entries)) {
    if (entry.sessionId === session.id && !byName.has(key)) delete entries[key];
  }
  for (const [key, sets] of byName) {
    const existing = entries[key];
    if (existing && existing.dateMs > dateMs) continue;
    entries[key] = { sessionId: session.id, dateMs, sets: stripUndefined(sets) };
  }
  return { version: LAST_PERFORMANCE_VERSION, entries };
}

export function buildLastPerformance(sessions: WorkoutSessionDoc[]): LastPerformanceDoc {
  return sessions.reduce(applySessionToLastPerformance, emptyLastPerformance());
}

// One stand-in session per exercise, shaped so the history-based helpers can read it.
export function lastPerformanceSessions(doc: LastPerformanceDoc): WorkoutSessionDoc[] {
  return Object.entries(doc.entries).map(([key, entry]) => ({
    id: `${entry.sessionId}:${key}`,
    programId: "",
    programName: "",
    week: 0,
    dayOfWeek: "",
    date: new Date(entry.dateMs),
    completed: true,
    durationSeconds: 0,
    sets: entry.sets,
  }) as WorkoutSessionDoc);
}
