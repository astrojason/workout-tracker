import { NextResponse } from "next/server";
import {
  COACH_SYSTEM_PROMPT, COACH_TOOL, buildCoachPrompt, parseOpenAIToolCall, validateCoachResponse,
} from "@/lib/coach";
import type { CoachInput } from "@/lib/coach";
import { checkTokenLimit, reportTokens } from "@/lib/token-tracker";
import { verifyIdToken } from "@/lib/verify-id-token";

const MODEL = "gpt-4o-mini";

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server" }, { status: 500 });
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

  try {
    await checkTokenLimit();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 429 });
  }

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        { role: "user", content: buildCoachPrompt(input) },
      ],
      tools: [COACH_TOOL],
      tool_choice: { type: "function", function: { name: COACH_TOOL.function.name } },
    }),
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ error: `OpenAI API error ${upstream.status}: ${text}` }, { status: 502 });
  }

  try {
    const { args, tokensUsed } = parseOpenAIToolCall(await upstream.json());
    await reportTokens(tokensUsed);
    const known = [
      ...input.sets.map((s) => s.exerciseName),
      ...input.upcoming.flatMap((u) => u.exercises.map((e) => e.name)),
    ];
    return NextResponse.json(validateCoachResponse(args, [...new Set(known)]));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
