import { notFound } from "next/navigation";
import { CoachPreview } from "./CoachPreview";

export default async function CoachTestPage({ searchParams }: { searchParams: Promise<{ fail?: string }> }) {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();
  const { fail } = await searchParams;

  return (
    <main className="mx-auto max-w-lg p-4">
      <CoachPreview fail={fail === "1"} />
    </main>
  );
}
