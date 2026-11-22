import { describe, it, expect, vi, beforeEach } from "vitest";

// A tiny in-memory Firestore: documents by path, plus a configurable list of sessions for queries.
const { store, sessionDocs, calls } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  sessionDocs: { current: [] as Array<{ id: string; data: unknown }> },
  calls: { sessionQueries: 0, nextId: 0 },
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => {
  const ref = (path: string) => ({ __path: path, id: path.split("/").pop() });
  const snap = (path: string) => ({ exists: () => store.has(path), data: () => store.get(path) });
  return {
    collection: (_db: unknown, ...segs: string[]) => ({ __col: segs.join("/") }),
    doc: (a: { __col?: string }, ...rest: string[]) =>
      a.__col ? ref(`${a.__col}/${rest[0] ?? `auto${calls.nextId++}`}`) : ref(rest.join("/")),
    query: (col: unknown) => col,
    where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
    getDoc: async (r: { __path: string }) => snap(r.__path),
    setDoc: async (r: { __path: string }, data: unknown) => { store.set(r.__path, data); },
    deleteDoc: async (r: { __path: string }) => { store.delete(r.__path); },
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    getDocs: async () => {
      const docs = sessionDocs.current;
      calls.sessionQueries++;
      return { empty: docs.length === 0, docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
    },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<void>) => {
      const writes: Array<[string, unknown]> = [];
      await fn({
        get: async (r: { __path: string }) => snap(r.__path),
        set: (r: { __path: string }, data: unknown) => { writes.push([r.__path, data]); },
      });
      for (const [path, data] of writes) store.set(path, data);
    },
    writeBatch: vi.fn(), onSnapshot: vi.fn(),
    Timestamp: { now: () => ({ toDate: () => new Date(2026, 10, 22), seconds: 0, nanoseconds: 0 }), fromDate: (d: Date) => d },
  };
});

import { deleteSession, ensureLastPerformance, getLastPerformance, rebuildLastPerformance, saveSession } from "../firestore";
import type { CompletedSet, WorkoutSessionDoc } from "../types";

const SUMMARY = "users/u1/settings/lastPerformance";
const day = (n: number) => new Date(2026, 10, n);
const set = (name: string, weight: number): CompletedSet => ({
  id: name, exerciseName: name, exerciseOrder: 1, setNumber: 1, targetWeight: weight, actualWeight: weight,
  targetReps: 5, actualReps: 5, completed: true, timestamp: new Date(0), notes: null,
});
const sessionData = (date: Date, sets: CompletedSet[]) =>
  ({ programId: "p", programName: "P", week: 1, dayOfWeek: "Monday", date, completed: true, durationSeconds: 1, sets });

beforeEach(() => {
  store.clear();
  calls.sessionQueries = 0;
  calls.nextId = 0;
  sessionDocs.current = [
    { id: "s2", data: sessionData(day(20), [set("Squat", 225)]) },
    { id: "s1", data: sessionData(day(13), [set("Bench", 185)]) },
  ];
});

describe("rebuildLastPerformance", () => {
  it("builds the summary from the whole session history and stores it", async () => {
    const built = await rebuildLastPerformance("u1");
    expect(Object.keys(built.entries).sort()).toEqual(["bench", "squat"]);
    expect(store.has(SUMMARY)).toBe(true);
  });
});

// TEMPORARY backfill: the app builds the summary the first time any user needs it. These tests
// go away with ensureLastPerformance once every active user has one.
describe("first-use backfill", () => {
  it("getLastPerformance builds and stores the summary when it doesn't exist yet", async () => {
    const result = await getLastPerformance("u1");
    expect(result.map((s) => s.sets[0].exerciseName).sort()).toEqual(["Bench", "Squat"]);
    expect(store.has(SUMMARY)).toBe(true);
  });

  it("reads the stored summary without querying sessions afterwards", async () => {
    await getLastPerformance("u1");
    calls.sessionQueries = 0;
    await getLastPerformance("u1");
    expect(calls.sessionQueries).toBe(0);
  });

  it("rebuilds a summary written by a different version", async () => {
    store.set(SUMMARY, { version: 0, entries: {} });
    const result = await getLastPerformance("u1");
    expect(result).toHaveLength(2);
    expect((store.get(SUMMARY) as { version: number }).version).toBe(1);
  });

  it("gives a brand-new user with no sessions an empty summary", async () => {
    sessionDocs.current = [];
    await expect(getLastPerformance("u1")).resolves.toEqual([]);
    expect(store.has(SUMMARY)).toBe(true);
  });

  it("builds only once when several callers ask at the same time", async () => {
    await Promise.all([ensureLastPerformance("u1"), ensureLastPerformance("u1"), getLastPerformance("u1")]);
    expect(calls.sessionQueries).toBe(1);
  });

  it("surfaces a failed build instead of returning partial data, and allows a retry", async () => {
    sessionDocs.current = null as never; // makes the history read throw
    await expect(getLastPerformance("u1")).rejects.toThrow();
    sessionDocs.current = [];
    await expect(getLastPerformance("u1")).resolves.toEqual([]);
  });
});

describe("saveSession", () => {
  it("saves the session and updates the summary together", async () => {
    await rebuildLastPerformance("u1");
    const id = await saveSession("u1", sessionData(day(21), [set("Bench", 190)]) as Omit<WorkoutSessionDoc, "id">);
    expect(store.has(`users/u1/sessions/${id}`)).toBe(true);
    const summary = store.get(SUMMARY) as { entries: Record<string, { sessionId: string }> };
    expect(summary.entries.bench.sessionId).toBe(id);
    expect(summary.entries.squat.sessionId).toBe("s2"); // untouched
  });

  it("builds the summary from history first when the user doesn't have one yet", async () => {
    const id = await saveSession("u1", sessionData(day(21), [set("Bench", 190)]) as Omit<WorkoutSessionDoc, "id">);
    const summary = store.get(SUMMARY) as { entries: Record<string, { sessionId: string }> };
    expect(summary.entries.bench.sessionId).toBe(id);
    expect(summary.entries.squat.sessionId).toBe("s2"); // came from the backfill
  });

  it("writes nothing when the backfill fails", async () => {
    sessionDocs.current = null as never;
    await expect(saveSession("u1", sessionData(day(21), [set("Bench", 190)]) as Omit<WorkoutSessionDoc, "id">)).rejects.toThrow();
    expect([...store.keys()].some((k) => k.includes("/sessions/"))).toBe(false);
  });
});

describe("deleteSession", () => {
  it("rebuilds the summary without the deleted session when it was the last one for an exercise", async () => {
    await rebuildLastPerformance("u1");
    store.set("users/u1/sessions/s2", sessionDocs.current[0].data);
    sessionDocs.current = [sessionDocs.current[1]]; // what history looks like after deleting s2
    await deleteSession("u1", "s2");
    const summary = store.get(SUMMARY) as { entries: Record<string, unknown> };
    expect(Object.keys(summary.entries)).toEqual(["bench"]);
    expect(store.has("users/u1/sessions/s2")).toBe(false);
  });

  it("leaves the summary alone when the deleted session is not referenced by it", async () => {
    await rebuildLastPerformance("u1");
    const before = JSON.stringify(store.get(SUMMARY));
    calls.sessionQueries = 0;
    store.set("users/u1/sessions/other", sessionData(day(1), []));
    await deleteSession("u1", "other");
    expect(JSON.stringify(store.get(SUMMARY))).toBe(before);
    expect(calls.sessionQueries).toBe(0);
  });
});
