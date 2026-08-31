"use client";

import { useCallback, useEffect, useState } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import {
  deleteBodyMeasurement,
  getBodyMeasurements,
  saveBodyMeasurement,
} from "@/lib/firestore";
import type { BodyMeasurementDoc, BodyMeasurementInput } from "@/lib/types";

function measurementDate(entry: BodyMeasurementDoc): Date {
  return entry.date instanceof Date ? entry.date : entry.date.toDate();
}

function chronological(entries: BodyMeasurementDoc[]): BodyMeasurementDoc[] {
  return [...entries].sort((a, b) => measurementDate(a).getTime() - measurementDate(b).getTime());
}

export function useBodyMeasurements(userId: string | null) {
  const { showError } = useError();
  const [entries, setEntries] = useState<BodyMeasurementDoc[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const measurements = await getBodyMeasurements(userId!);
        if (!cancelled) setEntries(chronological(measurements));
      } catch (err) {
        if (!cancelled) showError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, showError]);

  const save = useCallback(async (measurement: BodyMeasurementInput): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    try {
      const id = await saveBodyMeasurement(userId, measurement);
      setEntries((current) => chronological([...current, { id, ...measurement }]));
      return true;
    } catch (err) {
      showError(err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId, showError]);

  const remove = useCallback(async (measurementId: string): Promise<boolean> => {
    if (!userId) return false;
    setDeletingId(measurementId);
    try {
      await deleteBodyMeasurement(userId, measurementId);
      setEntries((current) => current.filter((entry) => entry.id !== measurementId));
      return true;
    } catch (err) {
      showError(err);
      return false;
    } finally {
      setDeletingId(null);
    }
  }, [userId, showError]);

  return { entries, loading, saving, deletingId, save, remove };
}
