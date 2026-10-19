"use client";

import { useEffect, useState } from "react";

// Inline count-up since the last logged set. Unlike RestTimer it is not an overlay: a custom
// workout has no prescribed rest, so this just shows how long the lifter has been resting.
// `startedAt` is a Date.now() stamp; a new stamp restarts the count.
export function SetTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-800/60 px-3 py-2 text-sm">
      <span className="text-gray-400">Since last set</span>
      <span data-testid="set-timer" className="font-mono font-semibold tabular-nums">{minutes}:{seconds}</span>
    </div>
  );
}
