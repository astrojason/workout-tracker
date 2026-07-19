import type { Workout } from "./types";
import { DAY_ORDER, repTargetDisplay, formatRestTime, exerciseWeightDisplay } from "./types";

export function formatWeekAsText(programName: string, week: number, workouts: Workout[]): string {
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
