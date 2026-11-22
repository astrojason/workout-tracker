import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "./firebase";
import { callNative } from "./native-bridge";

export { isNativeApp } from "./native-bridge";

// Google rejects OAuth popups inside an embedded web view, so inside the iOS app the Google
// ID token comes from the native SDK and is handed to the web Firebase SDK, keeping a single
// Firebase session that Firestore and the API routes use.
export async function signInWithGoogleNative(): Promise<void> {
  const { idToken } = await callNative<{ idToken: string | null }>("googleSignIn");
  if (!idToken) throw new Error("Native Google sign-in returned no ID token");
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export async function signOutNative(): Promise<void> {
  await callNative("googleSignOut");
}
