import type { Exercise, Workout, Phase, EquipmentType, ProgressionRule, RepTarget, ProgramExerciseWeight } from "./types";
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
  seedWeight?: number;   // the program's starting weight for this exercise (also seeds a brand-new definition)
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

// Which spreadsheet row's Total Weight seeds each exercise's weight for the program. The
// earliest week wins, and within it a working row beats a warm-up row (a lighter warm-up
// of the same lift must not set the working weight). Keyed by trimmed lowercase name.
export function pickSeedWeights(parsedWorkouts: ParsedWorkout[]): Map<string, number> {
  const best = new Map<string, { rank: [number, number, number]; weight: number }>();
  let seen = 0;
  for (const pw of parsedWorkouts) {
    for (const pe of pw.exercises) {
      seen++;
      if (pe.seedWeight === undefined) continue;
      const key = pe.name.trim().toLowerCase();
      const rank: [number, number, number] = [pw.week, pe.phase === "warmup" ? 1 : 0, seen];
      const current = best.get(key);
      const better = !current || rank[0] < current.rank[0] ||
        (rank[0] === current.rank[0] && (rank[1] < current.rank[1] ||
          (rank[1] === current.rank[1] && rank[2] < current.rank[2])));
      if (better) best.set(key, { rank, weight: pe.seedWeight });
    }
  }
  return new Map([...best].map(([key, v]) => [key, v.weight]));
}

// Matches each row's exercise name (case-insensitive/trimmed, no stored normalized
// field) against the user's existing global exercise library. Existing match: only
// metadata (equipment/progression rule/etc.) is refreshed; the library's weight is left
// alone. No match: a new definition is created, seeded from this row's weight if present.
// Weights that matter for training live on the program: the returned `weights` map
// (definition id → starting weight) is what the caller stores on the program, and the
// spreadsheet's Total Weight always wins there.
export async function resolveExerciseDefinitions(
  userId: string,
  parsedWorkouts: ParsedWorkout[]
): Promise<{ workouts: Workout[]; weights: Record<string, ProgramExerciseWeight> }> {
  const existingDefs = await getExerciseDefinitions(userId);
  const byName = new Map(existingDefs.map((d) => [d.name.trim().toLowerCase(), d]));
  const resolvedIdByName = new Map<string, string>();
  const seedByName = pickSeedWeights(parsedWorkouts);

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

  const weights: Record<string, ProgramExerciseWeight> = {};
  for (const [key, definitionId] of resolvedIdByName) {
    const seed = seedByName.get(key);
    if (seed !== undefined) weights[definitionId] = { currentWeight: seed, hardStreak: 0 };
  }

  return { workouts, weights };
}
