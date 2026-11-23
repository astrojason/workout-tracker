import type { ActiveSession } from "./types";
import { repTargetDisplay, cleanWeight } from "./types";
import { currentSetView } from "./inserted-set";

// What comes after a rest, for the rest screen, the iPhone/watch mirror and notifications.
// The session has already moved on to the next set when the rest starts, so this describes
// the current position: another set of the same exercise, or the first set of the next one.
export interface NextSetSummary {
  label: "Next Set" | "Up Next";
  detail: string;   // e.g. "Bench Press - Set 2 of 3"
  weight: number;
  reps: string;     // e.g. "8–10 reps", "45s", "AMRAP"
}

export function nextSetSummary(session: ActiveSession): NextSetSummary | null {
  const view = currentSetView(session);
  if (!view) return null;
  const { exercise, weight } = view;
  const started = session.completedSets.some((s) => s.exerciseOrder === exercise.order);
  return {
    label: started || session.currentSetNumber > 1 ? "Next Set" : "Up Next",
    detail: `${exercise.name} - Set ${session.currentSetNumber} of ${exercise.sets}`,
    weight,
    reps: repTargetDisplay(exercise.repMin, exercise.repMax, exercise, session.currentSetNumber),
  };
}

// "135 lb · 8–10 reps" — weight left out when there's no load (bodyweight, bands).
export function weightAndReps(summary: Pick<NextSetSummary, "weight" | "reps">): string {
  return [summary.weight > 0 ? `${cleanWeight(summary.weight)} lb` : "", summary.reps].filter(Boolean).join(" · ");
}
