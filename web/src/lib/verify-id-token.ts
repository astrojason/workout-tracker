// Confirms the caller is a signed-in user so a server-side OpenAI key can't be spent anonymously.
export async function verifyIdToken(idToken: string): Promise<boolean> {
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
  const url = useEmulator
    ? "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-emulator-key"
    : `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return res.ok;
}
