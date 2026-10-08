const PREFERENCE_KEY = "restTimerNotifications";
let registrationPromise: Promise<ServiceWorkerRegistration> | undefined;

export function supportsRestNotifications(): boolean {
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

export async function notifyRestComplete(isCurrent: () => boolean): Promise<void> {
  if (!supportsRestNotifications() || !restNotificationsEnabled() || Notification.permission !== "granted") return;
  const registration = await prepareRestNotifications();
  // Permission, preference, or the workout can change while registration loads.
  if (!isCurrent() || !restNotificationsEnabled() || Notification.permission !== "granted") return;
  await registration.showNotification("Rest complete", {
    body: "Time for your next set. Tap to return to your workout.",
    tag: "workout-rest-complete",
  });
}
