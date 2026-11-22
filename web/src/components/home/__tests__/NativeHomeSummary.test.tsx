import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { NativeHomeSummary } from "../NativeHomeSummary";
import type { HomeSummary } from "@/lib/home-summary";

const showError = vi.fn();
vi.mock("@/components/providers/ErrorProvider", () => ({ useError: () => ({ showError }) }));

const summary: HomeSummary = {
  date: "2026-11-22",
  programs: [{ programName: "Reacher Build", dayLabel: "Sunday", exerciseCount: 6, done: false }],
  completedThisWeek: 3,
  plannedThisWeek: 5,
};

const postMessage = vi.fn();
const win = window as unknown as { ReactNativeWebView?: unknown };

beforeEach(() => { postMessage.mockReset(); showError.mockReset(); });
afterEach(() => { delete win.ReactNativeWebView; });

describe("NativeHomeSummary", () => {
  it("does nothing in a normal browser", () => {
    render(<NativeHomeSummary summary={summary} />);
    expect(postMessage).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it("posts the summary to the native app, and again only when it changes", () => {
    win.ReactNativeWebView = { postMessage };
    const { rerender } = render(<NativeHomeSummary summary={summary} />);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({ type: "homeSummary", payload: summary });

    rerender(<NativeHomeSummary summary={{ ...summary }} />); // same content
    expect(postMessage).toHaveBeenCalledTimes(1);

    rerender(<NativeHomeSummary summary={{ ...summary, completedThisWeek: 4 }} />);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it("shows the error when the native bridge throws", () => {
    win.ReactNativeWebView = { postMessage: () => { throw new Error("bridge down"); } };
    render(<NativeHomeSummary summary={summary} />);
    expect(showError).toHaveBeenCalledWith(expect.objectContaining({ message: "bridge down" }));
  });
});
