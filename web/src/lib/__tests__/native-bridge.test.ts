import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildMirrorState, callNative, isNativeApp, postNative } from "../native-bridge";
import type { ActiveSession } from "../types";

const postMessage = vi.fn();

beforeEach(() => {
  postMessage.mockReset();
  vi.stubGlobal("window", { ReactNativeWebView: { postMessage } });
});
afterEach(() => vi.unstubAllGlobals());

function lastMessage() {
  return JSON.parse(postMessage.mock.calls.at(-1)![0]);
}

describe("isNativeApp", () => {
  it("is true only inside the React Native web view", () => {
    expect(isNativeApp()).toBe(true);
    vi.stubGlobal("window", {});
    expect(isNativeApp()).toBe(false);
  });
});

describe("postNative", () => {
  it("posts a typed JSON message", () => {
    postNative("ping", { a: 1 });
    expect(lastMessage()).toMatchObject({ type: "ping", payload: { a: 1 } });
  });

  it("throws outside the native app instead of dropping the message", () => {
    vi.stubGlobal("window", {});
    expect(() => postNative("ping")).toThrow(/native app/i);
  });
});

describe("callNative", () => {
  it("resolves with the native reply for its request id", async () => {
    const pending = callNative<string>("echo");
    const { id } = lastMessage();
    (window as unknown as { __nativeReply: (id: number, ok: boolean, v: unknown) => void }).__nativeReply(id, true, "hi");
    await expect(pending).resolves.toBe("hi");
  });

  it("rejects with the native error message", async () => {
    const pending = callNative("echo");
    const { id } = lastMessage();
    (window as unknown as { __nativeReply: (id: number, ok: boolean, v: unknown) => void }).__nativeReply(id, false, "boom");
    await expect(pending).rejects.toThrow("boom");
  });
});

describe("buildMirrorState", () => {
  const exercise = (id: string, name: string, sets: number) =>
    ({ id, name, order: 1, sets, restSeconds: 90 }) as unknown as ActiveSession["workout"]["exercises"][number];
  const session = (over: Partial<ActiveSession> = {}): ActiveSession => ({
    workout: { exercises: [exercise("a", "Bench Press", 3), exercise("b", "Row", 3)] } as unknown as ActiveSession["workout"],
    resolvedWeights: { a: 135, b: 100 },
    currentExerciseIndex: 0,
    currentSetNumber: 2,
    completedSets: [],
    isResting: false,
    restTimeRemaining: 0,
    startTime: new Date(0),
    prsAchieved: [],
    ...over,
  });

  it("describes the current set while lifting", () => {
    expect(buildMirrorState(session(), 1000, true)).toEqual({
      exercise: "Bench Press", set: 2, sets: 3, weight: 135,
      restEndsAt: null, restSeconds: 90, notify: true,
      nextLabel: "Next Set", nextDetail: "Bench Press - Set 2",
    });
  });

  it("includes the rest end time while resting", () => {
    const s = buildMirrorState(session({ isResting: true, restTimeRemaining: 60 }), 1000, false);
    expect(s.restEndsAt).toBe(61000);
    expect(s.notify).toBe(false);
  });

  it("previews the next exercise once the sets are done", () => {
    const s = buildMirrorState(session({
      isResting: true, restTimeRemaining: 30,
      completedSets: [{ exerciseOrder: 1 }, { exerciseOrder: 1 }, { exerciseOrder: 1 }] as ActiveSession["completedSets"],
    }), 0, true);
    expect(s).toMatchObject({ nextLabel: "Up Next", nextDetail: "Row" });
  });
});
