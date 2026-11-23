import type { ActiveSession, ResolvedExercise } from "./types";

// A custom set added mid-exercise sits at the current position: the planned set it pushed
// back becomes the next set. While it's current, the exercise shows that set's own reps
// and weight instead of the plan's.
export interface CurrentSetView {
  exercise: ResolvedExercise;
  weight: number;
  isInserted: boolean;
}

export function currentSetView(session: ActiveSession): CurrentSetView | null {
  const exercise = session.workout.exercises[session.currentExerciseIndex];
  if (!exercise) return null;
  const inserted = session.insertedSet;
  if (inserted && inserted.exerciseId === exercise.id) {
    return {
      exercise: { ...exercise, repMin: inserted.reps, repMax: { type: "count", value: inserted.reps }, lastSetAmrap: undefined },
      weight: inserted.weight,
      isInserted: true,
    };
  }
  return { exercise, weight: session.resolvedWeights[exercise.id] ?? 0, isInserted: false };
}
