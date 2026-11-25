"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { DesktopSettings } from "@/components/settings/DesktopSettings";

export default function SettingsDesktopTestPage() {
  const [settings, setSettings] = useState({ defaultRestSeconds: 120, soundEnabled: true });
  const [signedOut, setSignedOut] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-[1360px] p-8" data-hydrated={hydrated || undefined}>
      <p>{signedOut ? "Signed out" : "Signed in"}</p>
      <DesktopSettings
        defaultRestSeconds={settings.defaultRestSeconds}
        soundEnabled={settings.soundEnabled}
        email="you@example.com"
        onUpdate={async (update: { defaultRestSeconds?: number; soundEnabled?: boolean }) => { await new Promise((r) => setTimeout(r, 300)); setSettings((s) => ({ ...s, ...update })); }}
        onSignOut={async () => { await new Promise((r) => setTimeout(r, 300)); setSignedOut(true); }}
      />
    </main>
  );
}
