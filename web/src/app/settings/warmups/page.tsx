"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useError } from "@/components/providers/ErrorProvider";
import { usePrograms } from "@/hooks/usePrograms";
import { useEquipmentConfig } from "@/hooks/useEquipmentConfig";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { getAllWorkoutsForProgram } from "@/lib/firestore";
import type { Workout } from "@/lib/types";
import { normalizeWarmupRules } from "@/lib/warmup-rules";
import { warmupPreviewLifts } from "@/lib/warmup-preview";
import { WarmupRulesEditor } from "@/components/settings/WarmupRulesEditor";

// Settings → Warm-ups: the rules every generated warm-up follows, with a preview built from the
// lifts in your active programs.
export default function WarmupsPage() {
  const { user } = useAuth();
  const { showError } = useError();
  const p = usePrograms(user?.uid ?? null);
  const { config, loading: equipmentLoading } = useEquipmentConfig(user?.uid ?? null);
  const { definitions, machines, loading: definitionsLoading } = useExerciseDefinitions(user?.uid ?? null);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const programKey = p.activePrograms.map((x) => x.id).sort().join(",");

  useEffect(() => {
    if (!user || p.loading) return;
    let cancelled = false;
    Promise.all(p.activePrograms.map((prog) => getAllWorkoutsForProgram(user.uid, prog.id)))
      .then((lists) => { if (!cancelled) setWorkouts(lists.flat()); })
      .catch((err) => { if (!cancelled) { setWorkouts([]); showError(err); } });
    return () => { cancelled = true; };
    // Reload when the set of active programs changes, not on every programs update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, p.loading, programKey, showError]);

  // Stable while the saved rules don't change: the editor resets its draft when this changes.
  const rules = useMemo(() => normalizeWarmupRules(p.settings.warmupRules), [p.settings.warmupRules]);
  const lifts = useMemo(
    () => (workouts ? warmupPreviewLifts(p.activePrograms, workouts, definitions, config, machines) : []),
    [workouts, p.activePrograms, definitions, config, machines],
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to manage warm-ups.</p>
      </div>
    );
  }

  const loading = p.loading || equipmentLoading || definitionsLoading || workouts === null;
  return (
    <div className="max-w-[1360px] mx-auto p-4 lg:p-8">
      <Link href="/settings" className="inline-block mb-4 text-sm text-gray-400 hover:text-white">← Settings</Link>
      {loading ? (
        <div role="status" className="flex items-center justify-center gap-3 py-24 text-gray-400">
          <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" aria-hidden="true" />
          Loading warm-ups…
        </div>
      ) : (
        <WarmupRulesEditor
          rules={rules}
          equipment={config}
          lifts={lifts}
          onSave={(rules) => p.updateUserSettings({ warmupRules: rules })}
        />
      )}
    </div>
  );
}
