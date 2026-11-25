"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ExerciseEditor } from "@/components/programs/ExerciseEditor";
import type { Exercise, ExerciseDefinition } from "@/lib/types";

const now = new Date();
const squat: ExerciseDefinition = {
  id: "squat", name: "Back Squat", muscleGroups: ["Quads", "Glutes"], equipmentType: "barbell_45", equipmentDetail: null,
  progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, currentWeight: 225, hardStreak: 1, createdAt: now, updatedAt: now,
};
const occurrence: Exercise = {
  id: "e1", definitionId: "squat", order: 1, phase: "main", sets: 4, repMin: 5,
  repMax: { type: "count", value: 8 }, restSeconds: 180, notes: null,
};

export default function ExerciseEditorTestPage() {
  const [open, setOpen] = useState(true);
  // Set once React has hydrated, so tests don't click before handlers are attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-lg p-4" data-hydrated={hydrated || undefined}>
      <p>{open ? "Editor open" : "Editor closed"}</p>
      <button onClick={() => setOpen(true)}>Open editor</button>
      {open && (
        <ExerciseEditor
          exercise={{ ...occurrence, definitionName: "Back Squat" }}
          maxOrder={1}
          definitions={[squat]}
          onSave={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </main>
  );
}
