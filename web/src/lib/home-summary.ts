// What the iPhone Home Screen widget shows: today's workout for each program and how the week
// is going. Posted to the native app (see NativeHomeSummary), which hands it to the widget.

export interface HomeSummaryProgram {
  programName: string;
  dayLabel: string | null; // null on a rest day (nothing scheduled today)
  exerciseCount: number;
  done: boolean;
}

export interface HomeSummary {
  date: string; // local YYYY-MM-DD the summary was built for, so the widget can tell when it is stale
  programs: HomeSummaryProgram[];
  completedThisWeek: number;
  plannedThisWeek: number;
}

export interface HomeSummaryInput {
  programName: string;
  workout: { dayOfWeek: string; exerciseCount: number } | null;
  done: boolean;
}

const MAX_PROGRAMS = 3; // what fits in the medium widget

export function buildHomeSummary(
  programs: HomeSummaryInput[],
  week: { completedThisWeek: number; plannedThisWeek: number },
  now: Date,
): HomeSummary {
  return {
    date: now.toLocaleDateString("en-CA"),
    programs: programs.slice(0, MAX_PROGRAMS).map((p) => ({
      programName: p.programName,
      dayLabel: p.workout?.dayOfWeek ?? null,
      exerciseCount: p.workout?.exerciseCount ?? 0,
      done: p.done,
    })),
    completedThisWeek: week.completedThisWeek,
    plannedThisWeek: week.plannedThisWeek,
  };
}
