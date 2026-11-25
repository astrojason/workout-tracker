"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ExerciseLibraryEditor } from "@/components/library/ExerciseLibraryEditor";
import type { ExerciseRow } from "@/lib/library-index";
import type { ExerciseDefinition, GymMachine, UserEquipmentConfig } from "@/lib/types";
import { DEFAULT_EQUIPMENT_CONFIG } from "@/lib/equipment-calculator";

const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);
const initialRows: ExerciseRow[] = [
  { id: "squat", name: "Back Squat", equipmentType: "barbell_45", equipmentDetail: null, muscles: ["Quads", "Glutes"], progressionRule: "add_5lb", programs: ["Block B"], sessions: 23, lastDone: day(1) },
  { id: "pull", name: "Assisted Pull-up", equipmentType: "assisted_pullup", equipmentDetail: null, muscles: ["Lats"], progressionRule: "reduce_assistance", programs: ["Block B"], sessions: 20, lastDone: day(4) },
  { id: "curl", name: "Hammer Curl", equipmentType: "dumbbell", equipmentDetail: null, muscles: ["Biceps"], progressionRule: "add_reps", programs: [], sessions: 0, lastDone: null },
];
const now = new Date();
const definitionFor = (r: ExerciseRow): ExerciseDefinition => ({
  id: r.id, name: r.name, muscleGroups: r.muscles, equipmentType: r.equipmentType, equipmentDetail: r.equipmentDetail,
  progressionRule: r.progressionRule, isUnilateral: false, isTimeBased: false, currentWeight: 100, hardStreak: 0, createdAt: now, updatedAt: now,
});

// What the fixture owns: one bar, no PowerBlock, two bands, a FitArc, and a gym machine.
const equipment: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  barbells: { has45lb: true, has35lb: false, hasEZBar: false },
  powerBlock: { owned: false, minLbs: 5, maxLbs: 50 },
  bands: ["Red", "Blue"],
  items: [{ id: "fitarc", name: "FitArc", kind: "plate_loaded", baseWeight: 5, sides: 1 }],
};
const machines: GymMachine[] = [{ id: "m1", name: "Chest press", plates: [50, 75, 100], createdAt: now, updatedAt: now }];

export default function LibraryIndexTestPage() {
  // Set once React has hydrated, so tests don't type before handlers are attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [rows, setRows] = useState(initialRows);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-[1360px] p-8 flex flex-col gap-16" data-hydrated={hydrated || undefined}>
      <ExerciseLibraryEditor
        rows={rows}
        sessionLimit={200}
        definitions={Object.fromEntries(rows.map((r) => [r.id, definitionFor(r)]))}
        machines={machines}
        equipment={equipment}
        onSave={async (id, save) => {
          await new Promise((r) => setTimeout(r, 300));
          if (save.meta.name === "boom") throw new Error("Preview save failed");
          const itemName = equipment.items?.find((i) => i.id === save.meta.equipmentItemId)?.name ?? null;
          setRows((rs) => rs.map((r) => (r.id === id ? { ...r, name: save.meta.name ?? r.name, equipmentType: save.meta.equipmentType ?? r.equipmentType, equipmentName: itemName } : r)));
        }}
      />
    </main>
  );
}
