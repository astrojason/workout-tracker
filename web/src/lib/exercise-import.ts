import type { Exercise, Workout, Phase, EquipmentType, ProgressionRule, RepTarget, ProgramExerciseWeight, ExerciseDefinition } from "./types";
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
  muscleGroups?: string[];   // biggest first; absent = keep the library's (or the built-in estimate)
  bodyweightPct?: number;    // share of bodyweight one rep moves; absent = keep the library's
  skipWarmup?: boolean;      // Warm-up column "none": no warm-up for this occurrence
  warmupWith?: string;       // Warm-up column naming an exercise: warm up with it on this day
}

/** One exercise from the spreadsheet that has no same-named exercise in the library. */
export interface ExerciseMatchRequest {
  exercise: ParsedExercise;
  index: number;   // 1-based position among the unmatched exercises
  total: number;
  candidates: ExerciseDefinition[]; // the whole library, for the user to pick from
}

export type ExerciseMatchDecision =
  | { action: "create" }
  | { action: "use"; definitionId: string }
  | { action: "cancel" };

export class ImportCancelledError extends Error {
  constructor() {
    super("Import cancelled — nothing was changed.");
    this.name = "ImportCancelledError";
  }
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

// Which spreadsheet row's Total Weight seeds each exercise's weight for the program. A
// working row beats a warm-up row in ANY week (a lighter warm-up of the same lift must not
// set the working weight, even if the working row's weight only appears in a later week);
// within the same kind of row, the earliest week wins. Keyed by trimmed lowercase name.
export function pickSeedWeights(parsedWorkouts: ParsedWorkout[]): Map<string, number> {
  const best = new Map<string, { rank: [number, number, number]; weight: number }>();
  let seen = 0;
  for (const pw of parsedWorkouts) {
    for (const pe of pw.exercises) {
      seen++;
      if (pe.seedWeight === undefined) continue;
      const key = pe.name.trim().toLowerCase();
      const rank: [number, number, number] = [pe.phase === "warmup" ? 1 : 0, pw.week, seen];
      const current = best.get(key);
      const better = !current || rank[0] < current.rank[0] ||
        (rank[0] === current.rank[0] && (rank[1] < current.rank[1] ||
          (rank[1] === current.rank[1] && rank[2] < current.rank[2])));
      if (better) best.set(key, { rank, weight: pe.seedWeight });
    }
  }
  return new Map([...best].map(([key, v]) => [key, v.weight]));
}

// Which row supplies each exercise definition's metadata (progression rule, equipment).
// The definition is shared by every row of that exercise, so it must come from the working
// row: a warm-up row (progression "none") listed first would otherwise stop the lift from
// ever progressing. The first working row wins; a warm-up-only exercise uses its warm-up.
export function pickDefinitionSources(parsedWorkouts: ParsedWorkout[]): Map<string, ParsedExercise> {
  const sources = new Map<string, ParsedExercise>();
  for (const pw of parsedWorkouts) {
    for (const pe of pw.exercises) {
      const key = pe.name.trim().toLowerCase();
      const current = sources.get(key);
      if (!current || (current.phase === "warmup" && pe.phase !== "warmup")) sources.set(key, pe);
    }
  }
  return sources;
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
  parsedWorkouts: ParsedWorkout[],
  options: { onUnmatched?: (request: ExerciseMatchRequest) => Promise<ExerciseMatchDecision> } = {},
): Promise<{ workouts: Workout[]; weights: Record<string, ProgramExerciseWeight> }> {
  const existingDefs = await getExerciseDefinitions(userId);
  const byName = new Map(existingDefs.map((d) => [d.name.trim().toLowerCase(), d]));
  const resolvedIdByName = new Map<string, string>();
  const seedByName = pickSeedWeights(parsedWorkouts);
  const sourceByName = pickDefinitionSources(parsedWorkouts);

  // Ask about every unmatched exercise, one at a time, BEFORE writing anything, so
  // cancelling part-way leaves the library untouched.
  if (options.onUnmatched) {
    const unmatched = [...sourceByName].filter(([key]) => !byName.has(key));
    for (let i = 0; i < unmatched.length; i++) {
      const [key, exercise] = unmatched[i];
      const decision = await options.onUnmatched({
        exercise, index: i + 1, total: unmatched.length, candidates: existingDefs,
      });
      if (decision.action === "cancel") throw new ImportCancelledError();
      if (decision.action === "use") {
        if (!existingDefs.some((d) => d.id === decision.definitionId)) {
          throw new Error(`Exercise "${exercise.name}" was linked to "${decision.definitionId}", which is not in your exercise library.`);
        }
        // Pre-resolved: the main loop skips it, so the library exercise is kept as-is (not renamed).
        resolvedIdByName.set(key, decision.definitionId);
      }
    }
  }

  // Warm-up movements named in the Warm-up column, resolved once every row's exercise is: the
  // file's own exercise, else the library's, else a new bodyweight exercise (e.g. a stretch).
  const pendingWarmups: { occurrence: Exercise; name: string }[] = [];

  const workouts: Workout[] = [];
  for (const pw of parsedWorkouts) {
    const exercises: Exercise[] = [];
    for (const pe of pw.exercises) {
      const key = pe.name.trim().toLowerCase();
      let definitionId = resolvedIdByName.get(key);

      if (!definitionId) {
        const meta = sourceByName.get(key) ?? pe;
        const match = byName.get(key);
        if (match) {
          await updateExerciseDefinitionMeta(userId, match.id, {
            name: meta.name,
            equipmentType: meta.equipmentType,
            equipmentDetail: meta.equipmentDetail,
            progressionRule: meta.progressionRule,
            isUnilateral: meta.isUnilateral,
            isTimeBased: meta.isTimeBased,
            ...(meta.muscleGroups ? { muscleGroups: meta.muscleGroups } : {}),
            ...(meta.bodyweightPct !== undefined ? { bodyweightPct: meta.bodyweightPct } : {}),
          });
          definitionId = match.id;
        } else {
          definitionId = await createExerciseDefinition(userId, {
            name: meta.name,
            muscleGroups: meta.muscleGroups ?? [],
            ...(meta.bodyweightPct !== undefined ? { bodyweightPct: meta.bodyweightPct } : {}),
            equipmentType: meta.equipmentType,
            equipmentDetail: meta.equipmentDetail,
            progressionRule: meta.progressionRule,
            isUnilateral: meta.isUnilateral,
            isTimeBased: meta.isTimeBased,
            currentWeight: pe.seedWeight ?? 0,
            hardStreak: 0,
          });
        }
        resolvedIdByName.set(key, definitionId);
      }

      const occurrence: Exercise = {
        id: crypto.randomUUID(),
        definitionId,
        order: pe.order,
        phase: pe.phase,
        sets: pe.sets,
        repMin: pe.repMin,
        repMax: pe.repMax,
        restSeconds: pe.restSeconds,
        notes: pe.notes,
        ...(pe.seedWeight !== undefined ? { weight: pe.seedWeight } : {}),
        ...(pe.equipmentDetail !== null ? { equipmentDetail: pe.equipmentDetail } : {}),
        ...(pe.lastSetAmrap ? { lastSetAmrap: true } : {}),
        ...(pe.restAfter !== undefined ? { restAfter: pe.restAfter } : {}),
        ...(pe.skipWarmup && pe.phase !== "warmup" ? { skipWarmup: true } : {}),
      };
      if (pe.warmupWith && pe.phase !== "warmup" && !pe.skipWarmup) pendingWarmups.push({ occurrence, name: pe.warmupWith });
      exercises.push(occurrence);
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

  for (const { occurrence, name } of pendingWarmups) {
    const key = name.trim().toLowerCase();
    let id = resolvedIdByName.get(key) ?? byName.get(key)?.id;
    if (!id) {
      id = await createExerciseDefinition(userId, {
        name: name.trim(), muscleGroups: [], equipmentType: "bodyweight", equipmentDetail: null,
        progressionRule: "none", isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0,
      });
      resolvedIdByName.set(key, id);
    }
    if (id !== occurrence.definitionId) occurrence.warmupWith = id;
  }

  const weights: Record<string, ProgramExerciseWeight> = {};
  for (const [key, definitionId] of resolvedIdByName) {
    const seed = seedByName.get(key);
    if (seed !== undefined) weights[definitionId] = { currentWeight: seed, hardStreak: 0 };
  }

  return { workouts, weights };
}
