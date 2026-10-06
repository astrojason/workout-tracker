import { NextResponse } from "next/server";
import { COACH_SYSTEM_PROMPT, COACH_TOOL, buildCoachPrompt, validateCoachResponse } from "@/lib/coach";
import type { CoachInput } from "@/lib/coach";

const MODEL = "claude-sonnet-5-5";

// Confirms the caller is a signed-in user so the server-side Anthropic key can't be spent anonymously.
async function verifyIdToken(idToken: string): Promise<boolean> {
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

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token || !(await verifyIdToken(token))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let input: CoachInput;
  try {
    input = (await req.json()) as CoachInput;
  } catch (err) {
    return NextResponse.json({ error: `Invalid request body: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }
  if (!Array.isArray(input?.sets) || input.sets.length === 0) {
    return NextResponse.json({ error: "No sets to review" }, { status: 400 });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: COACH_SYSTEM_PROMPT,
      tools: [COACH_TOOL],
      tool_choice: { type: "tool", name: COACH_TOOL.name },
      messages: [{ role: "user", content: buildCoachPrompt(input) }],
    }),
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ error: `Anthropic API error ${upstream.status}: ${text}` }, { status: 502 });
  }

  const data = (await upstream.json()) as { content?: { type: string; input?: unknown }[] };
  const toolUse = data.content?.find((c) => c.type === "tool_use");
  const known = [
    ...input.sets.map((s) => s.exerciseName),
    ...input.upcoming.flatMap((u) => u.exercises.map((e) => e.name)),
  ];
  try {
    return NextResponse.json(validateCoachResponse(toolUse?.input, [...new Set(known)]));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
