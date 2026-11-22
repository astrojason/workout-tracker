import type { WorkoutMirrorState } from "./messages";

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
      subtitle: state.nextDetail ? `${state.nextLabel}: ${state.nextDetail}` : "Catch your breath",
      progressBar: { date: state.restEndsAt },
    };
  }
  const weight = state.weight > 0 ? ` · ${state.weight} lb` : "";
  return {
    title: state.exercise,
    subtitle: `Set ${state.set} of ${state.sets}${weight}`,
    progressBar: { progress: state.sets > 0 ? (state.set - 1) / state.sets : 0 },
  };
}
