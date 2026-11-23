"use client";

import { useState } from "react";
import { ExerciseMatchModal } from "@/components/ui/ExerciseMatchModal";
import type { ExerciseMatchDecision, ParsedExercise } from "@/lib/exercise-import";
import type { ExerciseDefinition } from "@/lib/types";

function def(id: string, name: string): ExerciseDefinition {
  return {
    id, name, muscleGroups: [], equipmentType: "powerblock", equipmentDetail: null, progressionRule: "none",
    isUnilateral: false, isTimeBased: false, currentWeight: 20, hardStreak: 0, createdAt: new Date(), updatedAt: new Date(),
  };
}

function pe(name: string): ParsedExercise {
  return {
    order: 1, name, phase: "main", equipmentType: "powerblock", equipmentDetail: null, seedWeight: 15, sets: 3,
    repMin: 12, repMax: { type: "count", value: 12 }, restSeconds: 90, progressionRule: "add_2.5lb",
    isUnilateral: false, isTimeBased: false, notes: null, lastSetAmrap: true,
  };
}

const LIBRARY = [def("d-bench", "Bench Press"), def("d-hammer", "Dumbbell Hammer Curl"), def("d-row", "Cable Row")];
const EXERCISES = [pe("Hammer Curls"), pe("Fitarc Circuit")];

export function ExerciseMatchPreview() {
  const [step, setStep] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  function decide(d: ExerciseMatchDecision) {
    const label = d.action === "use" ? `use ${d.definitionId}` : d.action;
    setLog((l) => [...l, `${EXERCISES[step].name} → ${label}`]);
    setStep(d.action === "cancel" ? EXERCISES.length : step + 1);
  }

  return (
    <main className="mx-auto max-w-lg p-4">
      <p data-testid="decisions">{log.join("; ")}</p>
      {step < EXERCISES.length && (
        <ExerciseMatchModal
          key={step}
          request={{ exercise: EXERCISES[step], index: step + 1, total: EXERCISES.length, candidates: LIBRARY }}
          onDecide={decide}
        />
      )}
    </main>
  );
}
