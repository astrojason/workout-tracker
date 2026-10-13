"use client";

import { notFound } from "next/navigation";
import { CustomWorkout } from "@/components/workout/CustomWorkout";

export default function CustomWorkoutTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <CustomWorkout
      exerciseNames={["Bench Press", "Deadlift", "Row"]}
      onFinish={async () => []}
      onClose={() => {}}
    />
  );
}
