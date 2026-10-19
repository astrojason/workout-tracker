import type { EquipmentType, ProgressionRule, WorkoutSessionDoc } from "./types";

// ── What the AI sends back ──

export interface EquipmentAnalysis {
  name: string;
  equipmentType: EquipmentType;
  equipmentDetail: string | null;
  muscleGroups: string[];
  isUnilateral: boolean;
  isTimeBased: boolean;
  suggestedWeight: number | null; // lbs; null when the history gives no basis for a guess
  progressionRule?: ProgressionRule;
  weightOptions?: number[] | null; // machines only: the weights it can be set to, ascending
  reasoning: string;
}

// ── What we tell the AI about the user ──

// What the lifter already typed about the exercise. The model falls back on it when the photo
// is unclear, so a blurry shot of a "Pulldown" by "Lifecycle" still resolves to the right machine.
export interface EquipmentHint {
  name: string;
  brand: string | null;
}

export interface HistoryEntry {
  exerciseName: string;
  weight: number;
  reps: number;
  date: string; // YYYY-MM-DD
}

const EQUIPMENT_TYPES: EquipmentType[] = [
  "barbell_45", "barbell_35", "barbell_ez", "powerblock", "dumbbell", "band", "kettlebell",
  "bodyweight", "assisted_pullup", "gripper", "pulley", "loop_band", "machine",
];

// Rules the model may choose; anything else becomes "none". add_weight = move up one stack/bell step.
const PROGRESSION_RULES: ProgressionRule[] = [
  "add_5lb", "add_2.5lb", "add_10lb", "add_weight", "add_reps", "add_time", "maintain", "none",
];

const MAX_WEIGHT_OPTIONS = 60;

const MAX_HISTORY_ENTRIES = 40;
const MAX_WEIGHT = 2000;

function sessionDate(session: WorkoutSessionDoc): Date {
  return session.date instanceof Date ? session.date : session.date.toDate();
}

// The heaviest working set from each exercise's most recent session, newest exercises first.
// This is the evidence the model uses to pitch a working weight for the new equipment.
export function summarizeHistory(sessions: WorkoutSessionDoc[]): HistoryEntry[] {
  const newestFirst = [...sessions].sort((a, b) => sessionDate(b).getTime() - sessionDate(a).getTime());
  const seen = new Map<string, HistoryEntry>();
  for (const session of newestFirst) {
    const date = sessionDate(session).toISOString().slice(0, 10);
    const best = new Map<string, HistoryEntry>();
    for (const s of session.sets || []) {
      if (!s.completed || s.skipped || s.phase === "warmup" || s.isTimeBased || s.actualWeight <= 0) continue;
      if (seen.has(s.exerciseName)) continue;
      const cur = best.get(s.exerciseName);
      if (!cur || s.actualWeight > cur.weight || (s.actualWeight === cur.weight && s.actualReps > cur.reps)) {
        best.set(s.exerciseName, { exerciseName: s.exerciseName, weight: s.actualWeight, reps: s.actualReps, date });
      }
    }
    for (const [name, entry] of best) seen.set(name, entry);
    if (seen.size >= MAX_HISTORY_ENTRIES) break;
  }
  return [...seen.values()].slice(0, MAX_HISTORY_ENTRIES);
}

export const EQUIPMENT_SYSTEM_PROMPT =
  "You are a strength coach looking at a photo of a piece of gym equipment or a machine (or, with no photo, at the lifter's written description of it). " +
  "Identify the most likely exercise it is used for and classify the equipment. " +
  "Then suggest a conservative working weight in lbs for a set of 8-12 reps, using ONLY the lifter's own " +
  "history provided: compare to the closest exercises (same muscle group, movement or equipment) and scale " +
  "sensibly. If the history gives no reasonable basis, or the equipment has no weight (bodyweight, time-based), " +
  "set suggestedWeight to null. Explain the basis in one short sentence naming the history you used. " +
  "equipmentType must be one of: " + EQUIPMENT_TYPES.join(", ") + " (use 'bodyweight' when no external load applies). " +
  "Selectorized machines and cable weight stacks can only be set to specific weights, so classify them as " +
  "'machine' ('pulley' is only the plate-loaded Spud system). For a machine set weightOptions to the full " +
  "ascending list of weights it can be set to (the gaps are often uneven, e.g. 15, 25, 40; use null if you " +
  "cannot tell), make suggestedWeight one of those options, and set progressionRule to 'add_weight' (move " +
  "to the next option after reaching the top of the rep range). For free weights pick the matching add_5lb / add_2.5lb / " +
  "add_10lb; use add_time for timed holds and add_reps for bodyweight. " +
  "If the lifter also supplies the exercise name and/or brand, treat them as reliable: use them when the " +
  "photo is unclear or unreadable, and prefer them over a guess from the image. " +
  "Respond only by calling the submit_equipment function.";

export const EQUIPMENT_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_equipment",
    description: "Submit the identified exercise and a suggested working weight.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Common exercise name, e.g. 'Seated Cable Row'" },
        equipmentType: { type: "string", enum: EQUIPMENT_TYPES },
        equipmentDetail: { type: ["string", "null"], description: "Band colour/size if a band, else null" },
        muscleGroups: { type: "array", items: { type: "string" } },
        isUnilateral: { type: "boolean", description: "True if each side is trained separately" },
        isTimeBased: { type: "boolean" },
        suggestedWeight: { type: ["number", "null"], description: "Working weight in lbs, or null; one of weightOptions for machines" },
        weightOptions: { type: ["array", "null"], items: { type: "number" }, description: "Machines only: every weight in lbs the machine can be set to, ascending; else null" },
        progressionRule: { type: "string", enum: PROGRESSION_RULES, description: "How the weight should progress" },
        reasoning: { type: "string" },
      },
      required: ["name", "equipmentType", "equipmentDetail", "muscleGroups", "isUnilateral", "isTimeBased", "suggestedWeight", "weightOptions", "progressionRule", "reasoning"],
    },
  },
};

// With hasPhoto=false the name/brand is the only evidence, so the model works from it alone.
export function buildEquipmentPrompt(history: HistoryEntry[], hint?: EquipmentHint | null, hasPhoto = true): string {
  const description = hint?.name.trim()
    ? `Exercise: ${hint.name.trim()}` + (hint.brand?.trim() ? `, Brand: ${hint.brand.trim()}` : "")
    : "";
  const hintText = description
    ? hasPhoto
      ? `\n\nThe lifter describes this equipment as: ${description}. If the photo is unclear or unreadable, rely on this description.`
      : `\n\nThe lifter describes this equipment as: ${description}.`
    : "";
  const subject = hasPhoto ? "the equipment in the photo" : "the equipment from the lifter's description";
  if (history.length === 0) {
    return `Identify ${subject}. The lifter has no workout history yet, so set suggestedWeight to null.` + hintText;
  }
  return (
    `Identify ${subject} and suggest a working weight.\n\nThe lifter's recent best working sets:\n` +
    history.map((h) => `${h.exerciseName}: ${h.weight} lbs x ${h.reps} (${h.date})`).join("\n") + hintText
  );
}

// The request body is untrusted: keep only short, non-empty strings.
export function sanitizeHint(raw: unknown): EquipmentHint | null {
  const r = raw as { name?: unknown; brand?: unknown } | null;
  if (!r || typeof r !== "object" || typeof r.name !== "string" || !r.name.trim()) return null;
  const brand = typeof r.brand === "string" && r.brand.trim() ? r.brand.trim().slice(0, 80) : null;
  return { name: r.name.trim().slice(0, 80), brand };
}

// Pulls the forced tool call's JSON arguments out of an OpenAI chat completion, plus the
// total tokens it consumed (prompt + completion) for the shared token tracker.
export function parseVisionToolCall(completion: unknown): { args: unknown; tokensUsed: number } {
  const c = completion as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = c.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (typeof raw !== "string") throw new Error("Equipment response had no tool call");
  let args: unknown;
  try {
    args = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Could not parse equipment response: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { args, tokensUsed: (c.usage?.prompt_tokens ?? 0) + (c.usage?.completion_tokens ?? 0) };
}

// The model's output is untrusted: keep only well-formed, plausible values.
// Untrusted list from the model: sorted, unique, plausible weights; fewer than two means "unknown".
function cleanOptions(raw: unknown[]): number[] | null {
  const nums = raw.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_WEIGHT);
  const unique = [...new Set(nums)].sort((a, b) => a - b).slice(0, MAX_WEIGHT_OPTIONS);
  return unique.length >= 2 ? unique : null;
}

export function validateEquipmentAnalysis(raw: unknown): EquipmentAnalysis {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object" || typeof r.name !== "string" || !r.name.trim()) {
    throw new Error("Equipment scan returned a malformed response");
  }
  const equipmentType = EQUIPMENT_TYPES.includes(r.equipmentType as EquipmentType) ? (r.equipmentType as EquipmentType) : "bodyweight";
  const isMachine = equipmentType === "machine";
  const weightOptions = isMachine && Array.isArray(r.weightOptions)
    ? cleanOptions(r.weightOptions)
    : null;
  const ruleRaw = r.progressionRule as ProgressionRule;
  const progressionRule: ProgressionRule = PROGRESSION_RULES.includes(ruleRaw) ? ruleRaw : isMachine ? "add_weight" : "none";
  const weight = r.suggestedWeight;
  const validWeight = typeof weight === "number" && Number.isFinite(weight) && weight >= 0 && weight <= MAX_WEIGHT ? weight : null;
  // A machine can only be set to one of its options: snap down, or up to the lightest if below all of them.
  const suggestedWeight = validWeight !== null && weightOptions
    ? [...weightOptions].reverse().find((w) => w <= validWeight) ?? weightOptions[0]
    : validWeight;
  return {
    name: r.name.trim(),
    equipmentType,
    equipmentDetail: typeof r.equipmentDetail === "string" && r.equipmentDetail.trim() ? r.equipmentDetail.trim() : null,
    muscleGroups: Array.isArray(r.muscleGroups)
      ? r.muscleGroups.filter((m): m is string => typeof m === "string" && m.trim() !== "").map((m) => m.trim())
      : [],
    isUnilateral: r.isUnilateral === true,
    isTimeBased: r.isTimeBased === true,
    suggestedWeight,
    progressionRule,
    weightOptions,
    reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
  };
}

export interface EquipmentScanInput {
  image?: string; // data URL (JPEG); optional when a name/brand hint is given instead
  history: HistoryEntry[];
  hint?: EquipmentHint;
}
