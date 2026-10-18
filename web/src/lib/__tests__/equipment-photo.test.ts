import { describe, it, expect } from "vitest";
import {
  summarizeHistory, validateEquipmentAnalysis, buildEquipmentPrompt, parseVisionToolCall,
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
    expect(validateEquipmentAnalysis(good)).toEqual(good);
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
