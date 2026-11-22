import { describe, expect, it } from "vitest";
import { parseMessage, replyScript, restNotificationContent, WEB_ERROR_HOOK } from "./messages";

describe("parseMessage", () => {
  it("parses a typed message", () => {
    expect(parseMessage('{"id":1,"type":"x"}')).toEqual({ id: 1, type: "x" });
  });
  it("throws on malformed input instead of ignoring it", () => {
    expect(() => parseMessage("{}")).toThrow(/Malformed/);
    expect(() => parseMessage("nope")).toThrow();
  });
});

describe("replyScript", () => {
  it("calls the web reply hook with a JSON-safe value", () => {
    expect(replyScript(3, true, { a: "x'" })).toContain('window.__nativeReply(3, true, {"a":"x\'"})');
    expect(replyScript(4, false, "boom")).toContain('(4, false, "boom")');
  });
});

describe("restNotificationContent", () => {
  it("names the next set", () => {
    expect(restNotificationContent({ nextLabel: "Next Set", nextDetail: "Bench - Set 2" } as never).body).toBe("Next Set: Bench - Set 2");
  });
  it("falls back when there is no next step", () => {
    expect(restNotificationContent({ nextLabel: "", nextDetail: "" } as never).body).toBe("Time for your next set.");
  });
});

describe("WEB_ERROR_HOOK", () => {
  function run() {
    const sent: string[] = [];
    const listeners: Record<string, (e: unknown) => void> = {};
    const consoleError = () => undefined;
    const win = {
      ReactNativeWebView: { postMessage: (m: string) => sent.push(m) },
      addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; },
      console: { error: consoleError },
    } as Record<string, unknown>;
    new Function("window", "console", WEB_ERROR_HOOK)(win, win.console);
    return { sent, listeners, win };
  }

  it("reports uncaught page errors to native", () => {
    const { sent, listeners } = run();
    listeners.error({ message: "boom", filename: "a.js", lineno: 3, error: { stack: "stack" } });
    expect(JSON.parse(sent[0])).toMatchObject({ type: "webError" });
    expect(JSON.parse(sent[0]).payload).toContain("boom");
  });

  it("reports unhandled promise rejections", () => {
    const { sent, listeners } = run();
    listeners.unhandledrejection({ reason: { message: "nope", stack: "s" } });
    expect(JSON.parse(sent[0]).payload).toContain("nope");
  });

  it("reports console.error calls", () => {
    const { sent, win } = run();
    (win.console as { error: (...a: unknown[]) => void }).error("bad", 1);
    expect(JSON.parse(sent[0]).payload).toContain("bad");
  });
});
