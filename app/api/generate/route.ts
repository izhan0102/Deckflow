import { NextRequest, NextResponse } from "next/server";
import { generateDeck } from "@/lib/groq";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const uid = await authenticateRequest(req);
    const body = await req.json();
    const { prompt, slideCount, audience, tone, theme, density, includeReferences } = body || {};

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return NextResponse.json({ error: "Prompt is required (min 5 chars)." }, { status: 400 });
    }

    const count = Math.min(20, Math.max(3, Number(slideCount) || 8));

    const deck = await generateDeck({
      prompt: prompt.trim(),
      slideCount: count,
      audience,
      tone,
      density,
      includeReferences,
    });

    deck.topic = prompt.trim();
    deck.audience = audience;
    deck.tone = tone;
    deck.density = density;

    return NextResponse.json({ deck, theme });
  } catch (err: any) {
    console.error("[/api/generate] error:", err);
    const status = Number(err?.status || err?.statusCode || 0);
    const msg = String(err?.message || err?.error?.message || "Generation failed.").trim();
    let code = "unknown";
    if (err instanceof AuthError) {
      code = "user_auth";
    } else if (status === 429 || /rate.?limit|quota/i.test(msg)) {
      code = "rate_limit";
    } else if (status === 401 || status === 403 || /invalid.api.key|unauthorized/i.test(msg)) {
      code = "auth";
    } else if (/json|parse|invalid/i.test(msg)) {
      code = "parse";
    }
    return NextResponse.json({ error: msg, code }, { status: status || 500 });
  }
}
