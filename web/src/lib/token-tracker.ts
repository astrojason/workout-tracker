// Shared daily token budget, tracked by the same service articles.astrojason.com uses
// (see its INTEGRATION.md): check usage before an AI call, report prompt + completion
// tokens after. Advisory only, and fails open so an unreachable tracker never blocks a call.
const TOKEN_TRACKER_URL = "https://token-tracker-roan.vercel.app/api/tokens";
export const DAILY_TOKEN_LIMIT = 250_000;

export async function checkTokenLimit(): Promise<void> {
  let tokens: number;
  try {
    const res = await fetch(TOKEN_TRACKER_URL);
    tokens = ((await res.json()) as { tokens: number }).tokens;
  } catch {
    return; // non-critical: tracker unreachable or malformed — fail open
  }
  if (typeof tokens === "number" && tokens >= DAILY_TOKEN_LIMIT) {
    throw new Error(`Daily token limit reached (${tokens.toLocaleString()} / ${DAILY_TOKEN_LIMIT.toLocaleString()})`);
  }
}

export async function reportTokens(count: number): Promise<void> {
  try {
    await fetch(TOKEN_TRACKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: count }),
    });
  } catch {
    // non-critical: the tracker is advisory, so a failed report must not fail the coach call
  }
}
