import type { ExerciseDefinition, LoopBandSize, UserEquipmentConfig } from "./types";
import { DEFAULT_EQUIPMENT_CONFIG } from "./equipment-calculator";

// What a warm-up needs to know about an exercise beyond its equipment: which muscles it works
// (biggest first) and how much of your bodyweight it moves. Both can be set on the exercise;
// otherwise they come from the built-in estimates below, matched on the exercise's name.

export const DEFAULT_BODYWEIGHT_LB = 170; // only when no weigh-in has been logged

interface Estimate {
  match: RegExp;
  muscles: string[];      // biggest first
  bodyweightPct: number;  // share of bodyweight moved per rep (0 = the body is supported)
  noSubstitute?: boolean; // a skill or power move: no lighter movement stands in for it
}

// Order matters: the first match wins, so the more specific names come first.
const ESTIMATES: Estimate[] = [
  { match: /turkish|get[- ]?up/i, muscles: ["core", "shoulders", "glutes"], bodyweightPct: 60, noSubstitute: true },
  { match: /swing|clean|snatch|jerk|burpee|carry|farmer|suitcase|sled|throw|slam/i, muscles: ["glutes", "hamstrings", "core"], bodyweightPct: 0, noSubstitute: true },
  { match: /knee push|kneeling push/i, muscles: ["chest", "triceps", "shoulders"], bodyweightPct: 49 },
  { match: /incline push|wall push|elevated push/i, muscles: ["chest", "triceps", "shoulders"], bodyweightPct: 41 },
  { match: /decline push|feet[- ]elevated push/i, muscles: ["chest", "shoulders", "triceps"], bodyweightPct: 70 },
  { match: /pike push|handstand/i, muscles: ["shoulders", "triceps"], bodyweightPct: 70 },
  { match: /push[- ]?up|press[- ]?up/i, muscles: ["chest", "triceps", "shoulders"], bodyweightPct: 64 },
  { match: /bench dip|chair dip/i, muscles: ["triceps", "chest", "shoulders"], bodyweightPct: 50 },
  { match: /\bdips?\b/i, muscles: ["chest", "triceps", "shoulders"], bodyweightPct: 90 },
  { match: /chin[- ]?up/i, muscles: ["lats", "biceps", "upper back"], bodyweightPct: 95 },
  { match: /pull[- ]?up/i, muscles: ["lats", "upper back", "biceps"], bodyweightPct: 95 },
  { match: /inverted row|ring row|australian/i, muscles: ["upper back", "lats", "biceps"], bodyweightPct: 55 },
  { match: /pull[- ]?apart|face pull|rear delt|reverse fly/i, muscles: ["upper back", "shoulders"], bodyweightPct: 0 },
  { match: /pulldown|pull[- ]down|pullover|straight[- ]arm/i, muscles: ["lats", "upper back", "biceps"], bodyweightPct: 0 },
  { match: /\brow\b|rows\b/i, muscles: ["upper back", "lats", "biceps"], bodyweightPct: 0 },
  { match: /leg press|hack squat/i, muscles: ["quads", "glutes"], bodyweightPct: 0 },
  { match: /leg extension/i, muscles: ["quads"], bodyweightPct: 0 },
  { match: /leg curl|hamstring curl|nordic/i, muscles: ["hamstrings"], bodyweightPct: 0 },
  { match: /step[- ]?up/i, muscles: ["quads", "glutes", "hamstrings"], bodyweightPct: 80 },
  { match: /pistol|bulgarian|split squat|lunge|skater/i, muscles: ["quads", "glutes", "hamstrings"], bodyweightPct: 80 },
  { match: /wall sit/i, muscles: ["quads", "glutes"], bodyweightPct: 0 },
  { match: /squat/i, muscles: ["quads", "glutes", "hamstrings", "core"], bodyweightPct: 75 },
  { match: /hip thrust|glute bridge|\bbridge\b/i, muscles: ["glutes", "hamstrings"], bodyweightPct: 30 },
  { match: /back extension|hyperextension|superman/i, muscles: ["lower back", "glutes", "hamstrings"], bodyweightPct: 50 },
  { match: /good morning|deadlift|\brdl\b|hinge/i, muscles: ["hamstrings", "glutes", "lower back"], bodyweightPct: 40 },
  { match: /seated calf/i, muscles: ["calves"], bodyweightPct: 0 },
  { match: /calf/i, muscles: ["calves"], bodyweightPct: 100 },
  { match: /abduct|clamshell|monster walk|lateral walk|fire hydrant/i, muscles: ["glutes", "hips"], bodyweightPct: 0 },
  { match: /adduct|copenhagen/i, muscles: ["adductors", "hips"], bodyweightPct: 0 },
  { match: /fly|flye|crossover|pec deck/i, muscles: ["chest", "shoulders"], bodyweightPct: 0 },
  { match: /overhead press|shoulder press|military|arnold|push press|landmine press/i, muscles: ["shoulders", "triceps", "upper back"], bodyweightPct: 0 },
  { match: /lateral raise|side raise|front raise|upright row|y[- ]raise/i, muscles: ["shoulders"], bodyweightPct: 0 },
  { match: /bench|chest press|floor press|\bpress\b/i, muscles: ["chest", "triceps", "shoulders"], bodyweightPct: 0 },
  { match: /tricep|pushdown|push[- ]down|skull|kickback|french press/i, muscles: ["triceps"], bodyweightPct: 0 },
  { match: /wrist|grip|gripper|forearm|reverse curl/i, muscles: ["forearms"], bodyweightPct: 0 },
  { match: /curl/i, muscles: ["biceps", "forearms"], bodyweightPct: 0 },
  { match: /shrug/i, muscles: ["upper back"], bodyweightPct: 0 },
  { match: /crunch|sit[- ]?up|v[- ]?up|leg raise|knee raise|toes to bar/i, muscles: ["core"], bodyweightPct: 30 },
  { match: /plank|hollow|dead bug|bird dog|pallof|rollout|ab wheel|woodchop|twist|anti[- ]rotation/i, muscles: ["core"], bodyweightPct: 0 },
];

const SYNONYMS: Record<string, string> = {
  pec: "chest", pecs: "chest", pectorals: "chest", chest: "chest",
  delt: "shoulders", delts: "shoulders", deltoids: "shoulders", shoulder: "shoulders",
  tricep: "triceps", bicep: "biceps",
  lat: "lats", latissimus: "lats",
  back: "upper back", traps: "upper back", trap: "upper back", rhomboids: "upper back", "mid back": "upper back", "upper back": "upper back",
  "lower back": "lower back", "erector": "lower back", erectors: "lower back",
  abs: "core", ab: "core", abdominals: "core", obliques: "core", core: "core",
  quad: "quads", quadriceps: "quads", hamstring: "hamstrings", hams: "hamstrings",
  glute: "glutes", gluteus: "glutes", butt: "glutes",
  calf: "calves", forearm: "forearms", grip: "forearms",
  adductor: "adductors", "inner thigh": "adductors", hip: "hips", abductors: "hips",
};

export function normalizeMuscle(m: string): string {
  const key = m.trim().toLowerCase();
  return SYNONYMS[key] ?? key;
}

export function estimateProfile(name: string): Estimate | null {
  return ESTIMATES.find((e) => e.match.test(name)) ?? null;
}

type ProfileSource = Pick<ExerciseDefinition, "name" | "muscleGroups"> & { bodyweightPct?: number | null };

// The exercise's muscles, biggest first: its own list when it has one, else the estimate.
export function musclesOf(def: ProfileSource): string[] {
  const own = (def.muscleGroups ?? []).map(normalizeMuscle).filter(Boolean);
  return own.length > 0 ? [...new Set(own)] : (estimateProfile(def.name)?.muscles ?? []);
}

export function bodyweightPctOf(def: ProfileSource): number {
  if (typeof def.bodyweightPct === "number" && Number.isFinite(def.bodyweightPct)) return Math.min(100, Math.max(0, def.bodyweightPct));
  return estimateProfile(def.name)?.bodyweightPct ?? 0;
}

export function canBeSubstituted(def: Pick<ExerciseDefinition, "name">): boolean {
  return !estimateProfile(def.name)?.noSubstitute;
}

// Serious Steel bands: the middle of each colour's range.
const BAND_LB: Record<string, number> = { Orange: 7, Purple: 20, Red: 30, Blue: 50, Green: 85, Black: 105 };
// Loop bands come with no rating, so these are rough estimates by size.
const LOOP_BAND_LB: Record<LoopBandSize, number> = { "Ultra-light": 5, Light: 10, Medium: 15, Heavy: 25, "X-heavy": 35, "XX-heavy": 50 };
const ASSIST_LB_PER_BAND = 80;

type LoadSource = ProfileSource & Pick<ExerciseDefinition, "equipmentType" | "equipmentDetail" | "currentWeight">;

// Roughly how many pounds one rep moves: the external weight plus the share of bodyweight
// moved (less any pull-up assistance). Null when the equipment's load isn't known (a band you
// don't own, an unrated loop band, a gripper), so it can't be compared.
export function estimatedLoad(def: LoadSource, bodyweight: number | null | undefined, config: UserEquipmentConfig = DEFAULT_EQUIPMENT_CONFIG): number | null {
  const body = ((bodyweight && bodyweight > 0 ? bodyweight : DEFAULT_BODYWEIGHT_LB) * bodyweightPctOf(def)) / 100;
  switch (def.equipmentType) {
    case "band": {
      const color = def.equipmentDetail ?? "";
      if (!(color in BAND_LB) || !config.bands.includes(color as never)) return null;
      return body + BAND_LB[color];
    }
    case "loop_band": {
      const size = (def.equipmentDetail || "Medium") as LoopBandSize;
      if (!(size in LOOP_BAND_LB) || !config.loopBands.includes(size)) return null;
      return body + LOOP_BAND_LB[size];
    }
    case "assisted_pullup":
      return Math.max(0, body - def.currentWeight * ASSIST_LB_PER_BAND);
    case "gripper":
      return null;
    default:
      return body + Math.max(0, def.currentWeight);
  }
}

// Short active stretches by muscle, for when no lighter movement can warm a lift up.
const STRETCHES: Record<string, string> = {
  chest: "Arm circles and band dislocates, 30s",
  shoulders: "Arm circles and band dislocates, 30s",
  triceps: "Arm circles and overhead reaches, 30s",
  biceps: "Arm swings and wrist circles, 30s",
  forearms: "Wrist circles and finger flexes, 30s",
  lats: "Arm swings and cat-cow, 30s",
  "upper back": "Thoracic rotations and cat-cow, 30s",
  "lower back": "Cat-cow and hip circles, 30s",
  core: "Cat-cow and standing side bends, 30s",
  quads: "Leg swings and walking knee hugs, 30s",
  glutes: "Hip circles and leg swings, 30s",
  hamstrings: "Leg swings and inchworms, 30s",
  calves: "Ankle circles and calf pumps, 30s",
  hips: "Hip circles and side leg swings, 30s",
  adductors: "Side leg swings and lateral lunges, 30s",
};

export function activeStretchFor(muscles: string[]): string {
  for (const m of muscles) if (STRETCHES[m]) return STRETCHES[m];
  return "Light dynamic stretching for the muscles this works, 30s";
}
