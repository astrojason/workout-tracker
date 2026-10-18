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
      onScanPhoto={async () => {
        if (new URLSearchParams(window.location.search).get("fail") === "1") {
          throw new Error("OpenAI API error 529: overloaded");
        }
        return {
          name: "Seated Cable Row", equipmentType: "pulley", equipmentDetail: null, muscleGroups: ["back"],
          isUnilateral: false, isTimeBased: false, suggestedWeight: 80,
          reasoning: "Based on your Lat Pulldown at 90 lbs",
        };
      }}
    />
  );
}
