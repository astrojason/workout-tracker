import { notFound } from "next/navigation";
import { ExerciseMatchPreview } from "./ExerciseMatchPreview";

export default function ExerciseMatchTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();
  return <ExerciseMatchPreview />;
}
