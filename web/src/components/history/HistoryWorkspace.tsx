"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CompletedSet, ExerciseDefinition, PRResult, WorkoutSessionDoc } from "@/lib/types";
import { formatDuration } from "@/lib/types";
import { useError } from "@/components/providers/ErrorProvider";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { CopySessionButton } from "@/components/history/CopySessionButton";
import { AddExerciseForm } from "@/components/history/AddExerciseForm";
import { groupSetsByOccurrence } from "@/lib/set-groups";
import { formatMeasure, isWorkingSet, sessionDate, sessionVolume } from "@/lib/overview-stats";
import { applyDrafts, countChanges, draftError, isDraftChanged, toDraft } from "@/lib/session-edit";
import type { SetDraft } from "@/lib/session-edit";

type SessionUpdate = { sets: CompletedSet[]; durationSeconds: number };
type StatusFilter = "all" | "completed" | "partial" | "skipped";

export interface HistoryWorkspaceProps {
  sessions: WorkoutSessionDoc[]; // newest first
  definitions: Record<string, ExerciseDefinition>;
  onSave: (sessionId: string, update: SessionUpdate) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
  onAddExercise: (sessionId: string, sets: CompletedSet[]) => Promise<PRResult[]>; // a forgotten exercise, after the fact
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const statusOf = (s: WorkoutSessionDoc): Exclude<StatusFilter, "all"> => (s.skipped ? "skipped" : s.completed ? "completed" : "partial");
const STATUS_LABEL = { completed: "Completed", partial: "Partial", skipped: "Skipped" } as const;
const STATUS_STYLE = { completed: "text-green-400", partial: "text-gray-300", skipped: "text-amber-400" } as const;

// Desktop History: the session list on the left (search + status filter), the selected session on
// the right with its logged sets editable in place.
export function HistoryWorkspace({ sessions, definitions, onSave, onDelete, onAddExercise }: HistoryWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // a session to switch to once edits are discarded

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => (filter === "all" || statusOf(s) === filter) && (!q
      || `${s.programName} ${s.dayOfWeek} week ${s.week}`.toLowerCase().includes(q)
      || (s.sets ?? []).some((set) => set.exerciseName.toLowerCase().includes(q))));
  }, [sessions, query, filter]);

  // The selected session can disappear (deleted, or filtered out); fall back to the first shown.
  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected && shown.length > 0) setSelectedId(shown[0].id);
  }, [selected, shown]);

  function select(id: string) {
    if (id === selectedId) return;
    if (dirty) setPending(id);
    else setSelectedId(id);
  }

  return (
    <div className="flex flex-wrap gap-5 items-start">
      <aside aria-labelledby="history-sessions-heading" className="flex-[1_1_300px] max-w-[360px] bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="history-sessions-heading" className="font-semibold">Sessions</h2>
            <span className="text-sm text-gray-400">{shown.length === sessions.length ? sessions.length : `${shown.length} of ${sessions.length}`}</span>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-3 h-9 focus-within:border-indigo-500">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" strokeWidth={2} /><path strokeWidth={2} strokeLinecap="round" d="M20 20l-3.5-3.5" /></svg>
            <span className="sr-only">Filter sessions</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Exercise, day or program" className="flex-1 bg-transparent text-sm outline-none" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "completed", "partial", "skipped"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`h-7 px-3 rounded-full text-xs font-semibold transition ${filter === f ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
              >
                {f === "all" ? "All" : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No sessions match.</p>
        ) : (
          <nav aria-label="Sessions" className="max-h-[calc(100vh-280px)] overflow-y-auto">
            <ul>
              {shown.map((s) => {
                const status = statusOf(s);
                const vol = sessionVolume(s);
                const current = s.id === selected?.id;
                return (
                  <li key={s.id} className="border-t border-gray-800 first:border-t-0">
                    <button
                      type="button"
                      aria-current={current || undefined}
                      onClick={() => select(s.id)}
                      className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-2.5 transition ${current ? "bg-indigo-950/70" : "hover:bg-gray-800/60"}`}
                    >
                      <span className="font-semibold truncate">{s.programName} · {s.dayOfWeek}</span>
                      <span className="text-sm text-right tabular-nums">{vol > 0 ? `${fmt(vol)} lb` : "—"}</span>
                      <span className="text-xs text-gray-400">
                        {sessionDate(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · W{s.week}
                      </span>
                      <span className={`text-xs text-right ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </aside>

      <section aria-label="Selected session" className="flex-[999_1_640px] min-w-0">
        {selected ? (
          <SessionEditor
            key={selected.id}
            session={selected}
            definitions={definitions}
            onDirtyChange={setDirty}
            onSave={(update) => onSave(selected.id, update)}
            onDelete={() => onDelete(selected.id)}
            onAddExercise={(sets) => onAddExercise(selected.id, sets)}
          />
        ) : (
          <p className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-10 text-center text-gray-400">No workouts yet. Complete a workout to see it here.</p>
        )}
      </section>

      {pending && (
        <ConfirmDeleteModal
          title="Discard changes"
          message="This session has unsaved edits. Open the other session and lose them?"
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setPending(null)}
          onConfirm={() => { setDirty(false); setSelectedId(pending); setPending(null); }}
        />
      )}
    </div>
  );
}

type Confirm = { kind: "discard" } | { kind: "remove"; set: CompletedSet } | { kind: "delete" };

function SessionEditor({ session, definitions, onDirtyChange, onSave, onDelete, onAddExercise }: {
  session: WorkoutSessionDoc;
  definitions: Record<string, ExerciseDefinition>;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (update: SessionUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddExercise: (sets: CompletedSet[]) => Promise<PRResult[]>;
}) {
  const { showError } = useError();
  const sets = useMemo(() => session.sets ?? [], [session.sets]);
  const originalMinutes = Math.round(session.durationSeconds / 60);
  const [drafts, setDrafts] = useState<SetDraft[]>(() => sets.map(toDraft));
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [minutes, setMinutes] = useState(String(originalMinutes));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [deleting, setDeleting] = useState(false);

  const minutesValid = /^\d+$/.test(minutes.trim());
  const changes = countChanges(sets, drafts, removed, originalMinutes, minutesValid ? Number(minutes.trim()) : NaN);
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const errors = drafts.filter((d) => !removed.has(d.id) && draftError(d) !== null).length + (minutesValid ? 0 : 1);
  useEffect(() => onDirtyChange(changes > 0), [changes, onDirtyChange]);
  // Leaving (another session opened, or this one deleted) takes its edits with it.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  function edit(id: string, patch: Partial<SetDraft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setSaveState("idle");
  }

  async function save() {
    setSaveState("saving");
    try {
      await onSave({ sets: applyDrafts(sets, drafts, removed), durationSeconds: Number(minutes.trim()) * 60 });
      setRemoved(new Set());
      setSaveState("saved");
    } catch (err) {
      setSaveState("idle");
      showError(err);
    }
  }

  function discard() {
    setDrafts(sets.map(toDraft));
    setRemoved(new Set());
    setMinutes(String(originalMinutes));
    setSaveState("idle");
    setConfirm(null);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setDeleting(false);
      setConfirm(null);
      showError(err);
    }
  }

  // After a save the session prop carries the new sets; re-seed the drafts from it. Otherwise
  // (an exercise added) keep each set's draft and give the new sets their own.
  useEffect(() => {
    setDrafts((ds) => {
      const prev = new Map(ds.map((d) => [d.id, d]));
      return sets.map((s) => (saveState === "saved" ? toDraft(s) : prev.get(s.id) ?? toDraft(s)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets]);

  const visible = sets.filter((s) => !removed.has(s.id));
  const groups = groupSetsByOccurrence(visible);
  const status = statusOf(session);
  const date = sessionDate(session.date);
  const working = visible.filter(isWorkingSet);
  const volume = working.reduce((n, s) => n + s.actualWeight * s.actualReps, 0);
  const busy = saveState === "saving" || deleting;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-gray-400">{session.programName}</p>
          <h2 className="text-2xl font-bold">{session.dayOfWeek} · Week {session.week}</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <span>{date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
            {!session.skipped && (
              <label className="flex items-center gap-1.5">
                Duration
                <input
                  value={minutes}
                  onChange={(e) => { setMinutes(e.target.value); setSaveState("idle"); }}
                  disabled={busy}
                  inputMode="numeric"
                  aria-invalid={!minutesValid}
                  className={`w-14 h-8 rounded-lg border bg-gray-800 px-2 text-right text-white tabular-nums outline-none focus:border-indigo-500 ${minutesValid ? "border-gray-700" : "border-red-500"}`}
                />
                min
              </label>
            )}
            {!minutesValid && <span className="text-red-400">Duration must be whole minutes</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-9 flex items-center rounded-xl bg-gray-800 hover:bg-gray-700"><CopySessionButton session={session} /></div>
          <Link href={`/session/${session.id}`} className="h-9 px-3 flex items-center rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold">Session page &amp; coach</Link>
          <button type="button" disabled={busy} onClick={() => setConfirm({ kind: "delete" })} className="h-9 px-3 rounded-xl border border-red-900 text-red-400 hover:bg-red-950/50 text-sm font-semibold disabled:opacity-50">
            Delete session…
          </button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {[
          ["Volume", volume > 0 ? `${fmt(volume)} lb` : "—"],
          ["Working sets", String(working.length)],
          ["Duration", session.skipped ? "—" : formatDuration(session.durationSeconds)],
          ["Status", STATUS_LABEL[status]],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</div>
            <div className={`text-xl font-bold tabular-nums ${label === "Status" ? STATUS_STYLE[status] : ""}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {groups.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-500">{session.skipped ? "Marked as skipped — no sets recorded." : "No sets recorded."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Exercise</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold text-right">Set</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold text-right">Target</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold text-right">Load</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold text-right">Reps / time</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold">Rating</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold">Notes</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap((g) => g.sets.map((s, i) => {
                  const d = byId.get(s.id) ?? toDraft(s); // a just-added set gets its draft on the next effect
                  const error = draftError(d);
                  const changed = isDraftChanged(s, d);
                  const timed = s.isTimeBased === true;
                  const bands = s.equipmentType === "assisted_pullup";
                  const label = `${s.exerciseName} set ${s.setNumber}`;
                  const cell = "h-8 rounded-lg border bg-gray-800 px-2 outline-none focus:border-indigo-500 disabled:opacity-60";
                  return [
                    <tr key={s.id} className={`whitespace-nowrap border-t ${i === 0 ? "border-gray-800" : "border-gray-800/40"} ${changed ? "bg-amber-500/5" : ""}`}>
                      <td className="px-4 py-1.5">
                        {i === 0 && (
                          <Link href={`/exercise/${encodeURIComponent(g.exerciseName)}`} className="font-semibold text-indigo-400 hover:text-indigo-300">{g.name}</Link>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          {changed && <span title="Edited, not saved" className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                          {s.setNumber}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-400">
                        {timed ? formatMeasure("time", s.targetReps) : `${bands ? formatMeasure("bands", s.targetWeight) : `${fmt(s.targetWeight)} lb`} × ${s.targetReps}`}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {timed ? <span className="text-gray-500">—</span> : (
                          <span className="inline-flex items-center gap-1">
                            <input aria-label={`Weight, ${label}`} value={d.weight} disabled={busy} inputMode="decimal" onChange={(e) => edit(s.id, { weight: e.target.value })} className={`${cell} w-16 text-right font-semibold ${error?.startsWith("Weight") ? "border-red-500" : "border-gray-700"}`} />
                            <span className="text-xs text-gray-400 w-8 text-left">{bands ? "bands" : "lb"}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="inline-flex items-center gap-1">
                          <input aria-label={`${timed ? "Seconds" : "Reps"}, ${label}`} value={d.reps} disabled={busy} inputMode="numeric" onChange={(e) => edit(s.id, { reps: e.target.value })} className={`${cell} w-14 text-right ${error?.startsWith("Reps") ? "border-red-500" : "border-gray-700"}`} />
                          {timed && <span className="text-xs text-gray-400">s</span>}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <select aria-label={`Rating, ${label}`} value={d.rating} disabled={busy} onChange={(e) => edit(s.id, { rating: e.target.value as SetDraft["rating"] })} className={`${cell} border-gray-700`}>
                          <option value="">—</option><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select aria-label={`Status, ${label}`} value={d.status} disabled={busy} onChange={(e) => edit(s.id, { status: e.target.value as SetDraft["status"] })} className={`${cell} border-gray-700`}>
                          <option value="done">Done</option><option value="failed">Failed</option><option value="skipped">Skipped</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input aria-label={`Notes, ${label}`} value={d.notes} disabled={busy} placeholder="—" onChange={(e) => edit(s.id, { notes: e.target.value })} className={`${cell} w-40 border-gray-700`} />
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <button type="button" disabled={busy} aria-label={`Remove ${label}`} onClick={() => setConfirm({ kind: "remove", set: s })} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 disabled:opacity-40">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>,
                    error ? (
                      <tr key={`${s.id}-error`}><td colSpan={9} className="px-4 pb-2 text-right text-xs text-red-400">{error}</td></tr>
                    ) : null,
                  ];
                }))}
              </tbody>
            </table>
          </div>
        )}
        {(changes > 0 || saveState !== "idle") && (
          <div role="status" className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-800 ${changes > 0 ? "bg-amber-500/10" : ""}`}>
            <span className={changes > 0 ? "text-amber-300 font-medium" : "text-green-400 font-medium"}>
              {changes > 0
                ? `${changes} unsaved change${changes === 1 ? "" : "s"}${errors > 0 ? ` · fix ${errors} invalid value${errors === 1 ? "" : "s"} to save` : ""}`
                : saveState === "saving" ? "Saving…" : "✓ Saved"}
            </span>
            {changes > 0 && (
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirm({ kind: "discard" })} className="h-9 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">Discard…</button>
                <button type="button" disabled={busy || errors > 0} onClick={save} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2">
                  {saveState === "saving" && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" aria-hidden="true" />}
                  {saveState === "saving" ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!session.skipped && (
        <AddExerciseForm
          definitions={definitions}
          existingSets={sets}
          sessionDate={date}
          disabledReason={changes > 0 ? "Save or discard your edits to add an exercise" : busy ? "Saving…" : null}
          onAdd={onAddExercise}
        />
      )}

      {(session.progressionChanges ?? []).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="font-semibold">Weight changes from this session</h3>
            <p className="text-xs text-gray-500">Made when the session was logged. Editing sets here doesn&apos;t change them.</p>
          </div>
          <ul>
            {session.progressionChanges!.map((c) => {
              const def = definitions[c.definitionId];
              const unit = def?.equipmentType === "assisted_pullup" ? "bands" : "weight";
              return (
                <li key={c.definitionId} className="flex justify-between gap-3 px-4 py-2.5 border-t border-gray-800 first:border-t-0 text-sm">
                  <span className="font-semibold">{def?.name ?? `Unknown exercise (${c.definitionId})`}</span>
                  <span className="tabular-nums text-gray-300">
                    {fmt(c.before.currentWeight)} → {unit === "bands" ? formatMeasure("bands", c.after.currentWeight).replace("No assist", "0 bands") : `${fmt(c.after.currentWeight)} lb`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {confirm?.kind === "discard" && (
        <ConfirmDeleteModal title="Discard changes" message={`Throw away ${changes} unsaved change${changes === 1 ? "" : "s"} and put back the logged values?`} confirmLabel="Discard" cancelLabel="Keep editing" onCancel={() => setConfirm(null)} onConfirm={discard} />
      )}
      {confirm?.kind === "remove" && (
        <ConfirmDeleteModal
          title="Remove set"
          message={`Remove ${confirm.set.exerciseName} set ${confirm.set.setNumber}? It's taken out of the session when you save; Discard brings it back.`}
          confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setRemoved((r) => new Set(r).add(confirm.set.id)); setSaveState("idle"); setConfirm(null); }}
        />
      )}
      {confirm?.kind === "delete" && (
        <ConfirmDeleteModal
          title="Delete session"
          message={`Delete this ${session.dayOfWeek} Week ${session.week} session? Its sets are removed and any weight changes it made are undone. This cannot be undone.`}
          isConfirming={deleting}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
