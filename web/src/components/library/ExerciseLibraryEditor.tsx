"use client";

import { useEffect, useState } from "react";
import type { ExerciseDefinition, GymMachine, UserEquipmentConfig } from "@/lib/types";
import type { DefinitionSave } from "@/lib/firestore";
import type { ExerciseRow } from "@/lib/library-index";
import { useError } from "@/components/providers/ErrorProvider";
import { ExercisesIndex } from "./ExercisesIndex";
import { ExerciseDefinitionForm } from "./ExerciseDefinitionForm";

interface Props {
  rows: ExerciseRow[];
  sessionLimit: number;
  definitions: Record<string, ExerciseDefinition>;
  machines: GymMachine[];
  equipment: UserEquipmentConfig;
  // Throws on failure (the panel reports it and stays open).
  onSave: (definitionId: string, save: DefinitionSave) => Promise<void>;
}

// Desktop Exercises: the library table, with each exercise edited in a panel that slides in from
// the right. ?edit=<definitionId> (linked from Equipment) opens straight on that exercise.
export function ExerciseLibraryEditor({ rows, sessionLimit, definitions, machines, equipment, onSave }: Props) {
  const { showError } = useError();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Read after mount: there's no URL on the server.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (id) setEditingId(id);
  }, []);

  const editing = editingId ? definitions[editingId] ?? null : null;

  function close() {
    setEditingId(null);
    // Drop ?edit= so a reload doesn't reopen the panel.
    if (window.location.search.includes("edit=")) window.history.replaceState(null, "", window.location.pathname);
  }

  return (
    <>
      <ExercisesIndex rows={rows} sessionLimit={sessionLimit} onEdit={(id) => { setSaved(null); setEditingId(id); }} />
      {saved && (
        <p role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm shadow-xl">
          <span className="text-green-400">✓</span> Saved {saved}
          <button type="button" onClick={() => setSaved(null)} className="ml-3 text-gray-400 hover:text-white">Dismiss</button>
        </p>
      )}
      {editing && (
        <ExerciseEditPanel
          key={editing.id}
          definition={editing}
          machines={machines}
          equipment={equipment}
          onSave={(save) => onSave(editing.id, save)}
          onSaved={(name) => { setSaved(name); close(); }}
          onClose={close}
          onError={showError}
        />
      )}
    </>
  );
}

function ExerciseEditPanel({ definition, machines, equipment, onSave, onSaved, onClose, onError }: {
  definition: ExerciseDefinition;
  machines: GymMachine[];
  equipment: UserEquipmentConfig;
  onSave: (save: DefinitionSave) => Promise<void>;
  onSaved: (name: string) => void;
  onClose: () => void;
  onError: (err: unknown) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 top-[var(--app-nav-h)] z-50 flex justify-end bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="definition-panel-title"
        className="h-full w-full max-w-[600px] flex flex-col bg-gray-900 border-l border-gray-700 shadow-2xl motion-safe:animate-[slide-in-right_220ms_ease-out]"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-800">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Exercise library</div>
            <h2 id="definition-panel-title" className="text-xl font-bold truncate">Edit {definition.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-1 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ExerciseDefinitionForm
          variant="panel"
          definition={definition}
          machines={machines}
          equipment={equipment}
          onSave={onSave}
          onSaved={(save) => onSaved(save.meta.name ?? definition.name)}
          onCancel={onClose}
          onError={onError}
        />
      </div>
    </div>
  );
}
