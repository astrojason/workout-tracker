import { notFound } from "next/navigation";
import { UpToday } from "@/components/home/UpToday";
import { RecentWorkouts } from "@/components/home/RecentWorkouts";
import type { ExerciseDefinition, Workout, WorkoutSessionDoc } from "@/lib/types";

const bench: ExerciseDefinition = {
  id: "bench-def", name: "Bench Press", muscleGroups: ["chest"], equipmentType: "barbell_45",
  equipmentDetail: null, progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false,
  currentWeight: 135, hardStreak: 0, createdAt: new Date(), updatedAt: new Date(),
};

const workout: Workout = {
  id: "w", programId: "preview-program", programName: "Preview Program", week: 3, dayOfWeek: "Tuesday",
  exercises: [
    { id: "e1", definitionId: "bench-def", order: 1, phase: "main", sets: 3, repMin: 8,
      repMax: { type: "count", value: 12 }, restSeconds: 90, notes: null, lastSetAmrap: true },
    { id: "e2", definitionId: "missing-def", order: 2, phase: "main", sets: 3, repMin: 8,
      repMax: { type: "count", value: 12 }, restSeconds: 90, notes: null },
  ],
};

const session = (id: string, daysAgo: number): WorkoutSessionDoc => ({
  id, programId: "preview-program", programName: "Preview Program", week: 3, dayOfWeek: "Monday",
  date: new Date(Date.now() - daysAgo * 86_400_000), completed: true, durationSeconds: 3480, sets: [],
});

export default function HomeDesktopTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-[360px] p-4 flex flex-col gap-6">
      <UpToday program={{ id: "preview-program", name: "Preview Program" }} workout={workout} week={3} definitions={{ "bench-def": bench }} />
      <RecentWorkouts sessions={[session("s1", 1), session("s2", 2), session("s3", 3), session("s4", 4)]} />
    </main>
  );
}
