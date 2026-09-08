"use client";

import { useState } from "react";
import { ProgramCard } from "@/components/home/ProgramCard";
import type { Program, Workout } from "@/lib/types";

const program: Program = {
  id: "preview-program",
  name: "Preview Program",
  totalWeeks: 4,
  createdAt: new Date(),
};

const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

const todaysWorkout: Workout = {
  id: "preview-workout",
  programId: "preview-program",
  programName: "Preview Program",
  week: 1,
  dayOfWeek: todayName,
  exercises: [
    {
      id: "preview-exercise",
      definitionId: "preview-def",
      order: 1,
      phase: "main",
      sets: 3,
      repMin: 8,
      repMax: { type: "count", value: 12 },
      restSeconds: 90,
      notes: null,
    },
  ],
};

// Browser-test fixture only. Mirrors the real Home -> ProgramCard wiring (state
// updates in response to onSkipDay) without needing Firebase auth or Firestore.
export function ProgramCardPreview() {
  const [skippedDays, setSkippedDays] = useState<Set<string>>(new Set());
  const [completedDays] = useState<Set<string>>(new Set());

  return (
    <ProgramCard
      program={program}
      week={1}
      todaysWorkout={todaysWorkout}
      availableDays={[todayName]}
      completedDays={completedDays}
      skippedDays={skippedDays}
      onStartWorkout={() => true}
      onSelectDay={() => true}
      onSkipDay={() => {
        const todayISO = new Date().toLocaleDateString("en-CA");
        setSkippedDays((prev) => new Set(prev).add(todayISO));
      }}
    />
  );
}
