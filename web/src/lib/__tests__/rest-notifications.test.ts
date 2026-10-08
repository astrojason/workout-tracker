import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { notifyRestComplete, setRestNotificationsEnabled } from "../rest-notifications";

const showNotification = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  showNotification.mockClear();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("Notification", { permission: "granted" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue({}),
      ready: Promise.resolve({ showNotification }),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("rest notifications", () => {
  it("does not notify without explicit opt-in", async () => {
    await notifyRestComplete(() => true);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it("shows a rest completion notification when enabled", async () => {
    setRestNotificationsEnabled(true);
    await notifyRestComplete(() => true);
    expect(showNotification).toHaveBeenCalledWith("Rest complete", expect.objectContaining({ tag: "workout-rest-complete" }));
  });

  it("does not deliver after rest is cancelled during registration", async () => {
    setRestNotificationsEnabled(true);
    let current = true;
    const pending = notifyRestComplete(() => current);
    current = false;
    await pending;
    expect(showNotification).not.toHaveBeenCalled();
  });

  it("respects revoked permission and disabled preferences", async () => {
    setRestNotificationsEnabled(true);
    vi.stubGlobal("Notification", { permission: "denied" });
    await notifyRestComplete(() => true);
    expect(showNotification).not.toHaveBeenCalled();
    vi.stubGlobal("Notification", { permission: "granted" });
    const pending = notifyRestComplete(() => true);
    setRestNotificationsEnabled(false);
    await pending;
    expect(showNotification).not.toHaveBeenCalled();
  });
});
