import { describe, expect, it } from "vitest";
import { parseMessage, replyScript, restNotificationContent } from "./messages";

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
