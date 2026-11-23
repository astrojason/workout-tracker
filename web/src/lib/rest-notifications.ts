import { callNative, isNativeApp } from "./native-bridge";
import { weightAndReps, type NextSetSummary } from "./next-set";

const PREFERENCE_KEY = "restTimerNotifications";
let registrationPromise: Promise<ServiceWorkerRegistration> | undefined;

export function supportsRestNotifications(): boolean {
  if (isNativeApp()) return true;
  return typeof window !== "undefined" && window.isSecureContext &&
    "Notification" in window && "serviceWorker" in navigator;
}

export function restNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(PREFERENCE_KEY) === "1";
  } catch {
    // Storage can be disabled; notifications remain off in that case.
    return false;
  }
}

export function setRestNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(PREFERENCE_KEY, enabled ? "1" : "0");
}

export function prepareRestNotifications(): Promise<ServiceWorkerRegistration> {
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register("/rest-notifications-sw.js")
      .then(() => navigator.serviceWorker.ready)
      .catch((error) => {
        registrationPromise = undefined;
        throw error;
      });
  }
  return registrationPromise;
}

/** Asks for notification permission: through iOS in the native app, the browser otherwise. */
export async function requestRestPermission(): Promise<NotificationPermission> {
  if (isNativeApp()) return callNative<NotificationPermission>("notificationPermission");
  return Notification.requestPermission();
}

// "Next Set: Bench Press - Set 2 of 3" then "135 lb · 8–10 reps" on its own line.
export function restCompleteBody(next: NextSetSummary | null): string {
  if (!next) return "Time for your next set. Tap to return to your workout.";
  return `${next.label}: ${next.detail}\n${weightAndReps(next)}`;
}

/** `nextSet` is read when the rest ends, so it describes the set actually coming up. */
export async function notifyRestComplete(isCurrent: () => boolean, nextSet: () => NextSetSummary | null = () => null): Promise<void> {
  // The native app schedules its own notification from the mirrored workout state.
  if (isNativeApp()) return;
  if (!supportsRestNotifications() || !restNotificationsEnabled() || Notification.permission !== "granted") return;
  const registration = await prepareRestNotifications();
  // Permission, preference, or the workout can change while registration loads.
  if (!isCurrent() || !restNotificationsEnabled() || Notification.permission !== "granted") return;
  await registration.showNotification("Rest complete", {
    body: restCompleteBody(nextSet()),
    tag: "workout-rest-complete",
  });
}
