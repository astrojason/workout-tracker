"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { OverviewReport } from "@/components/overview/OverviewReport";
import type { BodyMeasurementDoc, CompletedSet, ExerciseDefinition, Program, WorkoutSessionDoc } from "@/lib/types";

const DAY = 86_400_000;
const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * DAY);

const def = (id: string, name: string, muscles: string[]): ExerciseDefinition => ({
  id, name, muscleGroups: muscles, equipmentType: "barbell_45", equipmentDetail: null, progressionRule: "add_5lb",
  isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now,
});
const definitions = { squat: def("squat", "Back Squat", ["Quads", "Glutes"]), bench: def("bench", "Bench Press", ["Chest"]) };

const set = (definitionId: string, exerciseName: string, weight: number, reps: number, setNumber = 1): CompletedSet => ({
  id: `${definitionId}-${setNumber}-${weight}`, exerciseName, definitionId, exerciseOrder: 1, setNumber,
  targetWeight: weight, actualWeight: weight, targetReps: reps, actualReps: reps, completed: true,
  timestamp: now, notes: null, phase: "main", equipmentType: "barbell_45",
});

const session = (id: string, daysAgo: number, sets: CompletedSet[], extra: Partial<WorkoutSessionDoc> = {}): WorkoutSessionDoc => ({
  id, programId: "p1", programName: "Block B", week: 2, dayOfWeek: "Monday", date: ago(daysAgo),
  completed: true, durationSeconds: 3000, sets, ...extra,
});

const sessions = [
  session("s1", 1, [set("squat", "Back Squat", 225, 5), set("squat", "Back Squat", 225, 5, 2)], {
    progressionChanges: [{ definitionId: "squat", before: { currentWeight: 225, hardStreak: 2 }, after: { currentWeight: 230, hardStreak: 0 } }],
  }),
  session("s2", 3, [set("bench", "Bench Press", 155, 5)], { dayOfWeek: "Thursday" }),
  session("s3", 42, [set("squat", "Back Squat", 215, 5)]),
];

const measurements: BodyMeasurementDoc[] = [
  { id: "m1", date: ago(30), weight: 186 },
  { id: "m2", date: ago(2), weight: 184.5 },
];

export default function OverviewTestPage() {
  const [weeks, setWeeks] = useState(12);
  const [programId, setProgramId] = useState<string | null>("p1");
  const [programs, setPrograms] = useState<Program[]>([{
    id: "p1", name: "Block B", totalWeeks: 12, createdAt: ago(60),
    weights: { squat: { currentWeight: 230, hardStreak: 1 }, bench: { currentWeight: 155, hardStreak: 0 } },
  }]);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  async function saveWeight(pid: string, definitionId: string, weight: number, hardStreak: number) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (definitionId === "bench") throw new Error("Preview: saving Bench Press failed");
    setPrograms((ps) => ps.map((p) => p.id === pid ? { ...p, weights: { ...p.weights, [definitionId]: { currentWeight: weight, hardStreak } } } : p));
  }

  return (
    <main className="mx-auto max-w-[1360px] p-8">
      <OverviewReport
        sessions={sessions}
        measurements={measurements}
        programs={programs}
        definitions={definitions}
        weeks={weeks}
        onWeeksChange={setWeeks}
        programId={programId}
        onProgramChange={setProgramId}
        onSaveWeight={saveWeight}
        now={now}
      />
    </main>
  );
}
