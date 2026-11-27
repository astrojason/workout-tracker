"use client";

import { useEffect, useState } from "react";
import type { ExerciseDefinition, ResolvedExercise, UserEquipmentConfig } from "@/lib/types";
import { cleanWeight } from "@/lib/types";
import { rampWarmups } from "@/lib/warmup-ramp";
import {
  WARMUP_GROUPS, WARMUP_MODE_LABEL, warmupGroup,
  type WarmupGroup, type WarmupGroupRule, type WarmupRules,
} from "@/lib/warmup-rules";
import { useError } from "@/components/providers/ErrorProvider";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

// A lift from the user's programs, at its current weight, for the preview.
export interface WarmupPreviewLift {
  exercise: ResolvedExercise;
  equipment: string; // e.g. "Kettlebells you own: 15, 25, 35 lb"
}

interface Props {
  rules: WarmupRules; // as saved (normalized)
  onSave: (rules: WarmupRules) => Promise<void>; // throws on failure; this component reports it
  lifts: WarmupPreviewLift[];
  equipment: UserEquipmentConfig;
  library?: Record<string, ExerciseDefinition>; // where a lighter movement can come from
  bodyweight?: number | null;
}

const RESTS = [30, 45, 60, 90];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clone = (r: WarmupRules): WarmupRules => structuredClone(r);

function Stepper({ value, unit, onDown, onUp, downLabel, upLabel, width = "w-12" }: {
  value: number | string; unit?: string; onDown: () => void; onUp: () => void; downLabel: string; upLabel: string; width?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" aria-label={downLabel} onClick={onDown} className="w-8 h-8 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700">−</button>
      <strong className={`${width} text-center tabular-nums`}>{value}{unit}</strong>
      <button type="button" aria-label={upLabel} onClick={onUp} className="w-8 h-8 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700">+</button>
    </span>
  );
}

function Switch({ checked, onChange, label, labelledBy }: { checked: boolean; onChange: () => void; label?: string; labelledBy?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} aria-labelledby={labelledBy} onClick={onChange}
      className={`relative w-12 h-7 shrink-0 rounded-full transition ${checked ? "bg-indigo-600" : "bg-gray-700"}`}>
      <span className={`absolute top-1 left-0 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

const lb = (w: number) => `${cleanWeight(w)} lb`;

// Settings → Warm-ups: one rule per equipment group and the limits shared by all, edited as a draft
// with a live preview, saved with one Save.
export function WarmupRulesEditor({ rules, onSave, lifts, equipment, library, bodyweight = null }: Props) {
  const { showError } = useError();
  const [draft, setDraft] = useState(() => clone(rules));
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => setDraft(clone(rules)), [rules]);

  const edit = (fn: (d: WarmupRules) => void) => {
    setDraft((d) => { const next = clone(d); fn(next); return next; });
    setState("idle");
  };
  const editGroup = (key: WarmupGroup, fn: (g: WarmupGroupRule) => void) => edit((d) => fn(d.groups[key]));

  const changed = [
    ...WARMUP_GROUPS.map(({ key }) => JSON.stringify(draft.groups[key]) !== JSON.stringify(rules.groups[key])),
    draft.maxPct !== rules.maxPct, draft.restSeconds !== rules.restSeconds, draft.oncePerWorkout !== rules.oncePerWorkout,
  ].filter(Boolean).length;

  async function save() {
    setState("saving");
    try {
      await onSave(draft);
      setState("saved");
    } catch (err) {
      setState("idle");
      showError(err);
    }
  }

  const busy = state === "saving";

  return (
    <section aria-labelledby="warmups-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 id="warmups-title" className="text-2xl font-bold">Warm-ups</h2>
          <p className="text-gray-400">How warm-up sets are built before each lift, by equipment. Every warm-up weight is one your equipment can make, and none goes above the limit below.</p>
        </div>
        {changed > 0 ? (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 py-1.5 pl-4 pr-1.5">
            <span className="font-medium text-amber-300">{changed} unsaved change{changed === 1 ? "" : "s"}</span>
            <button type="button" disabled={busy} onClick={() => setConfirmDiscard(true)} className="h-9 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold disabled:opacity-50">Discard…</button>
            <button type="button" disabled={busy} onClick={save} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2">
              {busy && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" aria-hidden="true" />}
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        ) : state === "saved" ? (
          <span role="status" className="text-green-400 font-medium">✓ Saved</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <div className="flex-[3_1_520px] min-w-0 flex flex-col gap-4">
          {WARMUP_GROUPS.map(({ key, title, covers, modes }) => {
            const g = draft.groups[key];
            return (
              <section key={key} aria-labelledby={`wu-${key}`} className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="px-5 py-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 id={`wu-${key}`} className="font-semibold">{title}</h3>
                    <p className="text-sm text-gray-400">{covers}</p>
                  </div>
                  <div role="radiogroup" aria-label={`Warm-up for ${title}`} className="flex rounded-lg border border-gray-700 overflow-hidden">
                    {modes.map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={g.mode === m} onClick={() => editGroup(key, (x) => { x.mode = m; })}
                        className={`px-3 min-h-9 py-1.5 text-sm leading-tight ${g.mode === m ? "bg-indigo-600 text-white font-semibold" : "text-gray-300 hover:bg-gray-800"}`}>
                        {WARMUP_MODE_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>

                {g.mode === "ramp" && (
                  <div className="px-5 py-4 flex flex-col gap-2.5">
                    {key === "plates" && (
                      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-950">
                        <span id={`wu-${key}-empty`}>Start with the empty bar or implement × <strong className="tabular-nums">{g.emptyBarReps}</strong> reps</span>
                        <Switch checked={g.emptyBar} labelledBy={`wu-${key}-empty`} onChange={() => editGroup(key, (x) => { x.emptyBar = !x.emptyBar; })} />
                      </div>
                    )}
                    {g.steps.map((s, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2 rounded-lg border border-gray-800">
                        <span className="w-14 text-sm text-gray-400">Step {i + 1}</span>
                        <span className="inline-flex items-center gap-2">
                          <Stepper value={s.pct} unit="%" downLabel={`Lower step ${i + 1} percent`} upLabel={`Raise step ${i + 1} percent`}
                            onDown={() => editGroup(key, (x) => { x.steps[i].pct = clamp(s.pct - 5, 5, 95); })}
                            onUp={() => editGroup(key, (x) => { x.steps[i].pct = clamp(s.pct + 5, 5, 95); })} />
                          <span className="text-gray-400">of work weight</span>
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span className="text-gray-400">×</span>
                          <Stepper value={s.reps} width="w-8" downLabel={`Fewer reps on step ${i + 1}`} upLabel={`More reps on step ${i + 1}`}
                            onDown={() => editGroup(key, (x) => { x.steps[i].reps = clamp(s.reps - 1, 1, 30); })}
                            onUp={() => editGroup(key, (x) => { x.steps[i].reps = clamp(s.reps + 1, 1, 30); })} />
                          <span className="text-gray-400">reps</span>
                        </span>
                        {/* Removing edits the draft only: Discard puts it back. */}
                        <button type="button" aria-label={`Remove step ${i + 1}`} onClick={() => editGroup(key, (x) => { x.steps.splice(i, 1); })} className="ml-auto text-sm text-red-400 hover:text-red-300">Remove</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => editGroup(key, (x) => {
                      const last = x.steps[x.steps.length - 1];
                      x.steps.push({ pct: last ? clamp(last.pct + 10, 5, 95) : 50, reps: last ? Math.max(1, last.reps - 1) : 5 });
                    })} className="self-start h-9 px-4 rounded-lg border border-dashed border-gray-700 text-sm font-semibold text-indigo-300 hover:bg-gray-800">
                      + Add a step
                    </button>
                    <p className="text-xs text-gray-500">Each step rounds down to a weight your equipment makes. A step over the limit, or no heavier than the one before, is dropped.</p>
                  </div>
                )}

                {g.mode === "single" && (
                  <div className="px-5 py-4 flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-800">
                      <span>One set at about</span>
                      <Stepper value={g.singlePct} unit="%" downLabel={`Lower the ${title} warm-up percent`} upLabel={`Raise the ${title} warm-up percent`}
                        onDown={() => editGroup(key, (x) => { x.singlePct = clamp(g.singlePct - 5, 5, 95); })}
                        onUp={() => editGroup(key, (x) => { x.singlePct = clamp(g.singlePct + 5, 5, 95); })} />
                      <span>of the work weight, for the work reps</span>
                    </div>
                    <ol className="list-decimal pl-5 text-sm text-gray-300 space-y-0.5">
                      <li>The heaviest weight you own at or under that</li>
                      <li>Otherwise your next lighter weight, up to the limit</li>
                      <li>Otherwise the work weight, for {g.fewerPct}% of the reps</li>
                    </ol>
                  </div>
                )}

                {g.mode === "fewer" && (
                  <div className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-800">
                      <span>One set at the same setup, for</span>
                      <Stepper value={g.fewerPct} unit="%" downLabel={`Fewer ${title} warm-up reps`} upLabel={`More ${title} warm-up reps`}
                        onDown={() => editGroup(key, (x) => { x.fewerPct = clamp(g.fewerPct - 10, 10, 90); })}
                        onUp={() => editGroup(key, (x) => { x.fewerPct = clamp(g.fewerPct + 10, 10, 90); })} />
                      <span>of the reps or time</span>
                    </div>
                  </div>
                )}

                {g.mode === "substitute" && (
                  <p className="px-5 py-4 text-sm text-gray-400">
                    One set of a lighter exercise from your library that works the same muscles, biggest muscle first (a banded press before
                    push-ups, bodyweight squats before goblet squats). Nothing lighter fits → no warm-up and an active-stretch tip.
                    The other groups use this too whenever you own nothing lighter.
                  </p>
                )}

                {g.mode === "none" && (
                  <p className="px-5 py-4 text-sm text-gray-400">No warm-up sets for this equipment. A program&apos;s own warm-up rows still run.</p>
                )}
              </section>
            );
          })}

          <section aria-labelledby="wu-limits" className="bg-gray-900 border border-gray-800 rounded-xl">
            <h3 id="wu-limits" className="px-5 py-4 border-b border-gray-800 font-semibold">Limits, for every warm-up</h3>
            <div className="px-5 divide-y divide-gray-800">
              <div className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div><div className="font-semibold">Heaviest warm-up</div><div className="text-sm text-gray-400">No warm-up set goes over this share of the work weight.</div></div>
                <Stepper value={draft.maxPct} unit="%" downLabel="Lower the limit" upLabel="Raise the limit"
                  onDown={() => edit((d) => { d.maxPct = clamp(d.maxPct - 5, 50, 95); })}
                  onUp={() => edit((d) => { d.maxPct = clamp(d.maxPct + 5, 50, 95); })} />
              </div>
              <div className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div><div className="font-semibold">Rest after each warm-up set</div><div className="text-sm text-gray-400">Before the next warm-up set, and before the lift&apos;s first set.</div></div>
                <div role="radiogroup" aria-label="Rest after each warm-up set" className="flex rounded-lg border border-gray-700 overflow-hidden">
                  {RESTS.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={draft.restSeconds === s} onClick={() => edit((d) => { d.restSeconds = s; })}
                      className={`px-3 h-9 text-sm ${draft.restSeconds === s ? "bg-indigo-600 text-white font-semibold" : "text-gray-300 hover:bg-gray-800"}`}>{s}s</button>
                  ))}
                </div>
              </div>
              <div className="py-3.5 flex items-center justify-between gap-3">
                <div><div id="wu-once" className="font-semibold">Warm up a lift once per workout</div><div className="text-sm text-gray-400">A lift that comes back later in the same workout gets no second warm-up.</div></div>
                <Switch checked={draft.oncePerWorkout} labelledBy="wu-once" onChange={() => edit((d) => { d.oncePerWorkout = !d.oncePerWorkout; })} />
              </div>
            </div>
          </section>

          <p className="text-sm text-gray-400 border border-dashed border-gray-700 rounded-xl px-5 py-4">
            One exercise needs no warm-up at all? Open it on Exercises and set its Warm-up to None. A program can still skip warm-ups for one day&apos;s occurrence.
          </p>
        </div>

        <section aria-labelledby="wu-preview" className="flex-[2_1_380px] min-w-0 bg-gray-900 border border-gray-800 rounded-xl lg:sticky lg:top-[calc(var(--app-nav-h)+1rem)]">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 id="wu-preview" className="font-semibold">What you&apos;d get</h3>
            <p className="text-sm text-gray-400">Lifts from your programs at their current weights, on your equipment. Updates as you edit.</p>
          </div>
          {lifts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">None of your active programs has a lift with a working weight yet.</p>
          ) : (
            <ul className="divide-y divide-gray-800">
              {lifts.map(({ exercise, equipment: equipmentText }) => (
                <PreviewRow key={exercise.definitionId} exercise={exercise} equipmentText={equipmentText} rules={draft} equipment={equipment} library={library} bodyweight={bodyweight} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {confirmDiscard && (
        <ConfirmDeleteModal
          title="Discard warm-up changes"
          message={`Discard ${changed} unsaved change${changed === 1 ? "" : "s"} to your warm-up rules and go back to what's saved? This can't be undone.`}
          confirmLabel="Discard"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => { setDraft(clone(rules)); setState("idle"); setConfirmDiscard(false); }}
        />
      )}
    </section>
  );
}

function PreviewRow({ exercise, equipmentText, rules, equipment, library, bodyweight }: {
  exercise: ResolvedExercise; equipmentText: string; rules: WarmupRules; equipment: UserEquipmentConfig;
  library?: Record<string, ExerciseDefinition>; bodyweight: number | null;
}) {
  const key = warmupGroup(exercise, equipment);
  const group = WARMUP_GROUPS.find((g) => g.key === key)!;
  const rule = rules.groups[key];
  const built = rampWarmups([exercise], equipment, rules, { library, bodyweight });
  const sets = built.filter((e) => e.phase === "warmup");
  const tip = built.find((e) => e.phase !== "warmup")?.warmupTip;
  const loaded = exercise.currentWeight > 0 && !exercise.isTimeBased;
  const work = loaded ? `${lb(exercise.currentWeight)} × ${exercise.repMin}` : exercise.isTimeBased ? `${exercise.repMin} s` : `${exercise.repMin} reps`;
  const sameWeight = loaded && sets.length > 0 && sets.every((s) => s.definitionId === exercise.definitionId && s.currentWeight >= exercise.currentWeight);
  const note = exercise.warmup === "none" ? "This exercise is set to no warm-up"
    : tip ? `Nothing lighter fits: no warm-up. Try ${tip.charAt(0).toLowerCase()}${tip.slice(1)}`
    : sets.length === 0 ? "No warm-up"
    : sameWeight && rule.mode !== "fewer" ? "You own nothing lighter: the work weight for fewer reps"
    : null;
  const setLabel = (s: ResolvedExercise) => s.definitionId !== exercise.definitionId
    ? `${s.name}${s.currentWeight > 0 ? ` ${lb(s.currentWeight)}` : s.equipmentDetail ? ` (${s.equipmentDetail})` : ""}`
    : loaded ? lb(s.currentWeight) : exercise.isTimeBased ? "Hold" : "Bodyweight";
  return (
    <li className="px-5 py-3.5 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{exercise.name}</span>
        <span className="text-sm text-gray-400 tabular-nums whitespace-nowrap">work {work}</span>
      </div>
      <div className="text-xs text-gray-500">{equipmentText} · {group.title}: {WARMUP_MODE_LABEL[rule.mode]}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {sets.map((s) => (
          <span key={s.id} className="inline-flex items-baseline gap-1 rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 tabular-nums whitespace-nowrap">
            <strong>{setLabel(s)}</strong>
            <span className="text-xs text-gray-400">× {s.repMin}{exercise.isTimeBased ? " s" : ""}</span>
          </span>
        ))}
        <span aria-hidden="true" className="text-gray-500">→</span>
        <span className="inline-flex items-baseline gap-1 rounded-full border border-indigo-700 bg-indigo-950 px-2.5 py-1 text-indigo-200 tabular-nums">
          <strong>{loaded ? lb(exercise.currentWeight) : "Work"}</strong><span className="text-xs">work</span>
        </span>
      </div>
      {note && <div className={`text-xs ${note.startsWith("You own") || note.startsWith("Nothing") ? "text-amber-300" : "text-gray-400"}`}>{note}</div>}
    </li>
  );
}
