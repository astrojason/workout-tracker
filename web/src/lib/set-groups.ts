import type { CompletedSet } from "./types";

export interface SetGroup {
  order: number;
  name: string;         // display name, e.g. "Landmine Squat (warmup)"
  exerciseName: string; // the real exercise name, for links
  sets: CompletedSet[];
}

// One group per exercise occurrence, not per name: a lift's warmup and working sets
// are separate groups. Sets saved before `phase` existed fall back to treating the
// earliest occurrence of a repeated name as the warmup (warmups always sort first).
export function groupSetsByOccurrence(sets: CompletedSet[]): SetGroup[] {
  const byOrder = new Map<number, CompletedSet[]>();
  for (const set of sets) {
    const group = byOrder.get(set.exerciseOrder);
    if (group) group.push(set);
    else byOrder.set(set.exerciseOrder, [set]);
  }

  const orders = [...byOrder.keys()].sort((a, b) => a - b);
  return orders.map((order) => {
    const groupSets = byOrder.get(order)!;
    const exerciseName = groupSets[0].exerciseName;
    const otherOrders = orders.filter((o) => o !== order && byOrder.get(o)![0].exerciseName === exerciseName);
    const phase = groupSets[0].phase;
    const isWarmup = otherOrders.length > 0 &&
      (phase ? phase === "warmup" : order < Math.min(...otherOrders));
    return { order, name: isWarmup ? `${exerciseName} (warmup)` : exerciseName, exerciseName, sets: groupSets };
  });
}
