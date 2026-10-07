import type {
  CompletedSet,
  PreviousExercisePerformance,
  ResolvedExercise,
  WorkoutSessionDoc,
} from "./types";

function sessionTime(session: WorkoutSessionDoc): number {
  if (session.date instanceof Date) return session.date.getTime();
  return session.date.toDate().getTime();
}

function matchesExercise(set: CompletedSet, exercise: ResolvedExercise): boolean {
  if (set.definitionId) return set.definitionId === exercise.definitionId;
  return set.exerciseName === exercise.name;
}

function bestSet(sets: CompletedSet[], exercise: ResolvedExercise): CompletedSet {
  const compareByReps = exercise.isTimeBased ||
    exercise.equipmentType === "bodyweight" ||
    sets.every((set) => set.actualWeight <= 0);

  // Assisted weight is a band count: fewer bands means less help, so it is the stronger set.
  const fewerIsBetter = exercise.equipmentType === "assisted_pullup" && !compareByReps;

  return sets.reduce((best, candidate) => {
    if (compareByReps) return candidate.actualReps > best.actualReps ? candidate : best;
    if (fewerIsBetter && candidate.actualWeight !== best.actualWeight) {
      return candidate.actualWeight < best.actualWeight ? candidate : best;
    }
    if (candidate.actualWeight !== best.actualWeight) {
      return candidate.actualWeight > best.actualWeight ? candidate : best;
    }
    return candidate.actualReps > best.actualReps ? candidate : best;
  });
}

export function buildPreviousPerformanceMap(
  exercises: ResolvedExercise[],
  sessions: WorkoutSessionDoc[],
): Record<string, PreviousExercisePerformance> {
  const newestFirst = [...sessions].sort((a, b) => sessionTime(b) - sessionTime(a));
  const performances: Record<string, PreviousExercisePerformance> = {};

  for (const exercise of exercises) {
    for (const session of newestFirst) {
      const matchingSets = (session.sets || []).filter(
        (set) => set.completed && matchesExercise(set, exercise),
      );
      if (matchingSets.length === 0) continue;

      const previous = bestSet(matchingSets, exercise);
      performances[exercise.id] = {
        weight: previous.actualWeight,
        reps: previous.actualReps,
      };
      break;
    }
  }

  return performances;
}

// Assisted exercises have no stored working weight (their "weight" is a band count the
// lifter logs each time), so start them at the band count used last session.
export function seedAssistedWeights(
  exercises: ResolvedExercise[],
  previous: Record<string, PreviousExercisePerformance>,
): Record<string, number> {
  const seeded: Record<string, number> = {};
  for (const exercise of exercises) {
    if (exercise.equipmentType !== "assisted_pullup" || exercise.currentWeight > 0) continue;
    const bands = previous[exercise.id]?.weight ?? 0;
    if (bands > 0) seeded[exercise.id] = bands;
  }
  return seeded;
}
