"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { WarmupRulesEditor, type WarmupPreviewLift } from "@/components/settings/WarmupRulesEditor";
import { DEFAULT_WARMUP_RULES, type WarmupRules } from "@/lib/warmup-rules";
import { DEFAULT_EQUIPMENT_CONFIG } from "@/lib/equipment-calculator";
import type { ResolvedExercise, UserEquipmentConfig } from "@/lib/types";

// Plates without the small change, kettlebells from 15 lb, and a FitArc.
const equipment: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  plates: [
    { weight: 45, totalOwned: 2 }, { weight: 35, totalOwned: 2 }, { weight: 25, totalOwned: 4 }, { weight: 10, totalOwned: 4 },
    { weight: 5, totalOwned: 2 }, { weight: 2.5, totalOwned: 2 },
  ],
  kettlebells: [15, 25, 35],
  items: [{ id: "fitarc", name: "FitArc", kind: "plate_loaded", baseWeight: 5, sides: 1 }],
};

const ex = (o: Partial<ResolvedExercise>): ResolvedExercise => ({
  id: o.definitionId ?? "x", definitionId: "x", order: 1, name: "Lift", phase: "main", equipmentType: "barbell_45", equipmentDetail: null,
  muscleGroups: [], sets: 3, repMin: 8, repMax: { type: "count", value: 8 }, restSeconds: 120, progressionRule: "none",
  isUnilateral: false, isTimeBased: false, notes: null, currentWeight: 0, hardStreak: 0, ...o,
});

const lifts: WarmupPreviewLift[] = [
  { exercise: ex({ definitionId: "squat", name: "Back Squat", currentWeight: 185, repMin: 5 }), equipment: "Olympic bar (45 lb)" },
  { exercise: ex({ definitionId: "arc", name: "FitArc Row", equipmentType: "machine", equipmentItemId: "fitarc", currentWeight: 25, repMin: 10 }), equipment: "FitArc" },
  { exercise: ex({ definitionId: "swing", name: "KB Swing", equipmentType: "kettlebell", currentWeight: 15, repMin: 15 }), equipment: "Kettlebells: 15, 25, 35 lb" },
  { exercise: ex({ definitionId: "goblet", name: "Goblet Squat", equipmentType: "kettlebell", currentWeight: 35, repMin: 10 }), equipment: "Kettlebells: 15, 25, 35 lb" },
  { exercise: ex({ definitionId: "pushup", name: "Push-up", equipmentType: "bodyweight", repMin: 12 }), equipment: "Bodyweight" },
];

export default function WarmupRulesTestPage() {
  const [saved, setSaved] = useState<WarmupRules>(DEFAULT_WARMUP_RULES);
  const [failNext, setFailNext] = useState(false);
  // Set once React has hydrated, so tests don't click before handlers are attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-[1360px] p-8 flex flex-col gap-4" data-hydrated={hydrated || undefined}>
      <button type="button" onClick={() => setFailNext(true)} className="self-start text-sm text-gray-400">Make the next save fail</button>
      <p className="text-xs text-gray-500 break-all">Saved rules: {JSON.stringify(saved.groups.plates.steps)}</p>
      <WarmupRulesEditor
        rules={saved}
        lifts={lifts}
        equipment={equipment}
        onSave={async (rules) => {
          await new Promise((r) => setTimeout(r, 400));
          if (failNext) { setFailNext(false); throw new Error("Preview save failed"); }
          setSaved(rules);
        }}
      />
    </main>
  );
}
