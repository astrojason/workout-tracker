"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { BodyReport } from "@/components/body/BodyReport";
import { BodyMetricsSection } from "@/components/history/BodyMetricsSection";

// Desktop: the Body report (trends, logging and editing check-ins, history). Phones reach body
// metrics from History, but this route still works there with the same section History shows.
export default function BodyPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const body = useBodyMeasurements(user?.uid ?? null);
  const [now] = useState(() => new Date());

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to view body measurements.</p>
      </div>
    );
  }

  if (body.loading) {
    return (
      <div role="status" className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" aria-hidden="true" />
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="hidden lg:block max-w-[1360px] mx-auto p-8">
        <BodyReport entries={body.entries} onSave={body.save} onUpdate={body.update} onDelete={body.remove} now={now} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 lg:hidden">
      <h1 className="text-2xl font-bold mb-6">Body</h1>
      <BodyMetricsSection
        entries={body.entries}
        loading={body.loading}
        saving={body.saving}
        deletingId={body.deletingId}
        onSave={body.save}
        onDelete={body.remove}
      />
    </div>
  );
}
