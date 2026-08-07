// web/scripts/mint-emulator-token.ts
//
// Prints a short-lived custom auth token for a uid in the Auth emulator, so you
// can sign in to the app (running via `npm run dev:emulator`) without real
// Google OAuth, which doesn't work against the emulator. In the browser
// console on the running app:
//   await window.__emulatorSignIn("<token printed below>")
//
// Usage (from web/, with `npm run emulators` already running):
//   npm run mint-token:emulator -- test-user-1

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Usage: npm run mint-token:emulator -- <uid>");
    process.exit(1);
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error("This only makes sense against the emulator. Run via `npm run mint-token:emulator`.");
    process.exit(1);
  }

  initializeApp({ projectId: "demo-workout-tracker-emulator" });
  const token = await getAuth().createCustomToken(uid);
  console.log(token);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
