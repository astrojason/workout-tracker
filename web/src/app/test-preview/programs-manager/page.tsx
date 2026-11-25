"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ProgramsManager } from "@/components/library/ProgramsManager";
import { ImportCancelledError, type ExerciseMatchDecision, type ExerciseMatchRequest } from "@/lib/exercise-import";
import type { ExerciseDefinition } from "@/lib/types";
import type { ProgramRow } from "@/lib/library-index";

const now = new Date();
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);
const initial: ProgramRow[] = [
  { id: "p1", name: "Block B", archived: false, totalWeeks: 12, currentWeek: 7, days: ["Monday", "Thursday"], exercises: 18, sessions: 26, lastTrained: day(1) },
  { id: "p2", name: "Mobility", archived: false, totalWeeks: 1, currentWeek: 1, days: ["Daily"], exercises: 9, sessions: 74, lastTrained: day(2) },
  { id: "old", name: "Block A", archived: true, totalWeeks: 8, currentWeek: 8, days: ["Monday"], exercises: 12, sessions: 22, lastTrained: day(120) },
];
const library: ExerciseDefinition[] = [{
  id: "fly", name: "Pec Fly", muscleGroups: [], equipmentType: "pulley", equipmentDetail: null, progressionRule: "add_reps",
  isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now,
}];
const request: ExerciseMatchRequest = {
  index: 1, total: 1, candidates: library,
  exercise: { order: 1, name: "Cable Fly", phase: "main", equipmentType: "pulley", equipmentDetail: null, sets: 3, repMin: 10, repMax: { type: "count", value: 12 }, restSeconds: 60, progressionRule: "add_reps", isUnilateral: false, isTimeBased: false, notes: null },
};

export default function ProgramsManagerTestPage() {
  const [rows, setRows] = useState(initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  const wait = () => new Promise((r) => setTimeout(r, 300));
  const patch = (id: string, p: Partial<ProgramRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  async function importProgram(_: ArrayBuffer, name: string, ask: (r: ExerciseMatchRequest) => Promise<ExerciseMatchDecision>) {
    await wait();
    if ((await ask(request)).action === "cancel") throw new ImportCancelledError();
    setRows((rs) => [...rs, { id: "new", name, archived: false, totalWeeks: 12, currentWeek: 1, days: ["Monday"], exercises: 31, sessions: 0, lastTrained: null }]);
  }

  return (
    <main className="mx-auto max-w-[1360px] p-8" data-hydrated={hydrated || undefined}>
      <ProgramsManager
        rows={rows}
        sessionLimit={200}
        onImport={importProgram}
        onReimport={async (id) => { await wait(); patch(id, { exercises: 20 }); }}
        onRename={async (id, name) => { await wait(); patch(id, { name }); }}
        onChangeWeek={async (id, week) => { await wait(); patch(id, { currentWeek: week }); }}
        onArchive={async (id) => { await wait(); if (id === "p2") throw new Error("Preview: archiving failed"); patch(id, { archived: true }); }}
        onUnarchive={async (id) => { await wait(); patch(id, { archived: false }); }}
        onDelete={async (id) => { await wait(); setRows((rs) => rs.filter((r) => r.id !== id)); }}
      />
    </main>
  );
}
