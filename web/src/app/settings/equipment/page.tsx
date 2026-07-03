"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useEquipmentConfig } from "@/hooks/useEquipmentConfig";
import { BottomNav } from "@/components/ui/BottomNav";
import { BarbellSection } from "@/components/settings/BarbellSection";
import { PlatesSection } from "@/components/settings/PlatesSection";
import { PowerBlockSection } from "@/components/settings/PowerBlockSection";
import { KettlebellsSection } from "@/components/settings/KettlebellsSection";
import { BandsSection } from "@/components/settings/BandsSection";
import { LoopBandsSection } from "@/components/settings/LoopBandsSection";
import { FixedDumbbellsSection } from "@/components/settings/FixedDumbbellsSection";
import { GripperSection } from "@/components/settings/GripperSection";
import { AssistedPullupSection } from "@/components/settings/AssistedPullupSection";
import type { UserEquipmentConfig } from "@/lib/types";

export default function EquipmentPage() {
  const { user } = useAuth();
  const { config, loading, saving, saveConfig } = useEquipmentConfig(user?.uid ?? null);
  const [draft, setDraft] = useState<UserEquipmentConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  function patch(updates: Partial<UserEquipmentConfig>) {
    setDraft((prev) => ({ ...prev, ...updates }));
  }

  async function handleSave() {
    await saveConfig(draft);
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to manage equipment.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-32">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-gray-400 hover:text-white transition text-sm">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold">Equipment</h1>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading...</div>
      ) : (
        <>
          <BarbellSection config={draft} onChange={patch} />
          <PlatesSection config={draft} onChange={patch} />
          <PowerBlockSection config={draft} onChange={patch} />
          <KettlebellsSection config={draft} onChange={patch} />
          <BandsSection config={draft} onChange={patch} />
          <LoopBandsSection config={draft} onChange={patch} />
          <FixedDumbbellsSection config={draft} onChange={patch} />
          <GripperSection config={draft} onChange={patch} />
          <AssistedPullupSection config={draft} onChange={patch} />
        </>
      )}

      {(isDirty || saving) && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-2">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      <BottomNav active="settings" />
    </div>
  );
}
