"use client";

import { useEffect, useState } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import {
  prepareRestNotifications, restNotificationsEnabled,
  setRestNotificationsEnabled, supportsRestNotifications,
} from "@/lib/rest-notifications";

export function RestNotificationControl() {
  const { showError } = useError();
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function refresh() {
      const available = supportsRestNotifications();
      setSupported(available);
      if (available) {
        setPermission(Notification.permission);
        setEnabled(restNotificationsEnabled() && Notification.permission === "granted");
      }
    }
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (enabled) {
        setRestNotificationsEnabled(false);
        setEnabled(false);
        return;
      }
      // Request directly from the click, before awaiting service worker setup.
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
      await prepareRestNotifications();
      setRestNotificationsEnabled(true);
      setEnabled(true);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-sm mx-auto text-sm text-gray-400">
      {supported && permission !== "denied" ? (
        <button type="button" onClick={toggle} disabled={busy} aria-pressed={enabled}
          className="text-indigo-300 hover:text-indigo-200 disabled:opacity-50">
          {busy ? "Enabling notifications…" : enabled ? "Turn off rest notifications" : "Enable rest notifications"}
        </button>
      ) : (
        <p>{permission === "denied"
          ? "Rest notifications are blocked. Allow notifications in your browser settings to enable them."
          : "Rest notifications aren’t available here. On iPhone or iPad, try adding this app to your Home Screen and opening it there."}</p>
      )}
      <p className="mt-2 text-xs">Keep the app open for rest alerts. Alerts may be delayed while your device is locked or the app is in the background.</p>
    </div>
  );
}
