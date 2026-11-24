import Link from "next/link";
import type { ExerciseDefinition, Program, Workout } from "@/lib/types";
import { resolveExercise } from "@/lib/types";
import { ExerciseSummary, UnresolvedExerciseSummary } from "@/components/programs/ExerciseSummary";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Desktop Home side column: today's exercises for one program, with a link to edit it.
export function UpToday({ program, workout, week, definitions }: {
  program: Pick<Program, "id" | "name">;
  workout: Workout;
  week: number;
  definitions: Record<string, ExerciseDefinition>;
}) {
  return (
    <section aria-labelledby="up-today-heading" className="border-t border-gray-800">
      <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-800">
        <div>
          <h2 id="up-today-heading" className="text-sm font-bold uppercase tracking-wider text-gray-400">Up today</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {program.name} · {workout.dayOfWeek} · Week {week}
          </p>
        </div>
        <Link href={`/programs/${program.id}`} className="shrink-0 text-sm font-semibold text-indigo-400 hover:text-indigo-300">
          Edit program →
        </Link>
      </div>
      {[...workout.exercises].sort((a, b) => a.order - b.order).map((raw) => {
        let row;
        try {
          const exercise = resolveExercise(raw, definitions);
          row = (
            <>
              <div className="min-w-0"><ExerciseSummary exercise={exercise} /></div>
              <span className="text-xs text-gray-500">{capitalize(exercise.phase)}</span>
            </>
          );
        } catch (err) {
          row = <div className="min-w-0"><UnresolvedExerciseSummary error={err} /></div>;
        }
        return (
          <div key={raw.id} className="py-3 border-b border-gray-800 grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-center">
            {row}
          </div>
        );
      })}
    </section>
  );
}
