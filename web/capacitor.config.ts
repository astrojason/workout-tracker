import type { CapacitorConfig } from "@capacitor/cli";

// The app depends on Next.js API routes (/api/coach, /api/equipment-photo), so the iOS shell
// loads the deployed site rather than a static export. Set CAP_SERVER_URL before `cap sync`.
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.astrojason.workouttracker",
  appName: "Workout Tracker",
  webDir: "cap-www",
  ...(serverUrl ? { server: { url: serverUrl, cleartext: serverUrl.startsWith("http://") } } : {}),
  plugins: {
    FirebaseAuthentication: { skipNativeAuth: true, providers: ["google.com"] },
  },
};

export default config;
