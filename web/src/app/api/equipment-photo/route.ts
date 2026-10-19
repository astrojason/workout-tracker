import { NextResponse } from "next/server";
import {
  EQUIPMENT_SYSTEM_PROMPT, EQUIPMENT_TOOL, buildEquipmentPrompt, parseVisionToolCall, validateEquipmentAnalysis, sanitizeHint,
} from "@/lib/equipment-photo";
import type { EquipmentScanInput } from "@/lib/equipment-photo";
import { checkTokenLimit, reportTokens } from "@/lib/token-tracker";
import { verifyIdToken } from "@/lib/verify-id-token";

const MODEL = "gpt-4o-mini";
const MAX_IMAGE_CHARS = 6_000_000; // data-URL length; the client downscales well below this

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server" }, { status: 500 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token || !(await verifyIdToken(token))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let input: EquipmentScanInput;
  try {
    input = (await req.json()) as EquipmentScanInput;
  } catch (err) {
    return NextResponse.json({ error: `Invalid request body: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }
  const hint = sanitizeHint(input?.hint);
  const hasImage = typeof input?.image === "string";
  if (!hasImage && !hint) {
    return NextResponse.json({ error: "A photo or an exercise name is required" }, { status: 400 });
  }
  if (hasImage && !/^data:image\/(jpeg|png|webp);base64,/.test(input.image as string)) {
    return NextResponse.json({ error: "A JPEG, PNG or WebP photo is required" }, { status: 400 });
  }
  if (hasImage && (input.image as string).length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "Photo is too large" }, { status: 413 });
  }
  const history = Array.isArray(input.history) ? input.history.slice(0, 40) : [];

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
      temperature: 0.2,
      messages: [
        { role: "system", content: EQUIPMENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: buildEquipmentPrompt(history, hint, hasImage) },
            ...(hasImage ? [{ type: "image_url", image_url: { url: input.image, detail: "low" } }] : []),
          ],
        },
      ],
      tools: [EQUIPMENT_TOOL],
      tool_choice: { type: "function", function: { name: EQUIPMENT_TOOL.function.name } },
    }),
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ error: `OpenAI API error ${upstream.status}: ${text}` }, { status: 502 });
  }

  try {
    const { args, tokensUsed } = parseVisionToolCall(await upstream.json());
    await reportTokens(tokensUsed);
    return NextResponse.json(validateEquipmentAnalysis(args));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
