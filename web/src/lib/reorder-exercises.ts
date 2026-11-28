import type { Exercise } from "@/lib/types";

export type MoveDirection = "up" | "down";

// Moves one exercise a single place within its day, by stored order, and renumbers the
// whole day 1..n so there are no gaps or duplicate orders afterwards. Returns a new array.
export function moveExercise(exercises: Exercise[], exerciseId: string, direction: MoveDirection): Exercise[] {
  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((e) => e.id === exerciseId);
  if (from === -1) throw new Error(`Exercise ${exerciseId} not found in this day`);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0) throw new Error(`Exercise ${exerciseId} is already first`);
  if (to >= sorted.length) throw new Error(`Exercise ${exerciseId} is already last`);
  [sorted[from], sorted[to]] = [sorted[to], sorted[from]];
  return sorted.map((e, i) => ({ ...e, order: i + 1 }));
}
