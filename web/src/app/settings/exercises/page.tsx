"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { useEquipmentConfig } from "@/hooks/useEquipmentConfig";
import { updateExerciseDefinitionMeta, updateExerciseDefinitionWeight } from "@/lib/firestore";
import { useError } from "@/components/providers/ErrorProvider";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { ExerciseDefinitionForm } from "@/components/library/ExerciseDefinitionForm";

export default function ExerciseLibraryPage() {
  const { user } = useAuth();
  const { showError } = useError();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { definitions, machines, loading, reload } = useExerciseDefinitions(user?.uid ?? null);
  // The user's own equipment items, which an exercise can be linked to.
  const { config: equipmentConfig } = useEquipmentConfig(user?.uid ?? null);
  const items = equipmentConfig.items ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  // ?edit=<definitionId> (linked from Equipment and Exercises) opens that exercise's editor and
  // scrolls to it once the library has loaded. Read after mount: there's no URL on the server.
  const [linkedId, setLinkedId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (id) { setLinkedId(id); setEditingId(id); }
  }, []);
  useEffect(() => {
    if (!linkedId || loading || !definitions[linkedId]) return;
    document.getElementById(`exercise-${linkedId}`)?.scrollIntoView({ block: "center" });
    setLinkedId(null);
  }, [linkedId, loading, definitions]);

  // On desktop the library is edited on the Exercises page, in its side panel (?edit= carries over).
  useEffect(() => {
    if (isDesktop) router.replace(`/exercises${window.location.search}`);
  }, [isDesktop, router]);

  const sorted = Object.values(definitions).sort((a, b) => a.name.localeCompare(b.name));

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to manage exercises.</p>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-24 text-gray-400">
        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" aria-hidden="true" />
        Opening Exercises…
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-gray-400 hover:text-white transition text-sm">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold">Exercise Library</h1>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Every exercise here is shared across all your programs — editing it (including its weight) affects every occurrence, in every program, going forward.
      </p>

      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading...</div>
      ) : sorted.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No exercises yet — import a program to populate your library.</p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {sorted.map((def) =>
            editingId === def.id ? (
              <div key={def.id} id={`exercise-${def.id}`}>
              <ExerciseDefinitionForm
                variant="inline"
                definition={def}
                library={sorted}
                machines={machines}
                equipment={equipmentConfig}
                onSave={async ({ meta, weight }) => {
                  await updateExerciseDefinitionMeta(user.uid, def.id, meta);
                  if (weight) await updateExerciseDefinitionWeight(user.uid, def.id, weight.currentWeight, weight.hardStreak);
                }}
                onSaved={() => {
                  setEditingId(null);
                  reload().catch(showError);
                }}
                onCancel={() => setEditingId(null)}
                onError={showError}
              />
              </div>
            ) : (
              <button
                key={def.id}
                onClick={() => setEditingId(def.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition"
              >
                <div className="font-semibold">{def.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {def.brand ? `${def.brand} · ` : ""}{def.equipmentType.replace(/_/g, " ")}{def.machineId && machines.some((m) => m.id === def.machineId) ? ` (${machines.find((m) => m.id === def.machineId)!.name})` : def.weightOptions?.length ? ` (${def.weightOptions.length} weights)` : ""}{def.equipmentDetail ? ` · ${def.equipmentDetail}` : ""}{items.find((i) => i.id === def.equipmentItemId) ? ` · on ${items.find((i) => i.id === def.equipmentItemId)!.name}` : ""} · {def.progressionRule.replace(/_/g, " ")}
                </div>
                {def.muscleGroups.length > 0 && (
                  <div className="text-xs text-gray-600 mt-0.5">{def.muscleGroups.join(", ")}</div>
                )}
                <div className="text-xs text-indigo-400 mt-1">
                  {def.currentWeight > 0 ? `${def.currentWeight} lbs` : "—"}
                </div>
              </button>
            )
          )}
        </div>
      )}

    </div>
  );
}
