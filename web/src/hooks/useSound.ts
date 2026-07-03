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
  // "suspended"; we await ctx.resume() before scheduling oscillators so the
  // beep isn't silently dropped in the resume gap.
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
    try {
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
    } catch {
      // non-critical: audio playback is best-effort, and many callers do not
      // await this Promise, so swallow unexpected WebAudio failures.
    }
  }, [getContext]);

  const playSetComplete = useCallback(async () => {
    try {
      const ctx = getContext();
      await ensureRunning(ctx);
      if (ctx.state === "suspended") return;
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = 660;
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch {
      // non-critical: audio playback is best-effort, and many callers do not
      // await this Promise, so swallow unexpected WebAudio failures.
    }
  }, [getContext]);

  // Must be called from a user gesture to enable audio
  const initAudio = useCallback(() => {
    getContext();
  }, [getContext]);

  return { playTimerComplete, playSetComplete, initAudio };
}
