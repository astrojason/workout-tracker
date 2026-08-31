"use client";

import { useState } from "react";
import { BodyMetricsSection } from "@/components/history/BodyMetricsSection";
import type { BodyMeasurementDoc, BodyMeasurementInput } from "@/lib/types";

export function BodyMetricsPreview() {
  const [entries, setEntries] = useState<BodyMeasurementDoc[]>([]);

  async function save(measurement: BodyMeasurementInput): Promise<boolean> {
    setEntries((current) => [...current, { id: `preview-${current.length + 1}`, ...measurement }]);
    return true;
  }

  async function remove(measurementId: string): Promise<boolean> {
    setEntries((current) => current.filter((entry) => entry.id !== measurementId));
    return true;
  }

  return (
    <BodyMetricsSection
      entries={entries}
      loading={false}
      saving={false}
      onSave={save}
      onDelete={remove}
    />
  );
}
