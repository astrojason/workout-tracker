import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as Notifications from "expo-notifications";
import { getIsPaired, getIsWatchAppInstalled, updateApplicationContext } from "react-native-watch-connectivity";
import { restNotificationContent, type BridgeMessage, type WorkoutMirrorState } from "./messages";

const REST_NOTIFICATION_ID = "rest-complete";

// While the app is open the web app already plays its own sound, so don't also show a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
if (iosClientId) GoogleSignin.configure({ iosClientId });

async function googleSignIn(): Promise<{ idToken: string | null }> {
  if (!iosClientId) throw new Error("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set; see mobile/.env.local.example.");
  const response = await GoogleSignin.signIn();
  if (response.type !== "success") throw new Error("Google sign-in was cancelled.");
  return { idToken: response.data.idToken };
}

async function notificationPermission(): Promise<"granted" | "denied"> {
  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? "granted" : (await Notifications.requestPermissionsAsync()).status;
  return status === "granted" ? "granted" : "denied";
}

async function scheduleRestNotification(state: WorkoutMirrorState): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);
  if (!state.notify || state.restEndsAt === null) return;
  const seconds = Math.ceil((state.restEndsAt - Date.now()) / 1000);
  if (seconds < 1) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) throw new Error("Rest notifications are turned on, but iOS notification permission is not granted.");
  await Notifications.scheduleNotificationAsync({
    identifier: REST_NOTIFICATION_ID,
    content: restNotificationContent(state),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

async function mirrorToWatch(state: WorkoutMirrorState | null): Promise<void> {
  // No paired watch or no watch app installed is a normal setup, not a failure.
  if (!(await getIsPaired()) || !(await getIsWatchAppInstalled())) return;
  updateApplicationContext(state ? { ...state, updatedAt: Date.now() } : { ended: true, updatedAt: Date.now() });
}

async function workoutState(state: WorkoutMirrorState | null): Promise<void> {
  if (state === null) await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);
  else await scheduleRestNotification(state);
  await mirrorToWatch(state);
}

/** Runs one web → native request and returns the value for the web app's pending call. */
export async function handleMessage(message: BridgeMessage): Promise<unknown> {
  switch (message.type) {
    case "googleSignIn": return googleSignIn();
    case "googleSignOut": return GoogleSignin.signOut();
    case "notificationPermission": return notificationPermission();
    case "workoutState": return workoutState(message.payload as WorkoutMirrorState | null);
    default: throw new Error(`Unknown message type from the web app: ${message.type}`);
  }
}
