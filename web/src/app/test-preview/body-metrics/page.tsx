import { notFound } from "next/navigation";
import { BodyMetricsPreview } from "./BodyMetricsPreview";

export default function BodyMetricsTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-lg p-4">
      <BodyMetricsPreview />
    </main>
  );
}
