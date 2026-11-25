"use client";

import { useEffect, useState } from "react";
import type { Program } from "@/lib/types";
import { getPrograms, updateProgramExerciseWeight } from "@/lib/firestore";
import { useError } from "@/components/providers/ErrorProvider";
import { useEquipmentConfig } from "@/hooks/useEquipmentConfig";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { useGymMachines } from "@/hooks/useGymMachines";
import { GymMachinesManager } from "@/components/settings/GymMachinesManager";
import { EquipmentWorkspace } from "./EquipmentWorkspace";

// Loads what the desktop Equipment page needs: the saved equipment, exercise definitions (with
// their machines' weights), programs (for working weights) and gym machines.
export function DesktopEquipment({ userId }: { userId: string }) {
  const { showError } = useError();
  const equipment = useEquipmentConfig(userId);
  const { definitions, loading: definitionsLoading, reload: reloadDefinitions } = useExerciseDefinitions(userId);
  const gym = useGymMachines(userId);
  const [programs, setPrograms] = useState<Program[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPrograms(userId)
      .then((ps) => { if (!cancelled) setPrograms(ps); })
      .catch((err) => { if (!cancelled) { setPrograms([]); showError(err); } });
    return () => { cancelled = true; };
  }, [userId, showError]);

  if (equipment.loading || definitionsLoading || programs === null) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-gray-400">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" aria-hidden="true" />
        Loading equipment…
      </div>
    );
  }

  const linkedCounts: Record<string, number> = {};
  for (const def of Object.values(definitions)) {
    if (def.machineId) linkedCounts[def.machineId] = (linkedCounts[def.machineId] ?? 0) + 1;
  }

  return (
    <EquipmentWorkspace
      config={equipment.config}
      onSave={equipment.saveConfig}
      definitions={definitions}
      programs={programs}
      onSetWeight={async (programId, definitionId, weight) => {
        const program = programs.find((p) => p.id === programId);
        const hardStreak = program?.weights?.[definitionId]?.hardStreak ?? 0;
        try {
          await updateProgramExerciseWeight(userId, programId, definitionId, weight, hardStreak);
          setPrograms((ps) => (ps ?? []).map((p) => (p.id === programId
            ? { ...p, weights: { ...p.weights, [definitionId]: { currentWeight: weight, hardStreak } } }
            : p)));
          return true;
        } catch (err) {
          showError(err);
          return false;
        }
      }}
      machinesSlot={(
        <GymMachinesManager
          machines={gym.machines}
          linkedCounts={linkedCounts}
          loading={gym.loading}
          busyId={gym.busyId}
          onCreate={async (name, plates) => {
            const ok = await gym.create(name, plates);
            if (ok) await reloadDefinitions(); // machine weights feed the can't-make check
            return ok;
          }}
          onUpdate={async (id, name, plates) => {
            const ok = await gym.update(id, name, plates);
            if (ok) await reloadDefinitions();
            return ok;
          }}
          onDelete={async (id) => {
            const ok = await gym.remove(id);
            // Deleting unlinks exercises in Firestore; refresh so the counts and links are current.
            if (ok) await reloadDefinitions();
            return ok;
          }}
        />
      )}
    />
  );
}
