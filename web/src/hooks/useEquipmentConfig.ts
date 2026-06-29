"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserEquipmentConfig } from "@/lib/types";
import { getEquipmentConfig, saveEquipmentConfig } from "@/lib/firestore";
import { DEFAULT_EQUIPMENT_CONFIG } from "@/lib/equipment-calculator";
import { useError } from "@/components/providers/ErrorProvider";

export function useEquipmentConfig(userId: string | null) {
  const { showError } = useError();
  const [config, setConfig] = useState<UserEquipmentConfig>(DEFAULT_EQUIPMENT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const saved = await getEquipmentConfig(userId!);
        if (!cancelled) setConfig(saved ?? DEFAULT_EQUIPMENT_CONFIG);
      } catch (err) {
        if (!cancelled) showError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const saveConfig = useCallback(async (newConfig: UserEquipmentConfig) => {
    if (!userId) return;
    setSaving(true);
    const previous = config;
    setConfig(newConfig); // optimistic update
    try {
      await saveEquipmentConfig(userId, newConfig);
    } catch (err) {
      showError(err);
      // Revert to previous state since save failed
      setConfig(previous); // non-critical: best-effort revert; outer showError already surfaced
    } finally {
      setSaving(false);
    }
  }, [userId, config]);

  return { config, loading, saving, saveConfig };
}
