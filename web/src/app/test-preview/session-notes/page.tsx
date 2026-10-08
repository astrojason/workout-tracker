import { notFound } from "next/navigation";
import { SessionExerciseTable } from "@/components/history/SessionExerciseTable";
import type { CompletedSet } from "@/lib/types";

export default function SessionNotesTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  const base = {
    exerciseName: "Squat",
    exerciseOrder: 1,
    targetWeight: 135,
    actualWeight: 135,
    targetReps: 5,
    actualReps: 5,
    completed: true,
    timestamp: new Date("2026-10-01T12:00:00Z"),
  };
  const sets = [
    { ...base, id: "s1", setNumber: 1, notes: null },
    { ...base, id: "s2", setNumber: 2, notes: "Left knee felt tight on set 2" },
  ] as unknown as CompletedSet[];

  return (
    <main className="mx-auto max-w-lg p-4">
      <SessionExerciseTable name="Squat" sets={sets} hasRatings={false} />
    </main>
  );
}
