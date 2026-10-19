import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "./firebase";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

// Google rejects OAuth popups inside an embedded web view, so inside the iOS shell the
// Google ID token comes from the native SDK and is handed to the web Firebase SDK
// (skipNativeAuth), keeping a single Firebase session that Firestore and the API routes use.
export async function signInWithGoogleNative(): Promise<void> {
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("Native Google sign-in returned no ID token");
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export async function signOutNative(): Promise<void> {
  await FirebaseAuthentication.signOut();
}
