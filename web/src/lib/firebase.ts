import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator, signInWithCustomToken } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true (see package.json's *:emulator
// scripts) to point this app at a local Firestore/Auth emulator instead of the
// real project — used to dry-run the exercise-library migration and the app's
// post-migration behavior against disposable data before touching production.
const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

// "demo-" is a reserved Firebase emulator project id prefix: the SDKs refuse to
// let it resolve to any real Google Cloud project, so emulator mode can never
// accidentally fall through to production even if something is misconfigured.
const EMULATOR_PROJECT_ID = "demo-workout-tracker-emulator";

const firebaseConfig = useEmulator
  ? {
      apiKey: "demo-emulator-key",
      authDomain: "localhost",
      projectId: EMULATOR_PROJECT_ID,
      storageBucket: `${EMULATOR_PROJECT_ID}.appspot.com`,
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:0000000000000000000000",
    }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

if (useEmulator) {
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  } catch {
    // non-critical: Next.js Fast Refresh can re-evaluate this module in dev,
    // and connect*Emulator throws if already connected on the same instance.
  }

  // Emulator-only escape hatch for signing in without real Google OAuth (which
  // doesn't work against the Auth emulator): from the browser console,
  // `await window.__emulatorSignIn(token)` with a token minted by
  // `npm run mint-token:emulator -- <uid>`. Never reachable outside emulator mode.
  if (typeof window !== "undefined") {
    (window as unknown as { __emulatorSignIn: (token: string) => Promise<unknown> }).__emulatorSignIn =
      (token: string) => signInWithCustomToken(auth, token);
  }
}
