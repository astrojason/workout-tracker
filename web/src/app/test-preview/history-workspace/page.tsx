"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { HistoryWorkspace } from "@/components/history/HistoryWorkspace";
import type { CompletedSet, ExerciseDefinition, PRResult, WorkoutSessionDoc } from "@/lib/types";

const DAY = 86_400_000;
const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * DAY);

const def = (id: string, name: string): ExerciseDefinition => ({
  id, name, muscleGroups: [], equipmentType: "barbell_45", equipmentDetail: null, progressionRule: "add_5lb",
  isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now,
});
const definitions = { squat: def("squat", "Back Squat"), bench: def("bench", "Bench Press"), plank: { ...def("plank", "Plank"), equipmentType: "bodyweight", isTimeBased: true } as ExerciseDefinition };

const set = (id: string, name: string, order: number, setNumber: number, weight: number, reps: number, extra: Partial<CompletedSet> = {}): CompletedSet => ({
  id, exerciseName: name, definitionId: name === "Back Squat" ? "squat" : "bench", exerciseOrder: order, setNumber,
  targetWeight: weight, actualWeight: weight, targetReps: 5, actualReps: reps, completed: true, timestamp: now,
  notes: null, phase: "main", equipmentType: "barbell_45", rating: "normal", ...extra,
});

const initial: WorkoutSessionDoc[] = [
  {
    id: "h1", programId: "p1", programName: "Block B", week: 7, dayOfWeek: "Monday", date: ago(1), completed: true, durationSeconds: 3480,
    sets: [set("s1", "Back Squat", 1, 1, 225, 6), set("s2", "Back Squat", 1, 2, 225, 5, { rating: "hard" }), set("b1", "Bench Press", 2, 1, 155, 5)],
    progressionChanges: [{ definitionId: "squat", before: { currentWeight: 220, hardStreak: 2 }, after: { currentWeight: 225, hardStreak: 0 } }],
  },
  {
    id: "h2", programId: "p1", programName: "Block B", week: 6, dayOfWeek: "Thursday", date: ago(3), completed: false, durationSeconds: 1500,
    sets: [set("b2", "Bench Press", 1, 1, 150, 5)],
  },
  { id: "h3", programId: "p1", programName: "Block B", week: 6, dayOfWeek: "Tuesday", date: ago(5), completed: false, skipped: true, durationSeconds: 0, sets: [] },
];

export default function HistoryWorkspaceTestPage() {
  const [sessions, setSessions] = useState(initial);
  const [lastSaved, setLastSaved] = useState("nothing");
  const [lastAdded, setLastAdded] = useState("nothing");
  // Set once React has hydrated, so tests don't type before handlers are attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  async function save(id: string, update: { sets: CompletedSet[]; durationSeconds: number }) {
    await new Promise((r) => setTimeout(r, 400));
    setSessions((ss) => ss.map((s) => (s.id === id ? { ...s, ...update } : s)));
    setLastSaved(update.sets.map((s) => `${s.exerciseName} set ${s.setNumber} ${s.actualWeight}×${s.actualReps}`).join(", ") + ` · ${update.durationSeconds}s`);
  }
  async function addExercise(id: string, sets: CompletedSet[]): Promise<PRResult[]> {
    await new Promise((r) => setTimeout(r, 400));
    if (sets[0].exerciseName === "Broken Lift") throw new Error("Firestore said no");
    setSessions((ss) => ss.map((s) => (s.id === id ? { ...s, sets: [...s.sets, ...sets] } : s)));
    setLastAdded(sets.map((s) => `${s.exerciseName} #${s.exerciseOrder} set ${s.setNumber} ${s.actualWeight}×${s.actualReps}${s.isTimeBased ? " timed" : ""}`).join(", "));
    return [];
  }
  async function remove(id: string) {
    await new Promise((r) => setTimeout(r, 400));
    setSessions((ss) => ss.filter((s) => s.id !== id));
  }

  return (
    <main className="mx-auto max-w-[1360px] p-8" data-hydrated={hydrated || undefined}>
      <p>Last saved: {lastSaved}</p>
      <p>Last added: {lastAdded}</p>
      <HistoryWorkspace sessions={sessions} definitions={definitions} onSave={save} onDelete={remove} onAddExercise={addExercise} />
    </main>
  );
}
