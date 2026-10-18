import type { EquipmentType, WorkoutSessionDoc } from "./types";

// ── What the AI sends back ──

export interface EquipmentAnalysis {
  name: string;
  equipmentType: EquipmentType;
  equipmentDetail: string | null;
  muscleGroups: string[];
  isUnilateral: boolean;
  isTimeBased: boolean;
  suggestedWeight: number | null; // lbs; null when the history gives no basis for a guess
  reasoning: string;
}

// ── What we tell the AI about the user ──

export interface HistoryEntry {
  exerciseName: string;
  weight: number;
  reps: number;
  date: string; // YYYY-MM-DD
}

const EQUIPMENT_TYPES: EquipmentType[] = [
  "barbell_45", "barbell_35", "barbell_ez", "powerblock", "dumbbell", "band", "kettlebell",
  "bodyweight", "assisted_pullup", "gripper", "pulley", "loop_band",
];

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
  "You are a strength coach looking at a photo of a piece of gym equipment or a machine. " +
  "Identify the most likely exercise it is used for and classify the equipment. " +
  "Then suggest a conservative working weight in lbs for a set of 8-12 reps, using ONLY the lifter's own " +
  "history provided: compare to the closest exercises (same muscle group, movement or equipment) and scale " +
  "sensibly. If the history gives no reasonable basis, or the equipment has no weight (bodyweight, time-based), " +
  "set suggestedWeight to null. Explain the basis in one short sentence naming the history you used. " +
  "equipmentType must be one of: " + EQUIPMENT_TYPES.join(", ") + " (use 'pulley' for cable stacks and " +
  "selectorized machines, 'bodyweight' when no external load applies). " +
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
        suggestedWeight: { type: ["number", "null"], description: "Working weight in lbs, or null" },
        reasoning: { type: "string" },
      },
      required: ["name", "equipmentType", "equipmentDetail", "muscleGroups", "isUnilateral", "isTimeBased", "suggestedWeight", "reasoning"],
    },
  },
};

export function buildEquipmentPrompt(history: HistoryEntry[]): string {
  if (history.length === 0) {
    return "Identify the equipment in the photo. The lifter has no workout history yet, so set suggestedWeight to null.";
  }
  return (
    "Identify the equipment in the photo and suggest a working weight.\n\nThe lifter's recent best working sets:\n" +
    history.map((h) => `${h.exerciseName}: ${h.weight} lbs x ${h.reps} (${h.date})`).join("\n")
  );
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
export function validateEquipmentAnalysis(raw: unknown): EquipmentAnalysis {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object" || typeof r.name !== "string" || !r.name.trim()) {
    throw new Error("Equipment scan returned a malformed response");
  }
  const weight = r.suggestedWeight;
  return {
    name: r.name.trim(),
    equipmentType: EQUIPMENT_TYPES.includes(r.equipmentType as EquipmentType) ? (r.equipmentType as EquipmentType) : "bodyweight",
    equipmentDetail: typeof r.equipmentDetail === "string" && r.equipmentDetail.trim() ? r.equipmentDetail.trim() : null,
    muscleGroups: Array.isArray(r.muscleGroups)
      ? r.muscleGroups.filter((m): m is string => typeof m === "string" && m.trim() !== "").map((m) => m.trim())
      : [],
    isUnilateral: r.isUnilateral === true,
    isTimeBased: r.isTimeBased === true,
    suggestedWeight: typeof weight === "number" && Number.isFinite(weight) && weight >= 0 && weight <= MAX_WEIGHT ? weight : null,
    reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
  };
}

export interface EquipmentScanInput {
  image: string; // data URL (JPEG)
  history: HistoryEntry[];
}
