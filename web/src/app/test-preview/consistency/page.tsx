import { notFound } from "next/navigation";
import { ConsistencyCard } from "@/components/home/ConsistencyCard";

export default function ConsistencyTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-lg p-4">
      <ConsistencyCard currentStreak={3} completedThisWeek={3} plannedThisWeek={4} />
    </main>
  );
}
