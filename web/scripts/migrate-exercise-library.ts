// web/scripts/migrate-exercise-library.ts
//
// Manual, one-time migration: replaces each workout's embedded exercise metadata
// with a definitionId reference into a new global exercise library (see
// migrateToExerciseLibrary in src/lib/firestore.ts for the actual algorithm).
//
// This used to run automatically the first time the app loaded post-deploy, but
// that's unsafe: it can run against production data from a preview deployment,
// or before the rest of the app's code (which now REQUIRES every exercise to
// have a definitionId) is actually live. Running it here, deliberately, once,
// before deploying, avoids both problems.
//
// IMPORTANT ORDERING: run this BEFORE merging/deploying this branch to main.
// Once deployed, the app assumes migration has already happened — it will
// throw trying to resolve any exercise that still uses the old embedded shape.
//
// Against the Firestore EMULATOR (recommended dry run first): with `npm run
// emulators` running in another terminal, use `npm run migrate:exercise-library:emulator
// -- <uid>` — no service account needed; see scripts/seed-emulator.ts for
// representative test data and its printed test uid.
//
// Against PRODUCTION, setup:
//   1. Firebase Console -> Project Settings -> Service Accounts -> Generate new
//      private key. Save the JSON somewhere OUTSIDE this repo.
//   2. export GOOGLE_APPLICATION_CREDENTIALS=/path/to/that-file.json
//   3. Find your Firebase Auth uid (Firebase Console -> Authentication -> Users,
//      or check the browser devtools -> Application -> IndexedDB while signed in).
//
// Usage (from web/):
//   npm run migrate:exercise-library -- <your-uid>

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp as initializeAdminApp, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

const EMULATOR_PROJECT_ID = "demo-workout-tracker-emulator";

const __dirname = dirname(fileURLToPath(import.meta.url));

// This app's Firebase client config is only in NEXT_PUBLIC_* env vars in
// .env.local, which Next.js loads automatically but a standalone script does
// not — load it here so src/lib/firebase.ts picks up the right project.
function loadEnvLocal() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(`Missing ${envPath} — this script needs the same Firebase client config the app uses.`);
  }
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Usage: npm run migrate:exercise-library -- <your-firebase-uid>");
    process.exit(1);
  }

  // FIRESTORE_EMULATOR_HOST is the standard signal the Admin SDK itself already
  // watches for — reusing it here means one flag switches both the Admin SDK
  // (below) and the client SDK (src/lib/firebase.ts) into emulator mode.
  const useEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  if (useEmulator) {
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = "true";
    console.log(`Emulator mode (FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST}) — no real credentials needed.`);
  } else {
    loadEnvLocal();
  }

  // Admin SDK is used ONLY to mint a short-lived custom token for this one uid —
  // everything else runs through the normal client SDK (src/lib/firebase.ts,
  // src/lib/firestore.ts) under that user's own Firestore security rules, the
  // exact same code path and permissions as the signed-in app. This keeps the
  // migration's blast radius identical to what the app itself is allowed to do.
  if (useEmulator) {
    initializeAdminApp({ projectId: EMULATOR_PROJECT_ID });
  } else {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service account JSON key path (see this file's header comment).");
    }
    // cert() (loading the key file directly), not applicationDefault() — createCustomToken()
    // needs to sign locally with the key's own private key. applicationDefault() instead routes
    // signing through the IAM Service Account Credentials API, which most projects have never
    // enabled and which additionally requires the service account to hold the "Service Account
    // Token Creator" role on itself. Signing locally sidesteps both requirements.
    const serviceAccount = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
    initializeAdminApp({ credential: cert(serviceAccount) });
  }
  const customToken = await getAdminAuth().createCustomToken(uid);

  const { auth } = await import("../src/lib/firebase.js");
  const { signInWithCustomToken } = await import("firebase/auth");
  const { migrateToExerciseLibrary, updateSettings, getSettings } = await import("../src/lib/firestore.js");

  console.log(`Signing in as ${uid}...`);
  await signInWithCustomToken(auth, customToken);

  // Ensures the settings doc exists with full defaults before this script
  // touches it below — getSettings() creates it on first read if missing.
  // Skipping this and going straight to a merge-write would, for an account
  // that had never opened the app, create a doc containing ONLY
  // exerciseLibraryMigrated, missing currentWeeks/etc. and crashing the app.
  await getSettings(uid);

  console.log("Running migration (this may take a moment for large libraries)...");
  await migrateToExerciseLibrary(uid);
  await updateSettings(uid, { exerciseLibraryMigrated: true });

  console.log("Done. Every workout's exercises now reference the global exercise library.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
