import type { EquipmentType, ExerciseDefinition, Program, ProgressionRule, Workout, WorkoutSessionDoc } from "./types";
import { DAY_ORDER } from "./types";
import { sessionDate } from "./overview-stats";

// Rows for the desktop Programs and Exercises pages.

export interface ProgramRow {
  id: string;
  name: string;
  archived: boolean;
  totalWeeks: number;
  currentWeek: number;
  days: string[];          // training days, in week order
  exercises: number;       // distinct exercises across all weeks
  sessions: number;        // logged sessions among those loaded
  lastTrained: Date | null;
}

export interface ExerciseRow {
  id: string;
  name: string;
  equipmentType: EquipmentType;
  equipmentDetail: string | null;
  muscles: string[];
  progressionRule: ProgressionRule;
  programs: string[];      // active programs that carry a working weight for it
  sessions: number;
  lastDone: Date | null;
}

function latest(dates: Date[]): Date | null {
  return dates.length === 0 ? null : new Date(Math.max(...dates.map((d) => d.getTime())));
}

export function programRows(
  programs: Program[], workouts: Workout[], sessions: WorkoutSessionDoc[], currentWeeks: Record<string, number>,
): ProgramRow[] {
  return programs.map((p) => {
    const own = workouts.filter((w) => w.programId === p.id);
    const logged = sessions.filter((s) => s.programId === p.id);
    const days = [...new Set(own.map((w) => w.dayOfWeek))].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    return {
      id: p.id,
      name: p.name,
      archived: p.archived === true,
      totalWeeks: p.totalWeeks,
      currentWeek: currentWeeks[p.id] || 1,
      days,
      exercises: new Set(own.flatMap((w) => w.exercises.map((e) => e.definitionId))).size,
      sessions: logged.length,
      lastTrained: latest(logged.map((s) => sessionDate(s.date))),
    };
  }).sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
}

export function exerciseRows(
  definitions: Record<string, ExerciseDefinition>, programs: Program[], sessions: WorkoutSessionDoc[],
): ExerciseRow[] {
  const active = programs.filter((p) => !p.archived);
  return Object.values(definitions).map((d) => {
    // Sets logged before the exercise library carry no definitionId; those match by name.
    const done = sessions.filter((s) => (s.sets ?? []).some((set) => (set.definitionId ? set.definitionId === d.id : set.exerciseName === d.name)));
    return {
      id: d.id,
      name: d.name,
      equipmentType: d.equipmentType,
      equipmentDetail: d.equipmentDetail,
      muscles: d.muscleGroups,
      progressionRule: d.progressionRule,
      programs: active.filter((p) => p.weights?.[d.id]).map((p) => p.name),
      sessions: done.length,
      lastDone: latest(done.map((s) => sessionDate(s.date))),
    };
  }).sort((a, b) => (b.lastDone?.getTime() ?? -1) - (a.lastDone?.getTime() ?? -1) || a.name.localeCompare(b.name));
}
