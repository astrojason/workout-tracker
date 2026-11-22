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
