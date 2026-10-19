import { describe, it, expect } from "vitest";
import {
  summarizeHistory, validateEquipmentAnalysis, buildEquipmentPrompt, parseVisionToolCall, EQUIPMENT_TOOL, EQUIPMENT_SYSTEM_PROMPT,
} from "../equipment-photo";
import type { CompletedSet, WorkoutSessionDoc } from "../types";

function set(over: Partial<CompletedSet>): CompletedSet {
  return {
    id: "s", exerciseName: "Bench Press", exerciseOrder: 1, setNumber: 1,
    targetWeight: 135, actualWeight: 135, targetReps: 8, actualReps: 8, completed: true,
    timestamp: new Date(), notes: null, ...over,
  };
}
function session(date: string, sets: CompletedSet[]): WorkoutSessionDoc {
  return {
    id: date, programId: "p", programName: "P", week: 1, dayOfWeek: "Monday",
    date: new Date(date), completed: true, durationSeconds: 1, sets,
  };
}

describe("summarizeHistory", () => {
  it("keeps the heaviest completed set from the newest session of each exercise", () => {
    const out = summarizeHistory([
      session("2026-01-01", [set({ actualWeight: 100 })]),
      session("2026-02-01", [set({ actualWeight: 125, actualReps: 8 }), set({ actualWeight: 135, actualReps: 6 }), set({ actualWeight: 200, completed: false })]),
    ]);
    expect(out).toEqual([{ exerciseName: "Bench Press", weight: 135, reps: 6, date: "2026-02-01" }]);
  });

  it("skips warm-ups and skipped sets, and caps the list", () => {
    const sets = Array.from({ length: 60 }, (_, i) => set({ exerciseName: `Ex ${i}` }));
    sets.push(set({ exerciseName: "Warm", phase: "warmup" }), set({ exerciseName: "Skipped", skipped: true }));
    const out = summarizeHistory([session("2026-02-01", sets)]);
    expect(out.length).toBe(40);
    expect(out.find((o) => o.exerciseName === "Warm" || o.exerciseName === "Skipped")).toBeUndefined();
  });
});

describe("validateEquipmentAnalysis", () => {
  const good = {
    name: "Seated Cable Row", equipmentType: "pulley", equipmentDetail: null,
    muscleGroups: ["back", "biceps"], isUnilateral: false, isTimeBased: false,
    suggestedWeight: 80, reasoning: "Based on your Lat Pulldown at 90 lbs",
  };

  it("accepts a well-formed response", () => {
    expect(validateEquipmentAnalysis(good)).toEqual({ ...good, progressionRule: "none", weightOptions: null });
  });

  it("rejects a response with no usable name", () => {
    expect(() => validateEquipmentAnalysis({ ...good, name: "  " })).toThrow(/malformed/i);
    expect(() => validateEquipmentAnalysis(null)).toThrow(/malformed/i);
  });

  it("falls back to dumbbell-agnostic safe defaults for untrusted fields", () => {
    const out = validateEquipmentAnalysis({ ...good, equipmentType: "rocket", suggestedWeight: -5, muscleGroups: "x" });
    expect(out.equipmentType).toBe("bodyweight");
    expect(out.suggestedWeight).toBeNull();
    expect(out.muscleGroups).toEqual([]);
  });

  it("drops implausible weights", () => {
    expect(validateEquipmentAnalysis({ ...good, suggestedWeight: 99999 }).suggestedWeight).toBeNull();
  });
});

describe("buildEquipmentPrompt", () => {
  it("includes the user's history", () => {
    const p = buildEquipmentPrompt([{ exerciseName: "Lat Pulldown", weight: 90, reps: 10, date: "2026-02-01" }]);
    expect(p).toContain("Lat Pulldown");
    expect(p).toContain("90");
  });
  it("says so when there is no history", () => {
    expect(buildEquipmentPrompt([])).toMatch(/no workout history/i);
  });
  it("passes the lifter's name and brand as a fallback for an unreadable photo", () => {
    const p = buildEquipmentPrompt([], { name: "Pulldown", brand: "Lifecycle" });
    expect(p).toContain("Pulldown");
    expect(p).toContain("Lifecycle");
    expect(p).toMatch(/photo.*(unclear|unreadable)|(unclear|unreadable).*photo/i);
  });
  it("identifies from the name and brand alone when there is no photo", () => {
    const p = buildEquipmentPrompt([], { name: "Pulldown", brand: "Lifecycle" }, false);
    expect(p).toContain("Pulldown");
    expect(p).toContain("Lifecycle");
    expect(p).not.toMatch(/in the photo/i);
  });
  it("uses the name alone when no brand is given", () => {
    const p = buildEquipmentPrompt([], { name: "Pulldown", brand: null });
    expect(p).toContain("Pulldown");
    expect(p).not.toMatch(/brand/i);
  });
});

describe("parseVisionToolCall", () => {
  it("extracts arguments and token usage", () => {
    const r = parseVisionToolCall({
      choices: [{ message: { tool_calls: [{ function: { arguments: '{"name":"x"}' } }] } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
    expect(r).toEqual({ args: { name: "x" }, tokensUsed: 15 });
  });
  it("throws when there is no tool call", () => {
    expect(() => parseVisionToolCall({ choices: [{ message: {} }] })).toThrow(/no tool call/i);
  });
});

describe("validateEquipmentAnalysis — fixed-weight machines", () => {
  const base = {
    name: "Lat Pulldown", equipmentType: "machine", equipmentDetail: null, muscleGroups: ["back"],
    isUnilateral: false, isTimeBased: false, suggestedWeight: 87, reasoning: "x",
  };

  it("keeps the selectable weights and progression rule for a machine", () => {
    const a = validateEquipmentAnalysis({ ...base, weightOptions: [70, 90, 100], progressionRule: "add_weight" });
    expect(a.equipmentType).toBe("machine");
    expect(a.weightOptions).toEqual([70, 90, 100]);
    expect(a.progressionRule).toBe("add_weight");
  });

  it("sorts, de-duplicates and drops nonsense from the options", () => {
    const a = validateEquipmentAnalysis({ ...base, weightOptions: [100, 70, 70, -5, "x", 0, 90] });
    expect(a.weightOptions).toEqual([70, 90, 100]);
  });

  it("treats fewer than two usable options as unknown", () => {
    expect(validateEquipmentAnalysis({ ...base, weightOptions: [90] }).weightOptions).toBeNull();
    expect(validateEquipmentAnalysis({ ...base, weightOptions: "10,20" }).weightOptions).toBeNull();
  });

  it("snaps the suggested weight down to the nearest selectable option", () => {
    expect(validateEquipmentAnalysis({ ...base, weightOptions: [70, 90, 100] }).suggestedWeight).toBe(70);
    expect(validateEquipmentAnalysis({ ...base, suggestedWeight: 95, weightOptions: [70, 90, 100] }).suggestedWeight).toBe(90);
  });

  it("uses the lowest option when the suggestion is below all of them", () => {
    expect(validateEquipmentAnalysis({ ...base, suggestedWeight: 40, weightOptions: [70, 90] }).suggestedWeight).toBe(70);
  });

  it("leaves the suggestion alone when the options are unknown", () => {
    expect(validateEquipmentAnalysis({ ...base, weightOptions: null }).suggestedWeight).toBe(87);
  });

  it("defaults a machine to the next-weight progression when the model gives none", () => {
    expect(validateEquipmentAnalysis({ ...base, weightOptions: [70, 90] }).progressionRule).toBe("add_weight");
  });

  it("ignores weight options for non-machine equipment", () => {
    const a = validateEquipmentAnalysis({ ...base, equipmentType: "barbell_45", weightOptions: [70, 90], progressionRule: "add_5lb" });
    expect(a.weightOptions).toBeNull();
    expect(a.progressionRule).toBe("add_5lb");
  });

  it("never leaves a machine on 'none': it would never progress", () => {
    expect(validateEquipmentAnalysis({ ...base, progressionRule: "none" }).progressionRule).toBe("add_weight");
  });

  it("only keeps equipmentDetail for bands, not a brand the model put there", () => {
    expect(validateEquipmentAnalysis({ ...base, equipmentDetail: "Nautilus" }).equipmentDetail).toBeNull();
    expect(validateEquipmentAnalysis({ ...base, equipmentType: "band", equipmentDetail: "Blue" }).equipmentDetail).toBe("Blue");
    expect(validateEquipmentAnalysis({ ...base, equipmentType: "loop_band", equipmentDetail: "Heavy" }).equipmentDetail).toBe("Heavy");
  });

  it("rejects an unknown progression rule", () => {
    expect(validateEquipmentAnalysis({ ...base, equipmentType: "barbell_45", progressionRule: "do_magic" }).progressionRule).toBe("none");
  });

  it("keeps the whole system prompt, including the name/brand guidance and the closing instruction", () => {
    expect(EQUIPMENT_SYSTEM_PROMPT).toMatch(/add_10lb/);
    expect(EQUIPMENT_SYSTEM_PROMPT).toMatch(/name and\/or brand/);
    expect(EQUIPMENT_SYSTEM_PROMPT).toMatch(/submit_equipment function\.$/);
  });

  it("does not tell the model to use pulley for cable stacks", () => {
    expect(EQUIPMENT_SYSTEM_PROMPT).not.toMatch(/use 'pulley' for cable stacks/);
  });

  it("asks the model for the options and rule in its tool schema", () => {
    const props = EQUIPMENT_TOOL.function.parameters.properties as Record<string, unknown>;
    expect(props.weightOptions).toBeDefined();
    expect(props.progressionRule).toBeDefined();
    expect(EQUIPMENT_SYSTEM_PROMPT).toMatch(/selectorized|weight stack/i);
  });
});
