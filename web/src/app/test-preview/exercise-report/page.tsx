"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ExerciseReport } from "@/components/exercise/ExerciseReport";
import type { CompletedSet, ExerciseDefinition, Program, WorkoutSessionDoc } from "@/lib/types";

const DAY = 86_400_000;
const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * DAY);

const squat: ExerciseDefinition = {
  id: "squat", name: "Back Squat", muscleGroups: ["Quads", "Glutes"], equipmentType: "barbell_45", equipmentDetail: null,
  progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now,
};

const set = (setNumber: number, weight: number, reps: number, extra: Partial<CompletedSet> = {}): CompletedSet => ({
  id: `${setNumber}-${weight}-${reps}-${extra.phase ?? "main"}`, exerciseName: "Back Squat", definitionId: "squat",
  exerciseOrder: 1, setNumber, targetWeight: weight, actualWeight: weight, targetReps: 5, actualReps: reps,
  completed: true, timestamp: now, notes: null, phase: "main", equipmentType: "barbell_45", ...extra,
});

const session = (id: string, daysAgo: number, sets: CompletedSet[]): WorkoutSessionDoc => ({
  id, programId: "p1", programName: "Block B", week: 2, dayOfWeek: "Monday", date: ago(daysAgo),
  completed: true, durationSeconds: 3000, sets,
});

const sessions = [
  session("s1", 1, [set(1, 225, 6, { rating: "normal" }), set(2, 225, 5, { rating: "hard", notes: "Belt" })]),
  session("s2", 8, [set(1, 220, 6, { rating: "hard" })]),
  session("s3", 15, [set(1, 135, 5, { phase: "warmup" }), set(2, 215, 5, { rating: "normal" })]),
  session("s4", 50, [set(1, 205, 8, { rating: "easy" })]),
];

const programs: Program[] = [{
  id: "p1", name: "Block B", totalWeeks: 12, createdAt: ago(90), weights: { squat: { currentWeight: 230, hardStreak: 1 } },
}];

export default function ExerciseReportTestPage() {
  const [weeks, setWeeks] = useState(12);
  const [programId, setProgramId] = useState<string | null>("p1");
  // Set once React has hydrated, so tests don't click before handlers are attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-[1360px] p-8" data-hydrated={hydrated || undefined}>
      <ExerciseReport
        name="Back Squat"
        definition={squat}
        sessions={sessions}
        programs={programs}
        weeks={weeks}
        onWeeksChange={setWeeks}
        programId={programId}
        onProgramChange={setProgramId}
        now={now}
      />
    </main>
  );
}
