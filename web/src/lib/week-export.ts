import type { ResolvedWorkout, WorkoutSessionDoc, CompletedSet } from "./types";
import { groupSetsByOccurrence } from "./set-groups";
import { DAY_ORDER, repTargetDisplay, formatRestTime, exerciseWeightDisplay, cleanWeight, formatTimeValue, formatDuration } from "./types";

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

function sessionDateOf(value: WorkoutSessionDoc["date"]): Date {
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate: () => Date }).toDate();
  return new Date(value as unknown as string);
}

// One whole logged workout as a Markdown document: a heading per exercise (warm-ups labelled
// separately) and a numbered line per set with weight, reps, rating and notes.
export function formatSessionAsMarkdown(session: WorkoutSessionDoc): string {
  const date = sessionDateOf(session.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const lines: string[] = [
    `# ${session.programName} — ${session.dayOfWeek}, Week ${session.week}`,
    "",
    session.skipped ? `${date} · Skipped` : `${date} · ${formatDuration(session.durationSeconds)}`,
    "",
  ];

  if (session.skipped) return lines.join("\n").trimEnd();

  const groups = groupSetsByOccurrence(session.sets ?? []);
  if (groups.length === 0) lines.push("No sets logged.");

  for (const group of groups) {
    lines.push(`## ${group.name}`, "");
    for (const s of [...group.sets].sort((a, b) => a.setNumber - b.setNumber)) {
      let text: string;
      if (s.skipped) text = "skipped";
      else if (s.isTimeBased) text = formatTimeValue(s.actualReps);
      else if (s.actualWeight > 0) text = `${s.actualReps} reps @ ${cleanWeight(s.actualWeight)} lb`;
      else text = `${s.actualReps} reps`;
      const parts = [text];
      if (!s.skipped && !s.completed) parts.push("failed");
      if (s.rating) parts.push(s.rating);
      if (s.notes && !s.skipped) parts.push(s.notes);
      lines.push(`${s.setNumber}. ${parts.join(" — ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
