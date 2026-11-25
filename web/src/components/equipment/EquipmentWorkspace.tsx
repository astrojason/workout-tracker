"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ExerciseDefinition, Program, UserEquipmentConfig } from "@/lib/types";
import { cleanWeight } from "@/lib/types";
import { equipmentReach, reachStats, unmakeableWeights } from "@/lib/equipment-reach";
import type { ReachRow } from "@/lib/equipment-reach";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { BarbellSection } from "@/components/settings/BarbellSection";
import { PlatesSection } from "@/components/settings/PlatesSection";
import { PowerBlockSection } from "@/components/settings/PowerBlockSection";
import { KettlebellsSection } from "@/components/settings/KettlebellsSection";
import { BandsSection } from "@/components/settings/BandsSection";
import { LoopBandsSection } from "@/components/settings/LoopBandsSection";
import { FixedDumbbellsSection } from "@/components/settings/FixedDumbbellsSection";
import { GripperSection } from "@/components/settings/GripperSection";
import { AssistedPullupSection } from "@/components/settings/AssistedPullupSection";

export interface EquipmentWorkspaceProps {
  config: UserEquipmentConfig; // as saved
  onSave: (config: UserEquipmentConfig) => Promise<boolean>; // reports its own error, false on failure
  definitions: Record<string, ExerciseDefinition>;
  programs: Program[];
  machinesSlot: ReactNode; // the gym machines manager, which saves on its own
}

const unitOf = (row: ReachRow, n: number) => (row.unit === "bands" ? `${n} band${n === 1 ? "" : "s"}` : `${cleanWeight(n)} lb`);

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="bg-gray-900 border border-gray-800 rounded-xl px-5 pt-5 [&>section:last-child]:mb-5">
      {children}
    </section>
  );
}

// Desktop Equipment page: what the equipment can load and which working weights it can't make,
// both following the edits live, above the editors for everything owned.
export function EquipmentWorkspace({ config, onSave, definitions, programs, machinesSlot }: EquipmentWorkspaceProps) {
  const [draft, setDraft] = useState(config);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => setDraft(config), [config]);

  const changed = (Object.keys(draft) as (keyof UserEquipmentConfig)[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(config[k]));
  const reach = equipmentReach(draft);
  const problems = unmakeableWeights(programs, definitions, draft);
  const defs = Object.values(definitions);
  const usedBy = (row: ReachRow) => {
    const types = row.key === "powerblock" || row.key === "dumbbells" ? ["powerblock", "dumbbell"] : row.types;
    return defs.filter((d) => types.includes(d.equipmentType)).length;
  };

  function patch(updates: Partial<UserEquipmentConfig>) {
    setDraft((d) => ({ ...d, ...updates }));
    setState("idle");
  }

  async function save() {
    setState("saving");
    const ok = await onSave(draft);
    setState(ok ? "saved" : "idle");
  }

  const busy = state === "saving";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Equipment</h1>
          <p className="text-gray-400">What you own decides the weights the app suggests and the warm-ups it builds.</p>
        </div>
        {changed.length > 0 ? (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2 pl-4 pr-2">
            <span className="font-medium text-amber-300">{changed.length} unsaved change{changed.length === 1 ? "" : "s"}</span>
            <button type="button" disabled={busy} onClick={() => setConfirmDiscard(true)} className="h-9 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">Discard…</button>
            <button type="button" disabled={busy} onClick={save} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2">
              {busy && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" aria-hidden="true" />}
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        ) : state === "saved" ? (
          <span role="status" className="text-green-400 font-medium">&#x2713; Saved</span>
        ) : null}
      </div>

      <section aria-labelledby="equipment-reach-title" className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 id="equipment-reach-title" className="font-semibold">What you can load</h2>
          <p className="text-sm text-gray-400">Every weight your equipment can make, and where the jumps between them are big. Updates as you edit below.</p>
        </div>
        {reach.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">Add the equipment you own below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-gray-400 bg-gray-800/40 text-left whitespace-nowrap">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Equipment</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Range</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Smallest step</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Biggest gap</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold w-[36%]">Available loads</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold text-right">Exercises using it</th>
                </tr>
              </thead>
              <tbody>
                {reach.map((row) => {
                  const s = reachStats(row.loads);
                  const span = s.max - s.min || 1;
                  const gapIsBig = s.biggestGap && s.smallestStep !== null && s.biggestGap.to - s.biggestGap.from > s.smallestStep + 0.001;
                  const n = usedBy(row);
                  return (
                    <tr key={row.key} className="border-t border-gray-800 whitespace-nowrap">
                      <th scope="row" className="px-5 py-2.5 text-left font-semibold">{row.name}</th>
                      <td className="px-3 py-2.5 text-right">
                        {row.unit === "bands" ? `${s.min}–${s.max} bands` : `${cleanWeight(s.min)}–${cleanWeight(s.max)} lb`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-300">{s.smallestStep === null ? "—" : unitOf(row, s.smallestStep)}</td>
                      <td className={`px-3 py-2.5 text-right ${gapIsBig ? "text-amber-300" : "text-gray-300"}`}>
                        {s.biggestGap ? `${cleanWeight(s.biggestGap.from)} → ${cleanWeight(s.biggestGap.to)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <svg viewBox="0 0 400 16" className="w-full h-4 block" role="img" aria-label={`${row.loads.length} loads from ${unitOf(row, s.min)} to ${unitOf(row, s.max)}`}>
                          <line x1="0" x2="400" y1="8" y2="8" className="stroke-gray-800" strokeWidth="2" />
                          {row.loads.map((l) => {
                            const inGap = gapIsBig && s.biggestGap && (l === s.biggestGap.from || l === s.biggestGap.to);
                            return <rect key={l} x={((l - s.min) / span) * 397} y="1" width={row.loads.length > 80 ? 1.2 : 3} height="14" rx="1" className={inGap ? "fill-amber-400" : "fill-indigo-400"} />;
                          })}
                        </svg>
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-300">{n} exercise{n === 1 ? "" : "s"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="equipment-problems-title" className={`bg-gray-900 border rounded-xl ${problems.length > 0 ? "border-amber-500/40" : "border-gray-800"}`}>
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 id="equipment-problems-title" className="font-semibold">
            {problems.length > 0 ? `${problems.length} working weight${problems.length === 1 ? "" : "s"} you can't make` : "No working weights you can't make"}
          </h2>
          <p className="text-sm text-gray-400">Each active program&apos;s current weights, checked against your equipment and machine settings.</p>
        </div>
        {problems.length > 0 && (
          <ul>
            {problems.map((p) => {
              const unit = (n: number) => (p.unit === "bands" ? `${n} band${n === 1 ? "" : "s"}` : `${cleanWeight(n)} lb`);
              const near = p.below !== null && p.above !== null
                ? `Nearest: ${cleanWeight(p.below)} or ${unit(p.above)}`
                : p.below !== null ? `Nearest: ${unit(p.below)}` : p.above !== null ? `Nearest: ${unit(p.above)}` : null;
              return (
                <li key={`${p.programName}-${p.exerciseName}`} className="flex flex-wrap justify-between gap-3 px-5 py-3 border-t border-gray-800 first:border-t-0 text-sm">
                  <span>
                    <strong>{p.exerciseName}</strong> at <strong>{unit(p.weight)}</strong>
                    <span className="text-gray-400"> · {p.programName} · {p.reason}</span>
                  </span>
                  {near && <span className="text-gray-300">{near}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(420px,1fr))] items-start">
        <Card title="Barbells and plates">
          <BarbellSection config={draft} onChange={patch} />
          <PlatesSection config={draft} onChange={patch} />
        </Card>
        <Card title="Dumbbells and kettlebells">
          <PowerBlockSection config={draft} onChange={patch} />
          <FixedDumbbellsSection config={draft} onChange={patch} />
          <KettlebellsSection config={draft} onChange={patch} />
        </Card>
        <Card title="Bands">
          <BandsSection config={draft} onChange={patch} />
          <LoopBandsSection config={draft} onChange={patch} />
          <AssistedPullupSection config={draft} onChange={patch} />
        </Card>
        <Card title="Grippers">
          <GripperSection config={draft} onChange={patch} />
        </Card>
      </div>

      <section aria-labelledby="equipment-machines-title" className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 id="equipment-machines-title" className="font-semibold">Gym machines</h2>
        <p className="mb-4 text-sm text-gray-400">Each machine&apos;s weight settings, shared by every exercise linked to it. Machines save on their own.</p>
        {machinesSlot}
      </section>

      {confirmDiscard && (
        <ConfirmDeleteModal
          title="Discard changes"
          message={`Throw away ${changed.length} unsaved change${changed.length === 1 ? "" : "s"} and go back to your saved equipment?`}
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => { setDraft(config); setState("idle"); setConfirmDiscard(false); }}
        />
      )}
    </div>
  );
}
