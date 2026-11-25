import type { ExpoConfig } from "expo/config";

// Shared container for the Home Screen widget. Keep in sync with src/appGroup.ts and
// targets/widget/ (app.config.ts can't import local files, so the value is repeated here).
const APP_GROUP = "group.com.astrojason.workout";

// Google's iOS URL scheme is the iOS client ID reversed. Both come from the iOS app's
// GoogleService-Info.plist (CLIENT_ID / REVERSED_CLIENT_ID); see .env.local.example.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const iosUrlScheme = iosClientId.split(".").reverse().join(".");

const config: ExpoConfig = {
  name: "Workout Tracker",
  slug: "workout-tracker",
  scheme: "workouttracker",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.astrojason.workout",
    supportsTablet: false,
    // `expo prebuild --clean` regenerates ios/, so the signing team (for the app and its Watch,
    // widget and Live Activity targets) has to come from here.
    appleTeamId: "68T36GK536",
    config: { usesNonExemptEncryption: false },
    entitlements: { "com.apple.security.application-groups": [APP_GROUP] },
  },
  plugins: [
    ["@react-native-google-signin/google-signin", { iosUrlScheme }],
    "expo-dev-client",
    "expo-notifications",
    "expo-live-activity",
    "@bacons/apple-targets",
    ["expo-splash-screen", { image: "./assets/icon.png", backgroundColor: "#111827", imageWidth: 160 }],
    "expo-status-bar",
  ],
};

export default config;
