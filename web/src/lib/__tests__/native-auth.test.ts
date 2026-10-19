import { describe, it, expect, vi, beforeEach } from "vitest";

const isNativePlatform = vi.fn();
const nativeSignIn = vi.fn();
const signInWithCredential = vi.fn();
const credentialFn = vi.fn((idToken: string) => ({ idToken }));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => isNativePlatform() } }));
vi.mock("@capacitor-firebase/authentication", () => ({
  FirebaseAuthentication: { signInWithGoogle: (o: unknown) => nativeSignIn(o), signOut: vi.fn() },
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: { credential: (t: string) => credentialFn(t) },
  signInWithCredential: (...a: unknown[]) => signInWithCredential(...a),
}));
vi.mock("../firebase", () => ({ auth: { name: "auth" } }));

import { isNativeApp, signInWithGoogleNative } from "../native-auth";

beforeEach(() => vi.clearAllMocks());

describe("isNativeApp", () => {
  it("reflects Capacitor's platform check", () => {
    isNativePlatform.mockReturnValue(true);
    expect(isNativeApp()).toBe(true);
    isNativePlatform.mockReturnValue(false);
    expect(isNativeApp()).toBe(false);
  });
});

describe("signInWithGoogleNative", () => {
  it("gets a Google ID token natively and signs the web Firebase SDK in with it", async () => {
    nativeSignIn.mockResolvedValue({ credential: { idToken: "tok" } });
    await signInWithGoogleNative();
    expect(nativeSignIn).toHaveBeenCalledWith({ skipNativeAuth: true });
    expect(credentialFn).toHaveBeenCalledWith("tok");
    expect(signInWithCredential).toHaveBeenCalledWith({ name: "auth" }, { idToken: "tok" });
  });

  it("throws a clear error when the native sign-in returns no ID token", async () => {
    nativeSignIn.mockResolvedValue({ credential: null });
    await expect(signInWithGoogleNative()).rejects.toThrow(/ID token/);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });
});
