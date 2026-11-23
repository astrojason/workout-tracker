"use client";

import { useState } from "react";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { validateGymMachineInput } from "@/lib/gym-machines";
import { cleanWeight } from "@/lib/types";
import type { GymMachine } from "@/lib/types";

interface Props {
  machines: GymMachine[];
  linkedCounts: Record<string, number>; // machine id -> number of exercises using it
  loading: boolean;
  busyId: string | null; // "new" while adding, else the id being saved/deleted
  onCreate: (name: string, plates: number[]) => Promise<boolean>;
  onUpdate: (id: string, name: string, plates: number[]) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const formatWeights = (plates: number[]) => plates.map(cleanWeight).join(", ");

export function GymMachinesManager({ machines, linkedCounts, loading, busyId, onCreate, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [weightsText, setWeightsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const saving = busyId === (editingId ?? "new");

  function resetForm() {
    setEditingId(null);
    setName("");
    setWeightsText("");
    setError(null);
  }

  function startEdit(machine: GymMachine) {
    setEditingId(machine.id);
    setName(machine.name);
    setWeightsText(formatWeights(machine.plates));
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const result = validateGymMachineInput(name, weightsText, machines, editingId ?? undefined);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    const ok = editingId
      ? await onUpdate(editingId, result.name, result.plates)
      : await onCreate(result.name, result.plates);
    if (ok) {
      setMessage(`${editingId ? "Saved" : "Added"} “${result.name}”`);
      resetForm();
    }
  }

  async function handleConfirmDelete() {
    const machine = machines.find((m) => m.id === confirmDeleteId);
    if (!machine) return;
    const ok = await onDelete(machine.id);
    setConfirmDeleteId(null);
    if (ok) {
      setMessage(`Deleted “${machine.name}”`);
      if (editingId === machine.id) resetForm();
    }
  }

  const toDelete = machines.find((m) => m.id === confirmDeleteId);
  const toDeleteCount = toDelete ? linkedCounts[toDelete.id] ?? 0 : 0;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">{editingId ? "Edit machine" : "Add a machine"}</h2>
        <input
          type="text"
          aria-label="Machine name"
          placeholder="e.g. Lat Pulldown"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          className="input-field w-full"
        />
        <input
          type="text"
          aria-label="Machine weights"
          placeholder="Weights it can be set to, e.g. 10, 20, 30, 42.5"
          value={weightsText}
          onChange={(e) => setWeightsText(e.target.value)}
          disabled={saving}
          className="input-field w-full"
        />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold transition disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Add machine"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {message && <p role="status" className="text-sm text-green-400">{message}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <span className="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          Loading machines…
        </div>
      ) : machines.length === 0 ? (
        <p className="text-sm text-gray-500">No gym machines yet. Add one above, then pick it on a machine exercise.</p>
      ) : (
        <ul className="space-y-2">
          {machines.map((m) => {
            const count = linkedCounts[m.id] ?? 0;
            const busy = busyId === m.id;
            return (
              <li key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{m.name}</p>
                  <p data-testid={`weights-${m.name}`} className="text-sm text-gray-400">{formatWeights(m.plates)}</p>
                  <p className="text-xs text-gray-500 mt-1">{count} {count === 1 ? "exercise" : "exercises"}</p>
                </div>
                {busy ? (
                  <span className="text-sm text-gray-400">Working…</span>
                ) : (
                  <div className="flex gap-2">
                    <button
                      aria-label={`Edit ${m.name}`}
                      onClick={() => startEdit(m)}
                      disabled={busyId !== null}
                      className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      aria-label={`Delete ${m.name}`}
                      onClick={() => setConfirmDeleteId(m.id)}
                      disabled={busyId !== null}
                      className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-red-900 text-sm text-red-300 transition disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {toDelete && (
        <ConfirmDeleteModal
          title="Delete machine"
          message={
            toDeleteCount > 0
              ? `Delete “${toDelete.name}”? ${toDeleteCount} ${toDeleteCount === 1 ? "exercise uses" : "exercises use"} it; ${toDeleteCount === 1 ? "it keeps" : "they keep"} its weights but ${toDeleteCount === 1 ? "is" : "are"} no longer linked.`
              : `Delete “${toDelete.name}”? No exercises use it.`
          }
          confirmLabel="Delete machine"
          isConfirming={busyId === toDelete.id}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
