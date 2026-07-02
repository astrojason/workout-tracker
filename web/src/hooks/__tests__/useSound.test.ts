import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSound } from "../useSound";

// Simulates the real-world case where the AudioContext comes back from a
// backgrounded tab in a "suspended" state and resume() takes a moment to
// settle — the completion beep must not be silently dropped in that gap.
describe("useSound", () => {
  let mockCtx: {
    state: "suspended" | "running";
    currentTime: number;
    destination: object;
    createOscillator: ReturnType<typeof vi.fn>;
    createGain: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
  let resolveResume: () => void;

  beforeEach(() => {
    const resumePromise = new Promise<void>((res) => {
      resolveResume = () => {
        mockCtx.state = "running";
        res();
      };
    });

    const makeOscillator = () => ({
      type: "",
      frequency: { value: 0 },
      connect: vi.fn(function (this: unknown) {
        return this;
      }),
      start: vi.fn(),
      stop: vi.fn(),
    });
    const makeGain = () => ({
      gain: { value: 0 },
      connect: vi.fn(),
    });

    mockCtx = {
      state: "suspended",
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(makeOscillator),
      createGain: vi.fn(makeGain),
      resume: vi.fn(() => resumePromise),
    };

    (globalThis as unknown as { AudioContext: unknown }).AudioContext = vi.fn(function AudioContext() {
      return mockCtx;
    });
  });

  it("waits for the suspended audio context to resume before scheduling the completion beep", async () => {
    const { result } = renderHook(() => useSound());

    act(() => {
      result.current.initAudio();
    });

    let playSettled = false;
    const playPromise = act(async () => {
      await result.current.playTimerComplete();
      playSettled = true;
    });

    // Still suspended — must not schedule oscillators yet.
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    expect(playSettled).toBe(false);

    resolveResume();
    await playPromise;

    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(playSettled).toBe(true);
  });
});
