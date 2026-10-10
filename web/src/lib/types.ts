import { Timestamp } from "firebase/firestore";

// ── Enums as string unions ──

export type Phase = "warmup" | "main" | "finisher" | "cooldown" | "mobility";

export type EquipmentType =
  | "barbell_45"
  | "barbell_35"
  | "barbell_ez"
  | "powerblock"
  | "dumbbell"
  | "band"
  | "kettlebell"
  | "bodyweight"
  | "assisted_pullup"
  | "gripper"
  | "pulley"
  | "loop_band";

// Known keyword rules plus any free-form next-step string (band color, band count, etc.)
export type ProgressionRule =
  | "add_5lb"
  | "add_2.5lb"
  | "add_10lb"
  | "add_reps"
  | "add_time"
  | "add_rounds"
  | "maintain"
  | "deload"
  | "progress_gripper"
  | "none"
  | string; // free-form: band color (e.g. "Blue"), band count (e.g. "2 bands")

// ── Structured types (Firestore-compatible) ──

export type RepTarget =
  | { type: "count"; value: number }
  | { type: "failure" };

// Numeric-increment progression rules the auto-progression engine understands.
// Rules not listed here (band colors, add_reps, maintain, etc.) don't drive currentWeight automatically.
export const WEIGHT_INCREMENTS: Partial<Record<ProgressionRule, number>> = {
  "add_5lb": 5,
  "add_2.5lb": 2.5,
  "add_10lb": 10,
};

// ── Core models ──

// The canonical, global-per-user definition of an exercise: what it is, not when you're doing it.
// Referenced by Exercise occurrences across every program so metadata and working weight
// never need to be re-entered, and stay in sync everywhere the exercise appears.
export interface ExerciseDefinition {
  id: string;
  name: string;
  muscleGroups: string[];
  equipmentType: EquipmentType;
  equipmentDetail: string | null;
  progressionRule: ProgressionRule;
  isUnilateral: boolean;
  isTimeBased: boolean;
  currentWeight: number;
  hardStreak: number;          // consecutive sessions whose final set was rated "hard"; resets on any other outcome
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// A single occurrence of an exercise within one workout day — scheduling only.
// Everything about what the exercise IS lives on the referenced ExerciseDefinition.
export interface Exercise {
  id: string;
  definitionId: string;
  order: number;
  phase: Phase;
  sets: number;
  repMin: number;
  repMax: RepTarget;
  restSeconds: number;
  notes: string | null;
  lastSetAmrap?: boolean;        // when true, the final set is AMRAP regardless of repMax
  restAfter?: false | number;    // rest before the NEXT exercise only: false = skip it, number = override its duration. Never affects rest between this exercise's own sets — that always uses restSeconds.
  weight?: number;               // this row's own planned weight from the spreadsheet; only a warm-up row uses it — working rows follow the program weight
  equipmentDetail?: string | null; // this row's own band colour/size etc.; wins over the definition's
}

// An Exercise occurrence merged with its definition — the shape the workout UI actually works with.
export type ResolvedExercise = Exercise & Omit<ExerciseDefinition, "id" | "createdAt" | "updatedAt"> & {
  definitionId: string;
};

export function resolveExercise(
  exercise: Exercise,
  definitions: Record<string, ExerciseDefinition>
): ResolvedExercise {
  const def = definitions[exercise.definitionId];
  if (!def) {
    throw new Error(`Exercise definition ${exercise.definitionId} not found for exercise ${exercise.id}`);
  }
  const { id: _defId, createdAt: _createdAt, updatedAt: _updatedAt, ...defRest } = def;
  return {
    ...exercise,
    ...defRest,
    // The spreadsheet only seeds a lift's starting weight; after that the app owns it, so a
    // working row never takes its own sheet weight. A warm-up row keeps its own (lighter)
    // weight, which warmup-ramp.ts replaces or caps. A band/size can still differ per row.
    ...(exercise.weight !== undefined && exercise.phase === "warmup" ? { currentWeight: exercise.weight } : {}),
    ...(exercise.equipmentDetail !== undefined ? { equipmentDetail: exercise.equipmentDetail } : {}),
  };
}

export interface Workout {
  id: string;
  programId: string; // stable foreign key — query/filter by this, not programName
  programName: string; // denormalized display copy, kept in sync on program rename
  week: number;
  dayOfWeek: string;
  exercises: Exercise[];
  isChecklist?: boolean;
}

// A Workout with every exercise occurrence merged with its definition — the shape
// the workout UI, active session, and week-export text actually work with.
export type ResolvedWorkout = Omit<Workout, "exercises"> & { exercises: ResolvedExercise[] };

export function resolveWorkout(
  workout: Workout,
  definitions: Record<string, ExerciseDefinition>
): ResolvedWorkout {
  return { ...workout, exercises: workout.exercises.map((e) => resolveExercise(e, definitions)) };
}

// Working weight and hard-streak for one exercise within one program. The same exercise
// can sit at a different weight in each program, so progress is tracked per program.
export interface ProgramExerciseWeight {
  currentWeight: number;
  hardStreak: number;
}

export interface Program {
  id: string;
  name: string;
  totalWeeks: number;
  createdAt: Timestamp | Date;
  archived?: boolean;
  weights?: Record<string, ProgramExerciseWeight>; // keyed by exercise definition id
}

// The exercise library with this program's weights laid over it. Exercises the program has
// no weight for (e.g. programs from before per-program weights) keep the library's value.
export function scopeDefinitions(
  definitions: Record<string, ExerciseDefinition>,
  program: Pick<Program, "weights"> | undefined,
): Record<string, ExerciseDefinition> {
  if (!program?.weights) return definitions;
  const scoped: Record<string, ExerciseDefinition> = { ...definitions };
  for (const [definitionId, w] of Object.entries(program.weights)) {
    if (scoped[definitionId]) scoped[definitionId] = { ...scoped[definitionId], ...w };
  }
  return scoped;
}

export interface UserSettings {
  defaultRestSeconds: number;
  soundEnabled: boolean;
  currentWeeks: Record<string, number>; // programId -> currentWeek
  migratedProgramIds?: boolean; // one-time backfill of programId onto legacy Workout/WorkoutSessionDoc docs
  exerciseLibraryMigrated?: boolean; // set by scripts/migrate-exercise-library.ts (manual, not run automatically by the app)
}

// ── Equipment config ──

export type BandColor = "Orange" | "Purple" | "Red" | "Blue" | "Green" | "Black";
export const ALL_BAND_COLORS: BandColor[] = ["Orange", "Purple", "Red", "Blue", "Green", "Black"];

export type LoopBandSize = "Ultra-light" | "Light" | "Medium" | "Heavy" | "X-heavy" | "XX-heavy";
export const ALL_LOOP_BAND_SIZES: LoopBandSize[] = ["Ultra-light", "Light", "Medium", "Heavy", "X-heavy", "XX-heavy"];

export type CoCLevel = "T" | "0.5" | "1" | "1.5" | "2" | "2.5" | "3" | "3.5" | "4";
export const ALL_COC_LEVELS: CoCLevel[] = ["T", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4"];

export interface UserEquipmentConfig {
  barbells: {
    has45lb: boolean;
    has35lb: boolean;
    hasEZBar: boolean;
  };
  // totalOwned = total physical plates you own across both sides.
  // Calculator derives per-side limit: barbell → floor(totalOwned/2), landmine → totalOwned.
  plates: { weight: number; totalOwned: number }[]; // ordered largest → smallest
  powerBlock: {
    owned: boolean;
    minLbs: number;
    maxLbs: number;
  };
  fixedDumbbells: number[];
  kettlebells: number[];        // sorted ascending
  bands: BandColor[];           // owned Serious Steel bands
  loopBands: LoopBandSize[];    // owned loop bands
  assistedPullupBands: number;  // max bands available for pullup assist
  grippers: CoCLevel[];         // owned Captains of Crush levels
}

// ── Session / history ──

export interface CompletedSet {
  id: string;
  exerciseName: string;
  definitionId?: string;         // optional: legacy sets logged before the exercise library existed
  exerciseOrder: number;
  setNumber: number;
  targetWeight: number;
  actualWeight: number;
  targetReps: number;
  actualReps: number;
  completed: boolean;
  timestamp: Timestamp | Date;
  notes: string | null;
  rating?: "easy" | "normal" | "hard";
  isTimeBased?: boolean;
  equipmentType?: EquipmentType;
  equipmentDetail?: string | null; // band colour/size etc., so band sets don't read as bodyweight
  skipped?: boolean;               // the Skip button, as opposed to a set attempted and failed
  phase?: Phase;                   // lets History split a lift's warmup from its working sets; absent on older sessions
}

// One exercise's weight change caused by saving a session, kept so deleting the session
// can undo it. `before` is the program's weight when the session started.
export interface ProgressionChange {
  definitionId: string;
  before: ProgramExerciseWeight;
  after: ProgramExerciseWeight;
}

export interface WorkoutSessionDoc {
  id: string;
  programId: string; // stable foreign key — query/filter by this, not programName
  programName: string; // denormalized display copy, kept in sync on program rename
  week: number;
  dayOfWeek: string;
  date: Timestamp | Date;
  completed: boolean;
  durationSeconds: number;
  sets: CompletedSet[];
  progressionChanges?: ProgressionChange[];
  // Explicit "I didn't train this day" marker — distinguishes a deliberate skip
  // (no sets, completed: false) from silence in history or a partially-finished
  // session. Never true alongside completed: true.
  skipped?: boolean;
}

export interface BodyMeasurementInput {
  date: Date;
  // Absent on a baseline imported from a program spreadsheet (tape measurements only).
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  arm?: number;
  thigh?: number;
  rightBicep?: number;
  leftBicep?: number;
  rightThigh?: number;
  leftThigh?: number;
  rightCalf?: number;
  leftCalf?: number;
  bodyFatPercentage?: number;
  bmi?: number;
  heartRate?: number;
  muscleMass?: number;
  boneMass?: number;
  bodyWaterPercentage?: number;
  visceralFat?: number;
  proteinMass?: number;
  bmr?: number;
  metabolicAge?: number;
  standardWeight?: number;
  fatFreeBodyWeight?: number;
  proteinPercentage?: number;
  subcutaneousFatPercentage?: number;
  skeletalMusclePercentage?: number;
  waterWeight?: number;
}

export interface BodyMeasurementDoc extends Omit<BodyMeasurementInput, "date"> {
  id: string;
  date: Timestamp | Date;
}

export interface PersonalRecordDoc {
  exerciseName: string;
  recordType: "weight" | "estimated1RM" | "volume";
  value: number;
  date: Timestamp | Date;
}

// ── Equipment display ──

export interface PlateConfiguration {
  targetWeight: number;
  barWeight: number;
  achievedWeight: number;
  perSide: { plate: number; count: number }[];
  isLandmine?: boolean;
}

export interface PowerBlockInstructions {
  selector: number;
  rods: "none" | "one" | "both";
  label: string; // e.g. "Selector to 25 · no rods"
}

export type EquipmentDisplay =
  | { type: "barbell"; config: PlateConfiguration }
  | { type: "powerblock"; weight: number; instructions: PowerBlockInstructions }
  | { type: "dumbbell"; weight: number }
  | { type: "band"; name: string; range: string }
  | { type: "bodyweight"; detail: string | null }
  | { type: "assisted"; weight: number; detail: string | null }
  | { type: "kettlebell"; weight: number }
  | { type: "gripper"; weight: number }
  | { type: "pulley"; config: PlateConfiguration }
  | { type: "loop_band"; size: LoopBandSize };

// ── Active workout state ──

export interface ActiveSession {
  workout: ResolvedWorkout;
  resolvedWeights: Record<string, number>; // exerciseId -> weight
  previousPerformances?: Record<string, PreviousExercisePerformance>; // optional for sessions persisted before v1.10
  currentExerciseIndex: number;
  currentSetNumber: number;
  completedSets: CompletedSet[];
  isResting: boolean;
  restTimeRemaining: number;
  startTime: Date;
  prsAchieved: PRResult[];
  // Set once the user ends the workout (mid-session or after the last set) so the summary
  // shows even when no PR was achieved. In-memory only: never persisted.
  ended?: boolean;
}

export interface PreviousExercisePerformance {
  weight: number;
  reps: number;
}

export interface PRResult {
  exerciseName: string;
  type: "weight" | "estimated1RM" | "volume";
  value: number;
  previousBest: number | null;
}

// ── Helpers ──

export const PHASE_ORDER: Phase[] = ["warmup", "main", "finisher", "cooldown", "mobility"];

export const PHASE_COLORS: Record<Phase, string> = {
  warmup: "bg-orange-500",
  main: "bg-blue-500",
  finisher: "bg-purple-500",
  cooldown: "bg-teal-500",
  mobility: "bg-green-500",
};

export const DAY_ORDER = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Daily",
];

export function barWeight(type: EquipmentType): number | null {
  switch (type) {
    case "barbell_45": return 45;
    case "barbell_35": return 35;
    case "barbell_ez": return 15;
    default: return null;
  }
}

export function isChecklistWorkout(workout: Workout): boolean {
  // Explicit flag takes priority (set via editor or CSV import)
  if (workout.isChecklist !== undefined) return workout.isChecklist;
  // Fallback heuristic for legacy workouts without the flag. Progression rule now lives on the
  // exercise definition, not the occurrence, so this only checks what's still available here.
  return workout.exercises.every((ex) => ex.restSeconds === 0);
}

export function isTimeBased(exercise: ResolvedExercise): boolean {
  return exercise.isTimeBased;
}

export function formatTimeValue(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  if (seconds >= 60) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

export function repTargetDisplay(repMin: number, repMax: RepTarget, exercise?: ResolvedExercise, setNumber?: number): string {
  if (repMax.type === "failure") return "AMRAP";
  // lastSetAmrap: only the final set is AMRAP; earlier sets show normal rep range
  if (exercise?.lastSetAmrap && setNumber !== undefined && setNumber === exercise.sets) return "AMRAP";
  if (exercise && isTimeBased(exercise)) {
    if (repMax.type === "count" && repMin === repMax.value) return formatTimeValue(repMin);
    if (repMax.type === "count") return `${formatTimeValue(repMin)}-${formatTimeValue(repMax.value)}`;
  }
  if (repMin === repMax.value) return `${repMin} reps`;
  return `${repMin}–${repMax.value} reps`;
}

// Shown where all sets display the normal rep range, so the AMRAP final set isn't a surprise.
// Null when every set is already AMRAP (the rep target itself says so) or none are.
export function finalSetAmrapNote(exercise: Pick<Exercise, "lastSetAmrap" | "repMax">): string | null {
  if (!exercise.lastSetAmrap || exercise.repMax.type === "failure") return null;
  return "Final set AMRAP";
}

export function cleanWeight(w: number): string {
  if (w === Math.round(w)) return w.toString();
  return parseFloat(w.toFixed(2)).toString();
}

export function formatRestTime(seconds: number): string {
  if (seconds >= 60) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return sec === 0 ? `${min}m` : `${min}:${sec.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

export function exerciseWeightDisplay(exercise: ResolvedExercise): string {
  if (exercise.currentWeight > 0) return `${cleanWeight(exercise.currentWeight)} lbs`;
  if (exercise.equipmentType === "bodyweight") return "BW";
  return exercise.equipmentDetail || exercise.equipmentType.replace(/_/g, " ");
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rem = min % 60;
  return `${hours}h ${rem}m`;
}

// Sets from the Skip button. Older sessions predate the flag and only carry the "Skipped" note.
export function isSkippedSet(set: CompletedSet): boolean {
  return set.skipped === true || (!set.completed && set.actualReps === 0 && set.notes === "Skipped");
}

// What was on the bar / in hand for one logged set, for summaries and history.
export function setLoadLabel(set: CompletedSet): string {
  if (set.equipmentType === "assisted_pullup" && set.actualWeight > 0) {
    return `${cleanWeight(set.actualWeight)} ${set.actualWeight === 1 ? "band" : "bands"}`;
  }
  if (set.actualWeight > 0) return `${cleanWeight(set.actualWeight)} lb`;
  if (set.equipmentType === "band" || set.equipmentType === "loop_band") {
    return set.equipmentDetail ? `${set.equipmentDetail} band` : "Band";
  }
  return "BW";
}
