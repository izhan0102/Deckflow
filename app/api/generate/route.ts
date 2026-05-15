import { NextRequest, NextResponse } from "next/server";
import { generateDeck } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json({ error: err?.message || "Generation failed." }, { status: 500 });
  }
}
