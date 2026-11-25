import type { CompletedSet } from "./types";

// Editing a logged session's sets: each set becomes a text draft the table edits, then the drafts
// are validated and written back onto the sets.

export type DraftStatus = "done" | "failed" | "skipped";

export interface SetDraft {
  id: string;
  weight: string;
  reps: string;      // reps, or seconds for a timed exercise
  rating: "" | "easy" | "normal" | "hard";
  status: DraftStatus;
  notes: string;
}

export function toDraft(set: CompletedSet): SetDraft {
  return {
    id: set.id,
    weight: String(set.actualWeight),
    reps: String(set.actualReps),
    rating: set.rating ?? "",
    status: set.skipped ? "skipped" : set.completed ? "done" : "failed",
    notes: set.notes ?? "",
  };
}

const isNumber = (text: string) => text.trim() !== "" && Number.isFinite(Number(text.trim()));

export function draftError(draft: SetDraft): string | null {
  if (!isNumber(draft.weight) || Number(draft.weight) < 0) return "Weight must be a number of 0 or more";
  if (!isNumber(draft.reps) || Number(draft.reps) < 0 || !Number.isInteger(Number(draft.reps))) return "Reps must be a whole number of 0 or more";
  return null;
}

function sameAsSet(set: CompletedSet, draft: SetDraft): boolean {
  const original = toDraft(set);
  return original.weight === draft.weight.trim() && original.reps === draft.reps.trim()
    && original.rating === draft.rating && original.status === draft.status && original.notes === draft.notes.trim();
}

// The sets with the drafts written onto them and removed sets dropped. Throws on an invalid draft,
// naming the set, so nothing half-valid is ever saved.
export function applyDrafts(sets: CompletedSet[], drafts: SetDraft[], removed: Set<string>): CompletedSet[] {
  const byId = new Map(drafts.map((d) => [d.id, d]));
  return sets.filter((s) => !removed.has(s.id)).map((s) => {
    const draft = byId.get(s.id);
    if (!draft || sameAsSet(s, draft)) return s;
    const error = draftError(draft);
    if (error) throw new Error(`${s.exerciseName} set ${s.setNumber}: ${error}`);
    const { rating: _rating, skipped: _skipped, ...rest } = s;
    return {
      ...rest,
      actualWeight: Number(draft.weight.trim()),
      actualReps: Number(draft.reps.trim()),
      ...(draft.rating ? { rating: draft.rating } : {}),
      completed: draft.status === "done",
      ...(draft.status === "skipped" ? { skipped: true } : {}),
      notes: draft.notes.trim() || null,
    };
  });
}

export function isDraftChanged(set: CompletedSet, draft: SetDraft): boolean {
  return !sameAsSet(set, draft);
}

export function countChanges(sets: CompletedSet[], drafts: SetDraft[], removed: Set<string>, originalMinutes: number, minutes: number): number {
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const edited = sets.filter((s) => !removed.has(s.id) && byId.has(s.id) && !sameAsSet(s, byId.get(s.id)!)).length;
  return edited + removed.size + (originalMinutes === minutes ? 0 : 1);
}
