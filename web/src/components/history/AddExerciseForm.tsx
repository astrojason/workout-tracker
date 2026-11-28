"use client";

import { useId, useState } from "react";
import type { CompletedSet, ExerciseDefinition, PRResult } from "@/lib/types";
import { useError } from "@/components/providers/ErrorProvider";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { addedSetError, buildAddedExercise, findDefinitionByName } from "@/lib/added-exercise";
import type { AddedSetEntry } from "@/lib/added-exercise";

const PR_LABEL: Record<PRResult["type"], string> = { weight: "weight", estimated1RM: "estimated 1RM", volume: "volume" };
const EMPTY_SET: AddedSetEntry = { weight: "", reps: "" };
const inputCls = "h-9 rounded-lg border bg-gray-800 px-2 text-white outline-none focus:border-indigo-500 disabled:opacity-60";

type Confirm = { kind: "cancel" } | { kind: "remove"; index: number };

// "Add exercise" for a session that's already saved: pick an exercise from the library (or type a
// new name), enter its sets and save. The sets go after the session's last exercise. Program
// weights and progression aren't changed (see addExerciseAfterTheFact).
export function AddExerciseForm({ definitions, existingSets, sessionDate, disabledReason, onAdd }: {
  definitions: Record<string, ExerciseDefinition>;
  existingSets: CompletedSet[];
  sessionDate: Date; // the added sets are stamped with the session's date, not today's
  disabledReason?: string | null; // why adding is unavailable right now, e.g. unsaved edits
  onAdd: (sets: CompletedSet[]) => Promise<PRResult[]>;
}) {
  const { showError } = useError();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [manualTimed, setManualTimed] = useState(false);
  const [sets, setSets] = useState<AddedSetEntry[]>([EMPTY_SET]);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [added, setAdded] = useState<{ name: string; count: number; prs: PRResult[] } | null>(null);

  const definition = findDefinitionByName(definitions, name);
  const timed = definition ? definition.isTimeBased : manualTimed;
  const bands = definition?.equipmentType === "assisted_pullup";
  const errors = sets.map((s) => addedSetError(s, timed));
  const canSave = name.trim() !== "" && errors.every((e) => e === null) && !saving;
  const hasInput = name.trim() !== "" || sets.some((s) => s.weight.trim() !== "" || s.reps.trim() !== "");

  function reset() {
    setName("");
    setManualTimed(false);
    setSets([EMPTY_SET]);
    setConfirm(null);
    setOpen(false);
  }

  function edit(index: number, patch: Partial<AddedSetEntry>) {
    setSets((ss) => ss.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeRow(index: number) {
    setSets((ss) => ss.filter((_, i) => i !== index));
    setConfirm(null);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const newSets = buildAddedExercise(existingSets, { name, definition, isTimeBased: timed, sets }, sessionDate);
      const prs = await onAdd(newSets);
      setAdded({ name: newSets[0].exerciseName, count: newSets.length, prs });
      reset();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!!disabledReason}
          onClick={() => { setAdded(null); setOpen(true); }}
          className="h-9 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span> Add exercise
        </button>
        {disabledReason && <span className="text-sm text-gray-400">{disabledReason}</span>}
        {added && !disabledReason && (
          <div role="status" className="text-sm">
            <span className="text-green-400 font-medium">✓ Added {added.name} ({added.count} {added.count === 1 ? "set" : "sets"})</span>
            {added.prs.map((p) => (
              <span key={p.type} className="ml-3 text-yellow-400">New {PR_LABEL[p.type]} PR</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      aria-label="Add exercise"
      onSubmit={(e) => { e.preventDefault(); save(); }}
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3"
    >
      <div>
        <h3 className="font-semibold">Add exercise</h3>
        <p className="text-xs text-gray-500">Logged as part of this session. Program weights aren&apos;t changed.</p>
      </div>
      <div>
        <label htmlFor={`${id}-name`} className="block text-sm text-gray-400 mb-1">Exercise</label>
        <input
          id={`${id}-name`}
          list={`${id}-options`}
          value={name}
          disabled={saving}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pick from your library or type a new name"
          className={`${inputCls} w-full border-gray-700`}
        />
        <datalist id={`${id}-options`}>
          {Object.values(definitions).map((d) => d.name).sort().map((n) => <option key={n} value={n} />)}
        </datalist>
        {name.trim() !== "" && (
          <p className="mt-1 text-xs text-gray-500">
            {definition ? `From your library · ${timed ? "timed" : "reps"}` : "Not in your library: logged by name only"}
          </p>
        )}
      </div>
      {!definition && (
        <div className="flex gap-2" role="group" aria-label="Set type">
          {([false, true] as const).map((isTime) => (
            <button
              key={String(isTime)}
              type="button"
              aria-pressed={manualTimed === isTime}
              disabled={saving}
              onClick={() => setManualTimed(isTime)}
              className={`h-8 px-4 rounded-lg text-sm font-semibold transition ${manualTimed === isTime ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              {isTime ? "Time" : "Reps"}
            </button>
          ))}
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {sets.map((s, i) => {
          const n = i + 1;
          const error = errors[i];
          // An untouched row isn't an error yet; Save stays disabled until it's filled in.
          const visibleError = error !== null && (s.reps.trim() !== "" || s.weight.trim() !== "");
          return (
            <li key={i} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
                <span className="w-12 text-gray-400">Set {n}</span>
                {!timed && (
                  <span className="inline-flex items-center gap-1">
                    <input aria-label={`Weight, set ${n}`} value={s.weight} disabled={saving} inputMode="decimal" placeholder={bands ? "0" : "BW"}
                      onChange={(e) => edit(i, { weight: e.target.value })}
                      className={`${inputCls} w-20 text-right ${error?.startsWith("Weight") ? "border-red-500" : "border-gray-700"}`} />
                    <span className="text-xs text-gray-400 w-9">{bands ? "bands" : "lb"}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <input aria-label={`${timed ? "Seconds" : "Reps"}, set ${n}`} value={s.reps} disabled={saving} inputMode="numeric"
                    onChange={(e) => edit(i, { reps: e.target.value })}
                    className={`${inputCls} w-16 text-right ${visibleError && !error?.startsWith("Weight") ? "border-red-500" : "border-gray-700"}`} />
                  <span className="text-xs text-gray-400">{timed ? "s" : "reps"}</span>
                </span>
                {sets.length > 1 && (
                  <button type="button" disabled={saving} aria-label={`Remove set ${n}`}
                    onClick={() => (s.weight.trim() || s.reps.trim() ? setConfirm({ kind: "remove", index: i }) : removeRow(i))}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 disabled:opacity-40">✕</button>
                )}
              </div>
              {visibleError && <p className="pl-14 text-xs text-red-400">{error}</p>}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={saving}
          onClick={() => setSets((ss) => [...ss, { weight: ss[ss.length - 1]?.weight ?? "", reps: "" }])}
          className="h-9 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">
          Add another set
        </button>
        <div className="ml-auto flex gap-2">
          <button type="button" disabled={saving} onClick={() => (hasInput ? setConfirm({ kind: "cancel" }) : reset())}
            className="h-9 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={!canSave}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" aria-hidden="true" />}
            {saving ? "Saving…" : "Save exercise"}
          </button>
        </div>
      </div>

      {confirm?.kind === "cancel" && (
        <ConfirmDeleteModal title="Discard exercise" message={`Throw away ${name.trim() || "this exercise"} and the sets you've entered? Nothing has been saved yet.`}
          confirmLabel="Discard" cancelLabel="Keep editing" onCancel={() => setConfirm(null)} onConfirm={reset} />
      )}
      {confirm?.kind === "remove" && (
        <ConfirmDeleteModal title="Remove set" message={`Remove set ${confirm.index + 1} and what you entered for it?`}
          confirmLabel="Remove" onCancel={() => setConfirm(null)} onConfirm={() => removeRow(confirm.index)} />
      )}
    </form>
  );
}
