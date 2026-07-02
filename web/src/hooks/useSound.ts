"use client";

import { useRef, useCallback } from "react";

export function useSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // Returning from a backgrounded tab commonly leaves the AudioContext
  // "suspended"; scheduling oscillators before it actually resumes causes
  // the beep to be silently dropped, so callers must await this first.
  async function ensureRunning(ctx: AudioContext) {
    if (ctx.state !== "suspended") return;
    try {
      await ctx.resume();
    } catch {
      // non-critical: resume() can reject without a recent user gesture;
      // audio is a best-effort enhancement, so just skip the beep rather
      // than throwing an unhandled rejection into unawaited callers.
    }
  }

  const playTimerComplete = useCallback(async () => {
    const ctx = getContext();
    await ensureRunning(ctx);
    if (ctx.state === "suspended") return;
    // 3 short beeps at 880Hz
    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(ctx.currentTime + i * 0.3);
      oscillator.stop(ctx.currentTime + i * 0.3 + 0.15);
    }
  }, [getContext]);

  const playSetComplete = useCallback(async () => {
    const ctx = getContext();
    await ensureRunning(ctx);
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }, [getContext]);

  // Must be called from a user gesture to enable audio
  const initAudio = useCallback(() => {
    getContext();
  }, [getContext]);

  return { playTimerComplete, playSetComplete, initAudio };
}
