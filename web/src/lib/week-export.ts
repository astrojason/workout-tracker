import type { ResolvedWorkout, WorkoutSessionDoc, CompletedSet } from "./types";
import { DAY_ORDER, repTargetDisplay, formatRestTime, exerciseWeightDisplay, cleanWeight, formatTimeValue } from "./types";

export function formatWeekAsText(programName: string, week: number, workouts: ResolvedWorkout[]): string {
  const sorted = [...workouts].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
  );

  const lines: string[] = [`${programName} — Week ${week}`, ""];

  for (const workout of sorted) {
    lines.push(workout.dayOfWeek.toUpperCase());
    const exercises = [...workout.exercises].sort((a, b) => a.order - b.order);
    for (const [i, exercise] of exercises.entries()) {
      const reps = repTargetDisplay(exercise.repMin, exercise.repMax, exercise);
      const weight = exerciseWeightDisplay(exercise);
      const rest = exercise.restSeconds > 0 ? ` (rest ${formatRestTime(exercise.restSeconds)})` : "";
      lines.push(`${i + 1}. ${exercise.name} — ${exercise.sets} x ${reps} @ ${weight}${rest}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function groupSetsByExercise(sets: CompletedSet[]): { name: string; sets: CompletedSet[] }[] {
  const seen = new Map<string, CompletedSet[]>();
  for (const s of sets) {
    if (!seen.has(s.exerciseName)) seen.set(s.exerciseName, []);
    seen.get(s.exerciseName)!.push(s);
  }
  return Array.from(seen.entries()).map(([name, sets]) => ({ name, sets }));
}

export function formatSessionsWeekAsText(programName: string, week: number, sessions: WorkoutSessionDoc[]): string {
  const sorted = [...sessions].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
  );

  const lines: string[] = [`${programName} — Week ${week} (completed)`, ""];

  for (const session of sorted) {
    lines.push(session.dayOfWeek.toUpperCase());
    const groups = groupSetsByExercise((session.sets ?? []).filter((s) => s.completed));
    if (groups.length === 0) {
      lines.push("  No completed sets");
    }
    for (const { name, sets } of groups) {
      const timeBased = sets[0]?.isTimeBased === true;
      const setsText = sets
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((s) => timeBased
          ? formatTimeValue(s.actualReps)
          : s.actualWeight > 0
            ? `${s.actualReps} @ ${cleanWeight(s.actualWeight)} lb`
            : `${s.actualReps}`)
        .join(", ");
      lines.push(`  ${name}: ${setsText}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
