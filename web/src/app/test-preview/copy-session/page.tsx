import { notFound } from "next/navigation";
import { CopySessionButton } from "@/components/history/CopySessionButton";
import type { WorkoutSessionDoc } from "@/lib/types";

export default function CopySessionTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  const base = {
    exerciseName: "Squat", exerciseOrder: 1, targetWeight: 135, actualWeight: 135, targetReps: 5,
    completed: true, timestamp: new Date("2026-10-12T12:00:00Z"),
  };
  const session = {
    id: "s1", programId: "p1", programName: "Reacher Build", week: 2, dayOfWeek: "Monday",
    date: new Date(2026, 9, 12), completed: true, durationSeconds: 1800,
    sets: [
      { ...base, id: "a", setNumber: 1, actualReps: 5, rating: "easy", notes: null },
      { ...base, id: "b", setNumber: 2, actualReps: 4, rating: "hard", notes: "left knee tight" },
    ],
  } as unknown as WorkoutSessionDoc;

  return (
    <main className="mx-auto max-w-lg p-4">
      <CopySessionButton session={session} />
    </main>
  );
}
