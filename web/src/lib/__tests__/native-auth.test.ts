import { beforeEach, describe, expect, it, vi } from "vitest";

const callNative = vi.fn();
const signInWithCredential = vi.fn();
const credentialFn = vi.fn((idToken: string) => ({ idToken }));

vi.mock("../native-bridge", () => ({ callNative: (...a: unknown[]) => callNative(...a), isNativeApp: () => true }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: { credential: (t: string) => credentialFn(t) },
  signInWithCredential: (...a: unknown[]) => signInWithCredential(...a),
}));
vi.mock("../firebase", () => ({ auth: { name: "auth" } }));

import { signInWithGoogleNative, signOutNative } from "../native-auth";

beforeEach(() => vi.clearAllMocks());

describe("signInWithGoogleNative", () => {
  it("gets a Google ID token from the native app and signs the web Firebase SDK in with it", async () => {
    callNative.mockResolvedValue({ idToken: "tok" });
    await signInWithGoogleNative();
    expect(callNative).toHaveBeenCalledWith("googleSignIn");
    expect(credentialFn).toHaveBeenCalledWith("tok");
    expect(signInWithCredential).toHaveBeenCalledWith({ name: "auth" }, { idToken: "tok" });
  });

  it("throws a clear error when the native sign-in returns no ID token", async () => {
    callNative.mockResolvedValue({ idToken: null });
    await expect(signInWithGoogleNative()).rejects.toThrow(/ID token/);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });
});

describe("signOutNative", () => {
  it("signs out of the native Google session", async () => {
    callNative.mockResolvedValue(undefined);
    await signOutNative();
    expect(callNative).toHaveBeenCalledWith("googleSignOut");
  });
});
