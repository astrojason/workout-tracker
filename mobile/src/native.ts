import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { ExtensionStorage } from "@bacons/apple-targets";
import * as LiveActivity from "expo-live-activity";
import * as Notifications from "expo-notifications";
import { getIsPaired, getIsWatchAppInstalled, updateApplicationContext } from "react-native-watch-connectivity";
import { liveActivityState } from "./liveActivity";
import { APP_GROUP } from "./appGroup";
import { parseHomeSummary, restNotificationContent, type BridgeMessage, type WorkoutMirrorState } from "./messages";

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

const ACTIVITY_CONFIG: LiveActivity.LiveActivityConfig = {
  backgroundColor: "#111827",
  titleColor: "#FFFFFF",
  subtitleColor: "#C7D2FE",
  progressViewTint: "#818CF8",
  progressViewLabelColor: "#FFFFFF",
  timerType: "digital",
};

let activityId: string | undefined;
let activityUnavailableReported = false;

// Keeps one Live Activity (Lock Screen / Dynamic Island, and the watch's Smart Stack) in step
// with the workout: a countdown while resting, the current set otherwise, ended with the workout.
function syncLiveActivity(state: WorkoutMirrorState | null): void {
  if (state === null) {
    if (activityId) LiveActivity.stopActivity(activityId, { title: "Workout complete" });
    activityId = undefined;
    return;
  }
  const content = liveActivityState(state, Date.now());
  if (activityId) {
    LiveActivity.updateActivity(activityId, content);
    return;
  }
  activityId = LiveActivity.startActivity(content, ACTIVITY_CONFIG) ?? undefined;
  // startActivity returns undefined when Live Activities are off or unsupported. Say so once per
  // launch rather than on every set, so it isn't silent but doesn't bury the workout in banners.
  if (!activityId && !activityUnavailableReported) {
    activityUnavailableReported = true;
    throw new Error("Couldn't start the Live Activity. Check Settings > Workout Tracker > Live Activities is on (iOS 16.2 or later).");
  }
}

async function workoutState(state: WorkoutMirrorState | null): Promise<void> {
  // Each channel is independent; run all of them and report every failure rather than
  // letting the first one hide the rest.
  const results = await Promise.allSettled([
    state === null ? Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID) : scheduleRestNotification(state),
    mirrorToWatch(state),
    Promise.resolve().then(() => syncLiveActivity(state)),
  ]);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new Error(failures.map((f) => (f instanceof Error ? f.message : String(f))).join("\n"));
}

// Hands the home summary to the Home Screen widget through the shared app-group container.
function homeSummary(payload: unknown): void {
  const summary = parseHomeSummary(payload);
  new ExtensionStorage(APP_GROUP).set("homeSummary", JSON.stringify(summary));
  ExtensionStorage.reloadWidget("WorkoutWidget");
}

/** Runs one web → native request and returns the value for the web app's pending call. */
export async function handleMessage(message: BridgeMessage): Promise<unknown> {
  switch (message.type) {
    case "googleSignIn": return googleSignIn();
    case "googleSignOut": return GoogleSignin.signOut();
    case "notificationPermission": return notificationPermission();
    case "homeSummary": return homeSummary(message.payload);
    case "workoutState": return workoutState(message.payload as WorkoutMirrorState | null);
    default: throw new Error(`Unknown message type from the web app: ${message.type}`);
  }
}
