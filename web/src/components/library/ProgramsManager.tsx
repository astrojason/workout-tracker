"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { ExerciseMatchModal } from "@/components/ui/ExerciseMatchModal";
import { ImportCancelledError, type ExerciseMatchDecision, type ExerciseMatchRequest } from "@/lib/exercise-import";
import type { ProgramRow } from "@/lib/library-index";

type Ask = (request: ExerciseMatchRequest) => Promise<ExerciseMatchDecision>;

// Every action throws on failure; this component reports the error.
export interface ProgramsManagerProps {
  rows: ProgramRow[];
  sessionLimit: number;
  onImport: (data: ArrayBuffer, name: string, ask: Ask) => Promise<void>;
  onReimport: (id: string, name: string, data: ArrayBuffer, ask: Ask) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onChangeWeek: (id: string, week: number) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onUnarchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Confirm = { kind: "archive" | "delete" | "reimport"; row: ProgramRow };

const shortDay = (d: string) => (d === "Daily" ? "Daily" : d.slice(0, 3));
const date = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never");
const btn = "h-8 px-2.5 rounded-lg text-xs font-semibold transition disabled:opacity-50";

// Desktop Programs page: the programs table plus everything the phone does from Settings —
// import, rename, current week, re-import, archive, unarchive and delete.
export function ProgramsManager(props: ProgramsManagerProps) {
  const { rows, sessionLimit } = props;
  const { showError } = useError();
  const fileRef = useRef<HTMLInputElement>(null);
  const reimportRef = useRef<HTMLInputElement>(null);
  const reimportTarget = useRef<ProgramRow | null>(null);

  const [pending, setPending] = useState<{ fileName: string; data: ArrayBuffer } | null>(null);
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [matchPrompt, setMatchPrompt] = useState<{ request: ExerciseMatchRequest; resolve: (d: ExerciseMatchDecision) => void } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string; saving: boolean } | null>(null);
  const [weekState, setWeekState] = useState<Record<string, "saving" | "saved">>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = rows.filter((r) => !r.archived);
  const archived = rows.filter((r) => r.archived);

  // The import awaits each answer, so unmatched exercises are asked about one at a time.
  const ask: Ask = (request) => new Promise((resolve) => {
    setMatchPrompt({ request, resolve: (d) => { setMatchPrompt(null); resolve(d); } });
  });

  function reportImportError(err: unknown) {
    if (err instanceof ImportCancelledError) setResult(err.message);
    else showError(err);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      setPending({ fileName: file.name, data });
      setImportName(file.name.replace(/\.xlsx$/i, "").replace(/[-_]/g, " "));
      setResult(null);
    } catch (err) {
      showError(err);
    }
  }

  async function runImport() {
    if (!pending) return;
    const name = importName.trim() || pending.fileName.replace(/\.xlsx$/i, "");
    setImporting(true);
    setResult(null);
    try {
      await props.onImport(pending.data, name, ask);
      setPending(null);
      setResult(`✓ Imported "${name}"`);
    } catch (err) {
      reportImportError(err);
    } finally {
      setImporting(false);
    }
  }

  async function chooseReimportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const row = reimportTarget.current;
    reimportTarget.current = null;
    if (!file || !row) return;
    setBusyId(row.id);
    setResult(null);
    try {
      await props.onReimport(row.id, row.name, await file.arrayBuffer(), ask);
      setResult(`✓ Re-imported "${row.name}"`);
    } catch (err) {
      reportImportError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function saveRename() {
    if (!renaming || !renaming.value.trim()) return;
    setRenaming({ ...renaming, saving: true });
    try {
      await props.onRename(renaming.id, renaming.value.trim());
      setRenaming(null);
    } catch (err) {
      setRenaming((r) => (r ? { ...r, saving: false } : r));
      showError(err);
    }
  }

  async function changeWeek(id: string, week: number) {
    setWeekState((s) => ({ ...s, [id]: "saving" }));
    try {
      await props.onChangeWeek(id, week);
      setWeekState((s) => ({ ...s, [id]: "saved" }));
    } catch (err) {
      setWeekState((s) => { const { [id]: _, ...rest } = s; return rest; });
      showError(err);
    }
  }

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      setConfirm(null);
    } catch (err) {
      setConfirm(null);
      showError(err);
    } finally {
      setBusyId(null);
    }
  }

  function confirmAction() {
    if (!confirm) return;
    const { kind, row } = confirm;
    if (kind === "reimport") {
      reimportTarget.current = row;
      setConfirm(null);
      reimportRef.current?.click();
    } else if (kind === "archive") {
      run(row.id, () => props.onArchive(row.id));
    } else {
      run(row.id, () => props.onDelete(row.id));
    }
  }

  const actions = (r: ProgramRow) => (
    <div className="inline-flex gap-1">
      <button type="button" disabled={busyId === r.id} aria-label={`Rename ${r.name}`} onClick={() => setRenaming({ id: r.id, value: r.name, saving: false })} className={`${btn} bg-gray-800 hover:bg-gray-700 text-gray-300`}>Rename</button>
      <button type="button" disabled={busyId === r.id} aria-label={`Re-import ${r.name}…`} onClick={() => setConfirm({ kind: "reimport", row: r })} className={`${btn} bg-gray-800 hover:bg-gray-700 text-gray-300`}>
        {busyId === r.id && !confirm ? "Re-importing…" : "Re-import…"}
      </button>
      <button type="button" disabled={busyId === r.id} aria-label={`Archive ${r.name}…`} onClick={() => setConfirm({ kind: "archive", row: r })} className={`${btn} bg-gray-800 hover:bg-gray-700 text-gray-300`}>Archive…</button>
      <button type="button" disabled={busyId === r.id} aria-label={`Delete ${r.name}…`} onClick={() => setConfirm({ kind: "delete", row: r })} className={`${btn} text-red-400 hover:bg-gray-800`}>Delete…</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <input ref={fileRef} type="file" accept=".xlsx" aria-label="Program spreadsheet" onChange={chooseFile} className="hidden" />
      <input ref={reimportRef} type="file" accept=".xlsx" aria-label="Re-import spreadsheet" onChange={chooseReimportFile} className="hidden" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Programs</h1>
          <p className="text-gray-400">Open a program to edit its exercises. Sessions and last trained come from your latest {sessionLimit} sessions.</p>
        </div>
        <div className="flex items-center gap-3">
          {result && <span role="status" className={`text-sm ${result.startsWith("✓") ? "text-green-400" : "text-amber-400"}`}>{result}</span>}
          <button type="button" disabled={importing} onClick={() => fileRef.current?.click()} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm disabled:opacity-60">+ Import program</button>
        </div>
      </div>

      {pending && (
        <section aria-labelledby="import-title" className="bg-gray-900 border border-indigo-500 rounded-xl">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
            <div>
              <h2 id="import-title" className="font-semibold">Import a program</h2>
              <p className="text-sm text-gray-400">{pending.fileName} · exercises not in your library are asked about one at a time</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4 px-5 py-4">
            <label className="flex flex-col gap-1 text-sm text-gray-400 flex-1 min-w-[240px] max-w-md">
              Program name
              <input value={importName} disabled={importing} onChange={(e) => setImportName(e.target.value)} className="input-field" />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={importing} onClick={() => setPending(null)} className="h-10 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">Cancel</button>
              <button type="button" disabled={importing} onClick={runImport} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2">
                {importing && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" aria-hidden="true" />}
                {importing ? "Importing…" : `Import ${importName.trim() || "program"}`}
              </button>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="active-title" className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 id="active-title" className="font-semibold">Active programs</h2>
        </div>
        {active.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400">No active programs. Import one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Program</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Current week</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Training days</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Exercises</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Sessions</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Last trained</th>
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {active.map((r) => (
                  <tr key={r.id} className="border-t border-gray-800 whitespace-nowrap">
                    <td className="px-5 py-2.5">
                      {renaming?.id === r.id ? (
                        <div className="flex items-center gap-1.5">
                          <label>
                            <span className="sr-only">New name for {r.name}</span>
                            <input
                              autoFocus
                              value={renaming.value}
                              disabled={renaming.saving}
                              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenaming(null); }}
                              className="input-field !w-48 !py-1"
                            />
                          </label>
                          <button type="button" disabled={renaming.saving || !renaming.value.trim()} onClick={saveRename} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}>{renaming.saving ? "Saving…" : "Save"}</button>
                          <button type="button" disabled={renaming.saving} onClick={() => setRenaming(null)} className={`${btn} bg-gray-800 hover:bg-gray-700`}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <Link href={`/programs/${r.id}`} className="font-semibold text-indigo-400 hover:text-indigo-300">{r.name}</Link>
                          <div className="text-xs text-gray-400">{r.totalWeeks} week{r.totalWeeks === 1 ? "" : "s"}</div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <label>
                          <span className="sr-only">Current week of {r.name}</span>
                          <select
                            value={r.currentWeek}
                            disabled={weekState[r.id] === "saving"}
                            onChange={(e) => changeWeek(r.id, Number(e.target.value))}
                            className="input-field !w-auto !py-1"
                          >
                            {Array.from({ length: r.totalWeeks }, (_, i) => i + 1).map((w) => <option key={w} value={w}>Week {w} of {r.totalWeeks}</option>)}
                          </select>
                        </label>
                        {weekState[r.id] === "saving" && <span className="text-xs text-gray-400">Saving…</span>}
                        {weekState[r.id] === "saved" && <span className="text-xs text-green-400">&#x2713; Saved</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-300">{r.days.length > 0 ? r.days.map(shortDay).join(" · ") : "—"}</td>
                    <td className="px-3 py-2.5 text-right">{r.exercises}</td>
                    <td className="px-3 py-2.5 text-right">{r.sessions}</td>
                    <td className="px-3 py-2.5 text-gray-300">{date(r.lastTrained)}</td>
                    <td className="px-5 py-2 text-right">{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section aria-labelledby="archived-title" className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 id="archived-title" className="font-semibold">Archived · {archived.length} program{archived.length === 1 ? "" : "s"}</h2>
            <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)} className="text-sm text-indigo-400 hover:text-indigo-300">{showArchived ? "Hide" : "Show"}</button>
          </div>
          {showArchived && (
            <table className="w-full text-sm tabular-nums border-t border-gray-800">
              <tbody>
                {archived.map((r) => (
                  <tr key={r.id} className="border-t border-gray-800 first:border-t-0 text-gray-300 whitespace-nowrap">
                    <td className="px-5 py-2.5"><Link href={`/programs/${r.id}`} className="font-semibold text-indigo-400 hover:text-indigo-300">{r.name}</Link><div className="text-xs text-gray-400">{r.totalWeeks} weeks · archived</div></td>
                    <td className="px-3 py-2.5 text-right">{r.sessions} sessions</td>
                    <td className="px-3 py-2.5">Last trained {date(r.lastTrained)}</td>
                    <td className="px-5 py-2 text-right">
                      <button type="button" disabled={busyId === r.id} aria-label={`Unarchive ${r.name}`} onClick={() => run(r.id, () => props.onUnarchive(r.id))} className={`${btn} bg-gray-800 hover:bg-gray-700`}>{busyId === r.id ? "Unarchiving…" : "Unarchive"}</button>
                      <button type="button" disabled={busyId === r.id} aria-label={`Delete ${r.name}…`} onClick={() => setConfirm({ kind: "delete", row: r })} className={`${btn} ml-1 text-red-400 hover:bg-gray-800`}>Delete…</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {confirm?.kind === "reimport" && (
        <ConfirmDeleteModal
          title={`Re-import ${confirm.row.name}`}
          message={`Choose the updated spreadsheet for ${confirm.row.name}. Its workouts and working weights are replaced by the spreadsheet's; your logged sessions stay in History.`}
          confirmLabel="Choose file"
          confirmClassName="bg-indigo-600 hover:bg-indigo-500"
          onCancel={() => setConfirm(null)}
          onConfirm={confirmAction}
        />
      )}
      {confirm?.kind === "archive" && (
        <ConfirmDeleteModal
          title={`Archive ${confirm.row.name}`}
          message={`${confirm.row.name} leaves Home and the Overview. Its sessions stay in History, and you can unarchive it any time.`}
          confirmLabel="Archive"
          confirmingLabel="Archiving…"
          confirmClassName="bg-indigo-600 hover:bg-indigo-500"
          isConfirming={busyId === confirm.row.id}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmAction}
        />
      )}
      {confirm?.kind === "delete" && (
        <ConfirmDeleteModal
          title={`Delete ${confirm.row.name}`}
          message={`Delete ${confirm.row.name} and all its workouts? Logged sessions stay in History. This cannot be undone.`}
          isConfirming={busyId === confirm.row.id}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmAction}
        />
      )}
      {matchPrompt && (
        <ExerciseMatchModal key={matchPrompt.request.exercise.name} request={matchPrompt.request} onDecide={matchPrompt.resolve} />
      )}
    </div>
  );
}
