"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { EquipmentWorkspace } from "@/components/equipment/EquipmentWorkspace";
import { DEFAULT_EQUIPMENT_CONFIG } from "@/lib/equipment-calculator";
import type { ExerciseDefinition, Program, UserEquipmentConfig } from "@/lib/types";

const now = new Date();
const def = (id: string, name: string, extra: Partial<ExerciseDefinition> = {}): ExerciseDefinition => ({
  id, name, muscleGroups: [], equipmentType: "barbell_45", equipmentDetail: null, progressionRule: "add_5lb",
  isUnilateral: false, isTimeBased: false, currentWeight: 0, hardStreak: 0, createdAt: now, updatedAt: now, ...extra,
});
const definitions = {
  squat: def("squat", "Back Squat"),
  bench: def("bench", "Bench Press"),
  goblet: def("goblet", "Goblet Squat", { equipmentType: "kettlebell" }),
};
const programs: Program[] = [{
  id: "p1", name: "Block B", totalWeeks: 12, createdAt: now,
  weights: { squat: { currentWeight: 85, hardStreak: 0 }, bench: { currentWeight: 95, hardStreak: 0 }, goblet: { currentWeight: 20, hardStreak: 0 } },
}];
const initial: UserEquipmentConfig = {
  ...DEFAULT_EQUIPMENT_CONFIG,
  barbells: { has45lb: true, has35lb: false, hasEZBar: false },
  plates: [
    { weight: 45, totalOwned: 2 }, { weight: 35, totalOwned: 0 }, { weight: 25, totalOwned: 2 }, { weight: 10, totalOwned: 2 },
    { weight: 5, totalOwned: 2 }, { weight: 2.5, totalOwned: 2 }, { weight: 1, totalOwned: 0 }, { weight: 0.75, totalOwned: 0 }, { weight: 0.5, totalOwned: 0 },
  ],
  kettlebells: [18, 26],
};

export default function EquipmentWorkspaceTestPage() {
  const [saved, setSaved] = useState(initial);
  const [programList, setProgramList] = useState(programs);
  const [lastSaved, setLastSaved] = useState("nothing");
  // Set once React has hydrated, so tests don't click before handlers are attached.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  async function save(config: UserEquipmentConfig) {
    await new Promise((r) => setTimeout(r, 400));
    // A save the real app would report through the error modal; here it just fails.
    if ((config.items ?? []).some((i) => i.name === "boom")) return false;
    setSaved(config);
    setLastSaved(config.plates.filter((p) => p.totalOwned > 0).map((p) => `${p.weight}×${p.totalOwned}`).join(" "));
    return true;
  }

  return (
    <main className="mx-auto max-w-[1360px] p-8" data-hydrated={hydrated || undefined}>
      <p>Last saved: {lastSaved}</p>
      <p>Saved items: {(saved.items ?? []).map((i) => i.name).join(", ") || "none"}</p>
      <p>Saved PowerBlock: {(saved.powerBlock.weights ?? []).join(",") || "every 2.5 lb"}</p>
      <EquipmentWorkspace
        config={saved}
        onSave={save}
        definitions={definitions}
        programs={programList}
        onSetWeight={async (programId, definitionId, weight) => {
          await new Promise((r) => setTimeout(r, 400));
          setProgramList((ps) => ps.map((p) => (p.id === programId ? { ...p, weights: { ...p.weights, [definitionId]: { currentWeight: weight, hardStreak: 0 } } } : p)));
          return true;
        }}
        machinesSlot={<p>Machines placeholder</p>}
      />
    </main>
  );
}
