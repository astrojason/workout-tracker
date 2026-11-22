import { test, expect } from "@playwright/test";
import { pullUpWorkout } from "../fixtures/workout-fixtures";

// Simulates the iOS app's WebView: a ReactNativeWebView bridge that records messages.
test("posts rest state to the native app and answers the permission request", async ({ page }) => {
  await page.addInitScript((workout) => {
    const w = window as unknown as { __sent: Array<{ id?: number; type: string; payload: unknown }>; ReactNativeWebView: unknown; __nativeReply: (id: number, ok: boolean, v: unknown) => void };
    w.__sent = [];
    w.ReactNativeWebView = {
      postMessage: (m: string) => {
        const msg = JSON.parse(m);
        w.__sent.push(msg);
        if (msg.type === "notificationPermission") setTimeout(() => w.__nativeReply(msg.id, true, "granted"), 0);
      },
    };
    localStorage.setItem("activeWorkout", JSON.stringify({
      workout, resolvedWeights: {}, currentExerciseIndex: 0, currentSetNumber: 2, completedSets: [],
      isResting: true, restTimeRemaining: 60, startTime: new Date().toISOString(), prsAchieved: [],
    }));
    localStorage.setItem("activeWorkoutRestEnd", new Date(Date.now() + 60000).toISOString());
  }, pullUpWorkout);
  await page.goto("/");
  await page.getByRole("button", { name: "Enable rest notifications" }).click();
  await expect(page.getByRole("button", { name: "Turn off rest notifications" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sent: Array<{ type: string; payload: { restEndsAt: number | null } | null }> }).__sent
    .filter((m) => m.type === "workoutState").map((m) => m.payload?.restEndsAt != null))).toContain(true);
  await page.getByRole("button", { name: "Skip Rest" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sent: Array<{ type: string; payload: { restEndsAt: number | null } | null }> }).__sent
    .filter((m) => m.type === "workoutState").at(-1)?.payload?.restEndsAt)).toBeNull();
});
