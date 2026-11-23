"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useGymMachines } from "@/hooks/useGymMachines";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { GymMachinesManager } from "@/components/settings/GymMachinesManager";

export default function GymMachinesPage() {
  const { user } = useAuth();
  const { machines, loading, busyId, create, update, remove } = useGymMachines(user?.uid ?? null);
  const { definitions, loading: definitionsLoading, reload: reloadDefinitions } = useExerciseDefinitions(user?.uid ?? null);

  const linkedCounts: Record<string, number> = {};
  for (const def of Object.values(definitions)) {
    if (def.machineId) linkedCounts[def.machineId] = (linkedCounts[def.machineId] ?? 0) + 1;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to manage gym machines.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-gray-400 hover:text-white transition text-sm">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold">Gym Machines</h1>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        A machine&apos;s weights are the settings its stack can be set to. Pick a machine on any machine exercise and it uses these
        weights — edit them here once and every linked exercise follows.
      </p>

      <GymMachinesManager
        machines={machines}
        linkedCounts={linkedCounts}
        loading={loading || definitionsLoading}
        busyId={busyId}
        onCreate={create}
        onUpdate={update}
        onDelete={async (id) => {
          const ok = await remove(id);
          // Deleting unlinks exercises in Firestore; refresh so the counts and links are current.
          if (ok) await reloadDefinitions();
          return ok;
        }}
      />
    </div>
  );
}
