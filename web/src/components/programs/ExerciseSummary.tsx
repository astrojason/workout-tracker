import type { ResolvedExercise } from "@/lib/types";
import { PHASE_COLORS, repTargetDisplay, finalSetAmrapNote, formatRestTime, exerciseWeightDisplay } from "@/lib/types";

// Name line (phase dot, name, ES) and the "3 x 8-12 | 135 lbs | 90s rest | Last set AMRAP" line,
// shared by the program editor and Home's "Up today" list.
export function ExerciseSummary({ exercise }: { exercise: ResolvedExercise }) {
  const amrapNote = finalSetAmrapNote(exercise);
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${PHASE_COLORS[exercise.phase] || "bg-gray-600"}`} />
        <span className="font-semibold truncate" data-exercise-name>{exercise.name}</span>
        {exercise.isUnilateral && <span className="text-orange-400 text-xs">ES</span>}
      </div>
      <div className="text-xs text-gray-500">
        {exercise.sets} x {repTargetDisplay(exercise.repMin, exercise.repMax, exercise)}
        {" | "}{exerciseWeightDisplay(exercise)}
        {exercise.restSeconds > 0 && <> | {formatRestTime(exercise.restSeconds)} rest</>}
        {amrapNote && <> | <span className="text-amber-400">{amrapNote}</span></>}
      </div>
    </>
  );
}

// A row for an exercise whose definition is missing: shows the resolve error rather than hiding it.
export function UnresolvedExerciseSummary({ error }: { error: unknown }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
        <span className="font-semibold text-red-400">Unresolved exercise</span>
      </div>
      <div className="text-xs text-gray-500 truncate">
        {error instanceof Error ? error.message : String(error)}
      </div>
    </>
  );
}
