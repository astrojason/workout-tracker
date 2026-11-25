"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import { APP_VERSION } from "@/lib/version";

const RESTS = [60, 90, 120, 150, 180];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Everything else from the phone's Settings has its own top-bar page on desktop.
const MOVED = [
  { title: "Programs", text: "Import, rename, re-import, set the current week, archive or delete", tab: "Programs", href: "/programs" },
  { title: "Exercise library", text: "Names, equipment, muscles and progression for every exercise", tab: "Exercises", href: "/exercises" },
  { title: "Equipment and gym machines", text: "Bars, plates, dumbbells, kettlebells, bands, grippers and machine stacks", tab: "Equipment", href: "/equipment" },
  { title: "Body measurements", text: "Check-ins, trends and spreadsheet import", tab: "Body", href: "/body" },
];

export interface DesktopSettingsProps {
  defaultRestSeconds: number;
  soundEnabled: boolean;
  email: string | null;
  // Both throw on failure; this component reports the error.
  onUpdate: (update: { defaultRestSeconds?: number; soundEnabled?: boolean }) => Promise<void>;
  onSignOut: () => Promise<void>;
}

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="bg-gray-900 border border-gray-800 rounded-xl scroll-mt-20">
      <h2 id={`${id}-title`} className="px-6 py-4 border-b border-gray-800 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// Desktop Settings: only what isn't elsewhere in the top bar — default rest, sound, account and
// about — plus pointers to the pages that took over the rest.
export function DesktopSettings({ defaultRestSeconds, soundEnabled, email, onUpdate, onSignOut }: DesktopSettingsProps) {
  const { showError } = useError();
  const [rest, setRest] = useState<"idle" | "saving" | "saved">("idle");
  const [soundSaving, setSoundSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function pickRest(seconds: number) {
    if (seconds === defaultRestSeconds) return;
    setRest("saving");
    try {
      await onUpdate({ defaultRestSeconds: seconds });
      setRest("saved");
    } catch (err) {
      setRest("idle");
      showError(err);
    }
  }

  async function toggleSound() {
    setSoundSaving(true);
    try {
      await onUpdate({ soundEnabled: !soundEnabled });
    } catch (err) {
      showError(err);
    } finally {
      setSoundSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (err) {
      setSigningOut(false);
      showError(err);
    }
  }

  const sections = [["workout", "Workout"], ["warmups", "Warm-ups"], ["sound", "Sound"], ["account", "Account"], ["about", "About"], ["moved", "Moved to the top bar"]];

  return (
    <div className="flex gap-8 items-start max-w-[1100px] mx-auto">
      <aside className="w-[220px] shrink-0 sticky top-[calc(var(--app-nav-h)+2rem)]">
        <h1 className="text-3xl font-bold mb-4">Settings</h1>
        <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={`px-3 py-2 rounded-lg hover:bg-gray-800 ${id === "moved" ? "text-gray-400" : "text-gray-300"}`}>{label}</a>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <Card id="workout" title="Workout">
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[260px]">
              <div className="font-semibold">Default rest between sets</div>
              <p className="text-sm text-gray-400">Used for exercises that don&apos;t set their own rest. An exercise&apos;s own rest is set in its program.</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div role="group" aria-label="Default rest" className="flex rounded-xl border border-gray-700 overflow-hidden">
                {RESTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === defaultRestSeconds}
                    disabled={rest === "saving"}
                    onClick={() => pickRest(s)}
                    className={`px-3.5 h-9 text-sm transition disabled:opacity-60 ${s === defaultRestSeconds ? "bg-indigo-600 text-white font-semibold" : "text-gray-300 hover:bg-gray-800"}`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
              <span role="status" className={`text-xs ${rest === "saved" ? "text-green-400" : "text-gray-400"}`}>
                {rest === "saving" ? "Saving…" : rest === "saved" ? `✓ Saved · ${clock(defaultRestSeconds)} between sets` : `${clock(defaultRestSeconds)} between sets`}
              </span>
            </div>
          </div>
        </Card>

        <Card id="warmups" title="Warm-ups">
          <Link href="/settings/warmups" className="px-6 py-5 flex items-center justify-between gap-4 hover:bg-gray-800/40 rounded-b-xl">
            <span>
              <span className="block font-semibold">Warm-up rules</span>
              <span className="block text-sm text-gray-400">How warm-up sets are built for each kind of equipment, with a preview on your own lifts.</span>
            </span>
            <span className="text-sm text-indigo-300 shrink-0">Edit →</span>
          </Link>
        </Card>

        <Card id="sound" title="Sound">
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <div id="timer-sound-label" className="font-semibold">Timer sound</div>
              <p className="text-sm text-gray-400">Plays when a rest or a timed set ends.{soundSaving ? " Saving…" : ""}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              aria-labelledby="timer-sound-label"
              aria-busy={soundSaving}
              disabled={soundSaving}
              onClick={toggleSound}
              className={`relative w-12 h-7 shrink-0 rounded-full transition disabled:opacity-60 ${soundEnabled ? "bg-indigo-600" : "bg-gray-700"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${soundEnabled ? "translate-x-6" : "translate-x-1"} left-0`} />
            </button>
          </div>
        </Card>

        <Card id="account" title="Account">
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-11 w-11 rounded-full bg-indigo-950 text-indigo-300 flex items-center justify-center text-lg font-bold">
                {(email ?? "?").charAt(0).toUpperCase()}
              </span>
              <div>
                <div className="font-semibold">{email ?? "Google account"}</div>
                <div className="text-sm text-gray-400">Signed in with Google</div>
              </div>
            </div>
            <button type="button" disabled={signingOut} onClick={signOut} className="h-10 px-4 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 font-semibold disabled:opacity-60">
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </Card>

        <Card id="about" title="About">
          <dl className="px-6 py-2 grid grid-cols-[160px_minmax(0,1fr)] text-sm">
            <dt className="py-3 text-gray-400 border-b border-gray-800">Version</dt>
            <dd className="py-3 border-b border-gray-800 flex justify-between">
              <span>{APP_VERSION}</span>
              <Link href="/changelog" className="text-indigo-400 hover:text-indigo-300">What&apos;s new →</Link>
            </dd>
            <dt className="py-3 text-gray-400">Phone app</dt>
            <dd className="py-3">Workouts are logged on your phone; everything here syncs to it.</dd>
          </dl>
        </Card>

        <section id="moved" aria-labelledby="moved-title" className="border border-dashed border-gray-700 rounded-xl scroll-mt-20">
          <div className="px-6 pt-4 pb-2">
            <h2 id="moved-title" className="font-semibold">Moved to the top bar</h2>
            <p className="text-sm text-gray-400">On the phone these stay in Settings. On desktop each has its own page.</p>
          </div>
          <ul className="pb-2">
            {MOVED.map((m) => (
              <li key={m.href} className="border-t border-gray-800">
                <Link href={m.href} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-gray-900">
                  <span>
                    <span className="block font-semibold">{m.title}</span>
                    <span className="block text-sm text-gray-400">{m.text}</span>
                  </span>
                  <span className="shrink-0 text-sm text-indigo-300">{m.tab} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
