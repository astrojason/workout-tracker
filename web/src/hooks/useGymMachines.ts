"use client";

import { useCallback, useEffect, useState } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import { createGymMachine, deleteGymMachine, getGymMachines, updateGymMachine } from "@/lib/firestore";
import type { GymMachine } from "@/lib/types";

const byName = (list: GymMachine[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

// The user's gym machines. Each action returns whether it succeeded (failures are shown via
// showError) and exposes `busyId` ("new" while creating, else the machine id) for spinners.
export function useGymMachines(userId: string | null) {
  const { showError } = useError();
  const [machines, setMachines] = useState<GymMachine[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setMachines([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const list = await getGymMachines(userId!);
        if (!cancelled) setMachines(byName(list));
      } catch (err) {
        if (!cancelled) showError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, showError]);

  const run = useCallback(async (id: string, action: () => Promise<void>): Promise<boolean> => {
    setBusyId(id);
    try {
      await action();
      return true;
    } catch (err) {
      showError(err);
      return false;
    } finally {
      setBusyId(null);
    }
  }, [showError]);

  const create = useCallback((name: string, plates: number[]) => {
    if (!userId) return Promise.resolve(false);
    return run("new", async () => {
      const id = await createGymMachine(userId, { name, plates });
      const now = new Date();
      setMachines((cur) => byName([...cur, { id, name, plates, createdAt: now, updatedAt: now }]));
    });
  }, [userId, run]);

  const update = useCallback((id: string, name: string, plates: number[]) => {
    if (!userId) return Promise.resolve(false);
    return run(id, async () => {
      await updateGymMachine(userId, id, { name, plates });
      setMachines((cur) => byName(cur.map((m) => (m.id === id ? { ...m, name, plates, updatedAt: new Date() } : m))));
    });
  }, [userId, run]);

  const remove = useCallback((id: string) => {
    if (!userId) return Promise.resolve(false);
    return run(id, async () => {
      await deleteGymMachine(userId, id);
      setMachines((cur) => cur.filter((m) => m.id !== id));
    });
  }, [userId, run]);

  return { machines, loading, busyId, create, update, remove };
}
