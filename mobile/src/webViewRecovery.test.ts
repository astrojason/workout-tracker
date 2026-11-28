import { describe, expect, it, vi } from "vitest";
import { recoverFromKilledPage } from "./webViewRecovery";

describe("recoverFromKilledPage", () => {
  it("reloads the page and shows the loading screen when iOS kills the web content process", () => {
    const reload = vi.fn();
    const setLoading = vi.fn();
    recoverFromKilledPage({ reload }, setLoading);
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(reload).toHaveBeenCalledOnce();
  });
});
