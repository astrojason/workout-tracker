/** Shape of the web app's WorkoutMirrorState (web/src/lib/native-bridge.ts). */
export interface WorkoutMirrorState {
  exercise: string;
  set: number;
  sets: number;
  weight: number;
  restEndsAt: number | null;
  restSeconds: number;
  notify: boolean;
  nextLabel: string;
  nextDetail: string;
}

export interface BridgeMessage {
  id?: number;
  type: string;
  payload?: unknown;
}

export function parseMessage(raw: string): BridgeMessage {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || typeof (parsed as BridgeMessage).type !== "string") {
    throw new Error(`Malformed message from the web app: ${raw}`);
  }
  return parsed as BridgeMessage;
}

/** JS to run in the WebView to deliver a reply to the web app's pending callNative(). */
export function replyScript(id: number, ok: boolean, value: unknown): string {
  return `window.__nativeReply && window.__nativeReply(${id}, ${ok}, ${JSON.stringify(value ?? null)}); true;`;
}

export function restNotificationContent(state: WorkoutMirrorState): { title: string; body: string } {
  return {
    title: "Rest complete",
    body: state.nextDetail ? `${state.nextLabel}: ${state.nextDetail}` : "Time for your next set.",
  };
}

/**
 * Injected into the page before it loads so errors inside the web app (which would otherwise
 * leave a blank or frozen screen) reach the native error banner. Takes `window` and `console`
 * as parameters so it can be exercised in tests.
 */
export const WEB_ERROR_HOOK = `
(function (window, console) {
  function report(text) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "webError", payload: String(text) }));
  }
  function describe(error) {
    if (error && typeof error === "object") return (error.message || "") + "\\n" + (error.stack || "");
    return String(error);
  }
  window.addEventListener("error", function (e) {
    report("Page error: " + e.message + " (" + e.filename + ":" + e.lineno + ")\\n" + describe(e.error));
  });
  window.addEventListener("unhandledrejection", function (e) {
    report("Unhandled promise rejection: " + describe(e.reason));
  });
  var original = console.error;
  console.error = function () {
    report("console.error: " + Array.prototype.map.call(arguments, describe).join(" "));
    return original.apply(console, arguments);
  };
})(window, console);
true;
`;

/** Mirrors web/src/lib/home-summary.ts: what the Home Screen widget displays. */
export interface HomeSummary {
  date: string;
  programs: { programName: string; dayLabel: string | null; exerciseCount: number; done: boolean }[];
  completedThisWeek: number;
  plannedThisWeek: number;
}

export function parseHomeSummary(value: unknown): HomeSummary {
  const v = value as Partial<HomeSummary> | null;
  const validProgram = (p: unknown) => {
    const q = p as HomeSummary["programs"][number] | null;
    return !!q && typeof q.programName === "string" && (q.dayLabel === null || typeof q.dayLabel === "string")
      && typeof q.exerciseCount === "number" && typeof q.done === "boolean";
  };
  if (!v || typeof v.date !== "string" || typeof v.completedThisWeek !== "number" ||
      typeof v.plannedThisWeek !== "number" || !Array.isArray(v.programs) || !v.programs.every(validProgram)) {
    throw new Error(`Malformed home summary from the web app: ${JSON.stringify(value)}`);
  }
  return v as HomeSummary;
}
