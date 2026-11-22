import type { ExpoConfig } from "expo/config";

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
    appleTeamId: process.env.APPLE_TEAM_ID,
    config: { usesNonExemptEncryption: false },
  },
  plugins: [
    ["@react-native-google-signin/google-signin", { iosUrlScheme }],
    "expo-dev-client",
    "expo-notifications",
    "expo-live-activity",
    ["expo-splash-screen", { image: "./assets/icon.png", backgroundColor: "#111827", imageWidth: 160 }],
    "expo-status-bar",
    "@bacons/apple-targets",
  ],
};

export default config;
