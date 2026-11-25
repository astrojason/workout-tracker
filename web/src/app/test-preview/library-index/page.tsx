"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ExercisesIndex } from "@/components/library/ExercisesIndex";
import type { ExerciseRow } from "@/lib/library-index";

const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);
const exercises: ExerciseRow[] = [
  { id: "squat", name: "Back Squat", equipmentType: "barbell_45", equipmentDetail: null, muscles: ["Quads", "Glutes"], progressionRule: "add_5lb", programs: ["Block B"], sessions: 23, lastDone: day(1) },
  { id: "pull", name: "Assisted Pull-up", equipmentType: "assisted_pullup", equipmentDetail: null, muscles: ["Lats"], progressionRule: "reduce_assistance", programs: ["Block B"], sessions: 20, lastDone: day(4) },
  { id: "curl", name: "Hammer Curl", equipmentType: "dumbbell", equipmentDetail: null, muscles: ["Biceps"], progressionRule: "add_reps", programs: [], sessions: 0, lastDone: null },
];

export default function LibraryIndexTestPage() {
  // Set once React has hydrated, so tests don't type before handlers are attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-[1360px] p-8 flex flex-col gap-16" data-hydrated={hydrated || undefined}>
      <ExercisesIndex rows={exercises} sessionLimit={200} />
    </main>
  );
}
