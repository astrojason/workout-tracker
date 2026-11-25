"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { BodyReport } from "@/components/body/BodyReport";
import { useError } from "@/components/providers/ErrorProvider";
import type { BodyMeasurementDoc, BodyMeasurementInput } from "@/lib/types";

const DAY = 86_400_000;
const now = new Date();
const ago = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12);

const weights = [187.3, 187.0, 186.6, 186.4, 186.1, 185.7, 185.5, 185.2, 184.9, 184.8, 184.5, 184.2];
const initial: BodyMeasurementDoc[] = weights.map((weight, i) => ({
  id: `w${i}`, date: ago((11 - i) * 6), weight, bodyFatPercentage: Number((19.6 - i * 0.1).toFixed(1)),
  ...(i === 0 ? { waist: 34.25, rightBicep: 15, leftBicep: 14.75, rightThigh: 23.5, leftThigh: 23.5, rightCalf: 15.5, leftCalf: 15.25 } : {}),
  ...(i === 11 ? { waist: 33.5, rightBicep: 15.25, leftBicep: 15, rightThigh: 24, leftThigh: 23.5, rightCalf: 15.5, leftCalf: 15.5 } : {}),
}));

export default function BodyReportTestPage() {
  const [entries, setEntries] = useState(initial);
  const { showError } = useError();
  // Set once React has hydrated, so tests don't type before handlers are attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  const wait = () => new Promise((r) => setTimeout(r, 400));
  // Like useBodyMeasurements: each reports its own error and resolves false when it failed.
  async function save(input: BodyMeasurementInput) {
    await wait();
    if (input.weight === 999) { showError(new Error("Preview: saving the check-in failed")); return false; }
    setEntries((es) => [...es, { id: `new${es.length}`, ...input }]);
    return true;
  }
  async function update(id: string, input: BodyMeasurementInput) {
    await wait();
    setEntries((es) => es.map((e) => (e.id === id ? { id, ...input } : e)));
    return true;
  }
  async function remove(id: string) {
    await wait();
    setEntries((es) => es.filter((e) => e.id !== id));
    return true;
  }

  return (
    <main className="mx-auto max-w-[1360px] p-8" data-hydrated={hydrated || undefined}>
      <BodyReport entries={entries} onSave={save} onUpdate={update} onDelete={remove} now={new Date(now.getTime() + DAY / 2)} />
    </main>
  );
}
