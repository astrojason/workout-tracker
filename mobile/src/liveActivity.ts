import { weightAndReps, type WorkoutMirrorState } from "./messages";

/** The text and bar a Live Activity shows. Matches expo-live-activity's LiveActivityState. */
export interface ActivityContent {
  title: string;
  subtitle?: string;
  progressBar: { date: number } | { progress: number };
}

export function liveActivityState(state: WorkoutMirrorState, now: number): ActivityContent {
  if (state.restEndsAt !== null && state.restEndsAt > now) {
    return {
      title: "Rest",
      subtitle: state.nextDetail
        ? [`${state.nextLabel}: ${state.nextDetail}`, weightAndReps(state)].filter(Boolean).join(" · ")
        : "Catch your breath",
      progressBar: { date: state.restEndsAt },
    };
  }
  return {
    title: state.exercise,
    subtitle: [`Set ${state.set} of ${state.sets}`, weightAndReps(state)].filter(Boolean).join(" · "),
    progressBar: { progress: state.sets > 0 ? (state.set - 1) / state.sets : 0 },
  };
}

export interface LiveActivityPlan {
  keep: string | undefined; // the running activity to update
  stop: string[]; // running activities to end
  start: boolean; // start a new activity (none is running to update)
}

/**
 * Decides what to do with the Live Activities iOS reports as running. The remembered id lives only
 * in memory, so it is lost when iOS relaunches the app, and goes stale when an activity is swiped
 * away; trusting what is actually running avoids orphaned, frozen activities and updates to dead ids.
 */
export function planLiveActivity(runningIds: string[], rememberedId: string | undefined, workoutActive: boolean): LiveActivityPlan {
  if (!workoutActive) return { keep: undefined, stop: [...runningIds], start: false };
  const keep = rememberedId !== undefined && runningIds.includes(rememberedId) ? rememberedId : runningIds[0];
  return { keep, stop: runningIds.filter((id) => id !== keep), start: keep === undefined };
}
