// The page owns the timer; service workers cannot reliably schedule local alarms.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const workout = windows.find((client) => new URL(client.url).pathname === "/");
    if (workout) return workout.focus();
    return self.clients.openWindow("/");
  })());
});
