import type { ActiveSession } from "./types";
import { currentSetView } from "./inserted-set";

// The iOS app (mobile/) hosts this site in a React Native WebView. Web → native goes through
// ReactNativeWebView.postMessage; native → web replies by calling window.__nativeReply.

interface NativeWindow {
  ReactNativeWebView?: { postMessage: (message: string) => void };
  __nativeReply?: (id: number, ok: boolean, value: unknown) => void;
}

const nativeWindow = () => window as unknown as NativeWindow;

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Boolean(nativeWindow().ReactNativeWebView);
}

export function postNative(type: string, payload?: unknown): void {
  const view = typeof window !== "undefined" ? nativeWindow().ReactNativeWebView : undefined;
  if (!view) throw new Error("Not running inside the native app");
  view.postMessage(JSON.stringify({ type, payload }));
}

interface Pending { resolve: (value: never) => void; reject: (error: Error) => void }
const pending = new Map<number, Pending>();
let nextId = 1;

export function callNative<T = unknown>(type: string, payload?: unknown): Promise<T> {
  const view = typeof window !== "undefined" ? nativeWindow().ReactNativeWebView : undefined;
  if (!view) return Promise.reject(new Error("Not running inside the native app"));
  nativeWindow().__nativeReply = (id, ok, value) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (ok) entry.resolve(value as never);
    else entry.reject(new Error(typeof value === "string" ? value : JSON.stringify(value)));
  };
  return new Promise<T>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve: resolve as Pending["resolve"], reject });
    try {
      view.postMessage(JSON.stringify({ id, type, payload }));
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** What the iPhone app and the Apple Watch need to mirror the workout. */
export interface WorkoutMirrorState {
  exercise: string;
  set: number;
  sets: number;
  weight: number;
  restEndsAt: number | null; // epoch ms; null when not resting
  restSeconds: number;
  notify: boolean; // whether to post a "rest complete" notification
  nextLabel: string;
  nextDetail: string;
}

export function buildMirrorState(session: ActiveSession, now: number, notify: boolean): WorkoutMirrorState {
  const exercises = session.workout.exercises;
  const exercise = exercises[session.currentExerciseIndex];
  const completed = session.completedSets.filter((s) => s.exerciseOrder === exercise.order).length;

  let nextLabel = "";
  let nextDetail = "";
  if (exercise.sets - completed > 0) {
    nextLabel = "Next Set";
    nextDetail = `${exercise.name} - Set ${session.currentSetNumber}`;
  } else if (session.currentExerciseIndex < exercises.length - 1) {
    nextLabel = "Up Next";
    nextDetail = exercises[session.currentExerciseIndex + 1].name;
  }

  return {
    exercise: exercise.name,
    set: session.currentSetNumber,
    sets: exercise.sets,
    weight: currentSetView(session)?.weight ?? 0,
    restEndsAt: session.isResting ? now + session.restTimeRemaining * 1000 : null,
    restSeconds: exercise.restSeconds || 120,
    notify,
    nextLabel,
    nextDetail,
  };
}
