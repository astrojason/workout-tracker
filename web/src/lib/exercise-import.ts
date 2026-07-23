import type { Exercise, Workout, Phase, EquipmentType, ProgressionRule, RepTarget } from "./types";
import {
  getExerciseDefinitions, updateExerciseDefinitionMeta, createExerciseDefinition,
} from "./firestore";

// Shared intermediate shape produced by both parseXLSX and parseCSV: everything a
// workout occurrence needs, PLUS the exercise-definition metadata (name, equipment,
// progression rule, etc.) still flattened onto the row. Parsers themselves stay
// synchronous/pure; resolveExerciseDefinitions() is the async step that splits this
// into an Exercise occurrence + ExerciseDefinition, matching against the user's
// existing exercise library.
export interface ParsedExercise {
  order: number;
  name: string;
  phase: Phase;
  equipmentType: EquipmentType;
  equipmentDetail: string | null;
  seedWeight?: number;   // only used when creating a brand-new definition
  sets: number;
  repMin: number;
  repMax: RepTarget;
  restSeconds: number;
  progressionRule: ProgressionRule;
  isUnilateral: boolean;
  isTimeBased: boolean;
  notes: string | null;
  lastSetAmrap?: boolean;
  restAfter?: false | number;
}

export interface ParsedWorkout {
  id: string;
  programId: string;
  programName: string;
  week: number;
  dayOfWeek: string;
  exercises: ParsedExercise[];
  isChecklist?: boolean;
}

// Matches each row's exercise name (case-insensitive/trimmed, no stored normalized
// field) against the user's existing global exercise library. Existing match:
// metadata (equipment/progression rule/etc.) is refreshed but currentWeight/hardStreak
// are left untouched — re-importing a program must never erase progress already made
// in-app. No match: a new definition is created, seeded from this row's weight if present.
export async function resolveExerciseDefinitions(
  userId: string,
  parsedWorkouts: ParsedWorkout[]
): Promise<Workout[]> {
  const existingDefs = await getExerciseDefinitions(userId);
  const byName = new Map(existingDefs.map((d) => [d.name.trim().toLowerCase(), d]));
  const resolvedIdByName = new Map<string, string>();

  const workouts: Workout[] = [];
  for (const pw of parsedWorkouts) {
    const exercises: Exercise[] = [];
    for (const pe of pw.exercises) {
      const key = pe.name.trim().toLowerCase();
      let definitionId = resolvedIdByName.get(key);

      if (!definitionId) {
        const match = byName.get(key);
        if (match) {
          await updateExerciseDefinitionMeta(userId, match.id, {
            name: pe.name,
            equipmentType: pe.equipmentType,
            equipmentDetail: pe.equipmentDetail,
            progressionRule: pe.progressionRule,
            isUnilateral: pe.isUnilateral,
            isTimeBased: pe.isTimeBased,
          });
          definitionId = match.id;
        } else {
          definitionId = await createExerciseDefinition(userId, {
            name: pe.name,
            muscleGroups: [],
            equipmentType: pe.equipmentType,
            equipmentDetail: pe.equipmentDetail,
            progressionRule: pe.progressionRule,
            isUnilateral: pe.isUnilateral,
            isTimeBased: pe.isTimeBased,
            currentWeight: pe.seedWeight ?? 0,
            hardStreak: 0,
          });
        }
        resolvedIdByName.set(key, definitionId);
      }

      exercises.push({
        id: crypto.randomUUID(),
        definitionId,
        order: pe.order,
        phase: pe.phase,
        sets: pe.sets,
        repMin: pe.repMin,
        repMax: pe.repMax,
        restSeconds: pe.restSeconds,
        notes: pe.notes,
        ...(pe.lastSetAmrap ? { lastSetAmrap: true } : {}),
        ...(pe.restAfter !== undefined ? { restAfter: pe.restAfter } : {}),
      });
    }

    workouts.push({
      id: pw.id,
      programId: pw.programId,
      programName: pw.programName,
      week: pw.week,
      dayOfWeek: pw.dayOfWeek,
      exercises,
      ...(pw.isChecklist !== undefined ? { isChecklist: pw.isChecklist } : {}),
    });
  }

  return workouts;
}
