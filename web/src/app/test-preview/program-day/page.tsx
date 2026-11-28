"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ProgramDayExercises } from "@/components/programs/ProgramDayExercises";
import type { Exercise, ExerciseDefinition, Workout } from "@/lib/types";

const now = new Date();
const def = (id: string, name: string): ExerciseDefinition => ({
  id, name, muscleGroups: [], equipmentType: "barbell_45", equipmentDetail: null, progressionRule: "add_5lb",
  isUnilateral: false, isTimeBased: false, currentWeight: 135, hardStreak: 0, createdAt: now, updatedAt: now,
});
const definitions = {
  squat: def("squat", "Back Squat"),
  bench: def("bench", "Bench Press"),
  row: def("row", "Barbell Row"),
};
const ex = (id: string, order: number): Exercise => ({
  id: `e-${id}`, definitionId: id, order, phase: "main", sets: 3, repMin: 5,
  repMax: { type: "count", value: 8 }, restSeconds: 120, notes: null,
});
const initial: Workout = {
  id: "w1", programId: "p1", programName: "Block B", week: 1, dayOfWeek: "Monday",
  exercises: [ex("squat", 1), ex("bench", 2), ex("row", 3)],
};

export default function ProgramDayTestPage() {
  const [workout, setWorkout] = useState(initial);
  const [fail, setFail] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-lg p-4" data-hydrated={hydrated || undefined}>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Fail saves
      </label>
      <ProgramDayExercises
        workout={workout}
        definitions={definitions}
        onEdit={() => {}}
        onDelete={() => {}}
        onReorder={async (exercises) => {
          await new Promise((r) => setTimeout(r, 400));
          if (fail) throw new Error("Preview: saving the order failed");
          setWorkout((w) => ({ ...w, exercises }));
        }}
      />
    </main>
  );
}
