import { Timestamp } from "firebase/firestore";

// ── Enums as string unions ──

export type Phase = "warmup" | "main" | "finisher" | "cooldown" | "mobility";

export type EquipmentType =
  | "barbell_45"
  | "barbell_35"
  | "barbell_ez"
  | "powerblock"
  | "band"
  | "kettlebell"
  | "bodyweight"
  | "assisted_pullup";

export type ProgressionRule =
  | "add_5lb"
  | "add_2.5lb"
  | "add_10lb"
  | "reduce_assistance"
  | "maintain"
  | "deload"
  | "none"
  | "add_reps"
  | "add_time"
  | "progress_gripper";

// ── Structured types (Firestore-compatible) ──

export type WeightSpec =
  | { type: "fixed"; value: number }
  | { type: "progressive" };

export type RepTarget =
  | { type: "count"; value: number }
  | { type: "failure" };

// ── Core models ──

export interface Exercise {
  id: string;
  order: number;
  name: string;
  phase: Phase;
  equipmentType: EquipmentType;
  equipmentDetail: string | null;
  baseWeight: WeightSpec;
  sets: number;
  repMin: number;
  repMax: RepTarget;
  restSeconds: number;
  progressionRule: ProgressionRule;
  isUnilateral: boolean;
  notes: string | null;
}

export interface Workout {
  id: string;
  programName: string;
  week: number;
  dayOfWeek: string;
  exercises: Exercise[];
  isChecklist?: boolean;
}

export interface Program {
  id: string;
  name: string;
  totalWeeks: number;
  createdAt: Timestamp | Date;
}

export interface UserSettings {
  defaultRestSeconds: number;
  soundEnabled: boolean;
  currentWeeks: Record<string, number>; // programName -> currentWeek
}

// ── Session / history ──

export interface CompletedSet {
  id: string;
  exerciseName: string;
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
}

export interface WorkoutSessionDoc {
  id: string;
  programName: string;
  week: number;
  dayOfWeek: string;
  date: Timestamp | Date;
  completed: boolean;
  durationSeconds: number;
  sets: CompletedSet[];
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
}

export type EquipmentDisplay =
  | { type: "barbell"; config: PlateConfiguration }
  | { type: "powerblock"; weight: number }
  | { type: "dumbbell"; weight: number }
  | { type: "band"; name: string; range: string }
  | { type: "bodyweight"; detail: string | null }
  | { type: "assisted"; weight: number; detail: string | null }
  | { type: "kettlebell"; weight: number };

// ── Active workout state ──

export interface ActiveSession {
  workout: Workout;
  resolvedWeights: Record<string, number>; // exerciseId -> weight
  currentExerciseIndex: number;
  currentSetNumber: number;
  completedSets: CompletedSet[];
  isResting: boolean;
  restTimeRemaining: number;
  startTime: Date;
  prsAchieved: PRResult[];
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

const CHECKLIST_RULES: ProgressionRule[] = ["none", "maintain", "add_time", "add_reps"];

export function isChecklistWorkout(workout: Workout): boolean {
  // Explicit flag takes priority (set via editor or CSV import)
  if (workout.isChecklist !== undefined) return workout.isChecklist;
  // Fallback heuristic for legacy workouts without the flag
  return workout.exercises.every(
    (ex) => ex.restSeconds === 0 && CHECKLIST_RULES.includes(ex.progressionRule)
  );
}

export function isTimeBased(exercise: Exercise): boolean {
  if (exercise.progressionRule === "add_time") return true;
  if (exercise.phase === "mobility" && exercise.repMin >= 30) return true;
  return false;
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

export function repTargetDisplay(repMin: number, repMax: RepTarget, exercise?: Exercise): string {
  if (repMax.type === "failure") return "AMRAP";
  if (exercise && isTimeBased(exercise)) {
    if (repMax.type === "count" && repMin === repMax.value) return formatTimeValue(repMin);
    if (repMax.type === "count") return `${formatTimeValue(repMin)}-${formatTimeValue(repMax.value)}`;
  }
  if (repMin === repMax.value) return `${repMin} reps`;
  return `${repMin}-${repMax.value} reps`;
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

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rem = min % 60;
  return `${hours}h ${rem}m`;
}
