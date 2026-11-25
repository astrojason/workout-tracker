"use client";

import { useState } from "react";
import type { EquipmentItem, EquipmentItemKind } from "@/lib/types";
import { cleanWeight } from "@/lib/types";
import { ITEM_KIND_LABEL, validateEquipmentItem } from "@/lib/equipment-items";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

interface Props {
  items: EquipmentItem[]; // as saved
  // Saves the whole list straight away (not with the page's other unsaved edits). Reports its own
  // error and resolves false on failure.
  onSaveItems: (items: EquipmentItem[]) => Promise<boolean>;
}

const newId = () => `item-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function describe(item: EquipmentItem): string | null {
  if (item.kind === "plate_loaded") return `${cleanWeight(item.baseWeight ?? 0)} lb empty · plates on ${(item.sides ?? 1) === 1 ? "one side" : "both sides"}`;
  if (item.kind === "fixed") return `${(item.weights ?? []).map(cleanWeight).join(", ")} lb`;
  return null; // the kind label already says "No weight"
}

// The user's own equipment that the fixed categories don't cover (a FitArc, medicine balls, a
// stability ball). Adding, editing or removing one saves it immediately: these are separate
// actions with their own buttons, so they mustn't wait for the page's Save.
export function EquipmentItemsSection({ items, onSaveItems }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EquipmentItemKind>("plate_loaded");
  const [baseWeight, setBaseWeight] = useState("");
  const [sides, setSides] = useState<1 | 2>(1);
  const [weights, setWeights] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<EquipmentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function reset() {
    setEditingId(null); setName(""); setKind("plate_loaded"); setBaseWeight(""); setSides(1); setWeights(""); setError(null);
  }

  function startEdit(item: EquipmentItem) {
    setEditingId(item.id);
    setName(item.name);
    setKind(item.kind);
    setBaseWeight(item.baseWeight !== undefined ? String(item.baseWeight) : "");
    setSides(item.sides ?? 1);
    setWeights((item.weights ?? []).join(", "));
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateEquipmentItem({ name, kind, baseWeight, sides, weights }, items, editingId ?? undefined);
    if (!result.ok) { setError(result.error); return; }
    const next = editingId
      ? items.map((i) => (i.id === editingId ? { id: i.id, ...result.item } : i))
      : [...items, { id: newId(), ...result.item }];
    setBusy(true);
    setDone(null);
    const ok = await onSaveItems(next);
    setBusy(false);
    // On failure the error is already shown; keep the form as typed so nothing is lost.
    if (!ok) return;
    setDone(`✓ ${editingId ? "Saved" : "Added"} ${result.item.name}`);
    reset();
  }

  async function remove(item: EquipmentItem) {
    setBusy(true);
    setDone(null);
    const ok = await onSaveItems(items.filter((i) => i.id !== item.id));
    setBusy(false);
    setRemoving(null);
    if (!ok) return;
    if (editingId === item.id) reset();
    setDone(`✓ Removed ${item.name}`);
  }

  return (
    <section aria-labelledby="equipment-items-title" className="mb-6">
      <h2 id="equipment-items-title" className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Your own equipment</h2>
      <p className="text-xs text-gray-500 mb-3">
        Anything the sections here don&apos;t cover: a plate-loaded handle like a FitArc, a set of medicine balls, a stability ball.
        Link an exercise to an item in the exercise library so its weights and plate math use it.
      </p>

      {items.length > 0 && (
        <ul className="mb-3 bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-400">{[ITEM_KIND_LABEL[item.kind], describe(item)].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" aria-label={`Edit ${item.name}`} disabled={busy} onClick={() => startEdit(item)} className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm">Edit</button>
                <button type="button" aria-label={`Remove ${item.name}…`} disabled={busy} onClick={() => setRemoving(item)} className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-red-900 text-sm text-red-300">Remove…</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
        <div className="text-sm font-semibold">{editingId ? `Edit ${items.find((i) => i.id === editingId)?.name ?? "item"}` : "Add an item"}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Item name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FitArc" className="input-field" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Kind
            <select value={kind} onChange={(e) => { setKind(e.target.value as EquipmentItemKind); setError(null); }} className="input-field">
              {(Object.keys(ITEM_KIND_LABEL) as EquipmentItemKind[]).map((k) => <option key={k} value={k}>{ITEM_KIND_LABEL[k]}</option>)}
            </select>
          </label>
          {kind === "plate_loaded" && (
            <>
              <label className="flex flex-col gap-1 text-xs text-gray-400">
                Empty weight (lb)
                <input value={baseWeight} onChange={(e) => setBaseWeight(e.target.value)} inputMode="decimal" placeholder="e.g. 5" className="input-field" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-400">
                Loaded on
                <select value={sides} onChange={(e) => setSides(Number(e.target.value) as 1 | 2)} className="input-field">
                  <option value={1}>One side</option>
                  <option value={2}>Both sides</option>
                </select>
              </label>
            </>
          )}
          {kind === "fixed" && (
            <label className="col-span-2 flex flex-col gap-1 text-xs text-gray-400">
              Weights (lb)
              <input value={weights} onChange={(e) => setWeights(e.target.value)} placeholder="e.g. 2, 6, 9" className="input-field" />
            </label>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {busy && !removing && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" aria-hidden="true" />}
            {busy && !removing ? (editingId ? "Saving…" : "Adding…") : editingId ? "Save item" : "Add item"}
          </button>
          {editingId && <button type="button" disabled={busy} onClick={reset} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50">Cancel edit</button>}
        </div>
        {done && <p role="status" className="text-sm text-green-400">{done}</p>}
      </form>

      {removing && (
        <ConfirmDeleteModal
          title={`Remove ${removing.name}`}
          message={`Remove ${removing.name} from your equipment? This saves straight away. Exercises linked to it go back to their own equipment type.`}
          confirmLabel="Remove"
          confirmingLabel="Removing…"
          isConfirming={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => remove(removing)}
        />
      )}
    </section>
  );
}
