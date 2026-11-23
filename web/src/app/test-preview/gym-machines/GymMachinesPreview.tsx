"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GymMachinesManager } from "@/components/settings/GymMachinesManager";
import type { GymMachine } from "@/lib/types";

const byName = (list: GymMachine[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

// In-memory stand-in for the Firestore-backed hook: ?empty=1 starts with no machines,
// ?slow=1 delays the first load so the spinner is observable.
export function GymMachinesPreview() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [machines, setMachines] = useState<GymMachine[]>(() =>
    params.get("empty")
      ? []
      : [{ id: "m-chest", name: "Chest Press", plates: [10, 20, 30, 40], createdAt: new Date(), updatedAt: new Date() }],
  );

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), params.get("slow") ? 600 : 0);
    return () => clearTimeout(t);
  }, [params]);

  async function simulate(id: string, apply: () => void): Promise<boolean> {
    setBusyId(id);
    await new Promise((r) => setTimeout(r, 100));
    apply();
    setBusyId(null);
    return true;
  }

  return (
    <main className="mx-auto max-w-lg p-4">
      <GymMachinesManager
        machines={machines}
        linkedCounts={{ "m-chest": 2 }}
        loading={loading}
        busyId={busyId}
        onCreate={(name, plates) => simulate("new", () =>
          setMachines((cur) => byName([...cur, { id: `m-${name}`, name, plates, createdAt: new Date(), updatedAt: new Date() }])))}
        onUpdate={(id, name, plates) => simulate(id, () =>
          setMachines((cur) => byName(cur.map((m) => (m.id === id ? { ...m, name, plates } : m)))))}
        onDelete={(id) => simulate(id, () => setMachines((cur) => cur.filter((m) => m.id !== id)))}
      />
    </main>
  );
}
