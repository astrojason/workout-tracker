import { notFound } from "next/navigation";
import { ProgramCardPreview } from "./ProgramCardPreview";

export default function ProgramCardTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-lg p-4">
      <ProgramCardPreview />
    </main>
  );
}
