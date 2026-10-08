import { afterEach, describe, expect, it, vi } from "vitest";
import { checkTokenLimit, reportTokens, DAILY_TOKEN_LIMIT } from "../token-tracker";
import { parseOpenAIToolCall } from "../coach";

afterEach(() => vi.unstubAllGlobals());

describe("checkTokenLimit", () => {
  it("passes while usage is under the daily limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tokens: 1000 }) }));
    await expect(checkTokenLimit()).resolves.toBeUndefined();
  });

  it("throws with usage once the daily limit is reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tokens: DAILY_TOKEN_LIMIT }) }));
    await expect(checkTokenLimit()).rejects.toThrow(/daily token limit reached/i);
  });

  it("fails open when the tracker is unreachable or returns junk", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(checkTokenLimit()).resolves.toBeUndefined();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("bad json"); } }));
    await expect(checkTokenLimit()).resolves.toBeUndefined();
  });
});

describe("reportTokens", () => {
  it("posts the token count to the tracker", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await reportTokens(123);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("token-tracker"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ tokens: 123 }) }),
    );
  });

  it("never throws if the tracker is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(reportTokens(5)).resolves.toBeUndefined();
  });
});

describe("parseOpenAIToolCall", () => {
  const completion = (args: string) => ({
    choices: [{ message: { tool_calls: [{ function: { name: "submit_coaching", arguments: args } }] } }],
    usage: { prompt_tokens: 100, completion_tokens: 40 },
  });

  it("returns the tool arguments and total tokens used", () => {
    const r = parseOpenAIToolCall(completion('{"feedback":"ok","adjustments":[]}'));
    expect(r.args).toEqual({ feedback: "ok", adjustments: [] });
    expect(r.tokensUsed).toBe(140);
  });

  it("throws a clear error when there is no tool call or the arguments are not JSON", () => {
    expect(() => parseOpenAIToolCall({ choices: [{ message: {} }] })).toThrow(/tool call/i);
    expect(() => parseOpenAIToolCall(completion("not json"))).toThrow(/parse/i);
  });
});
