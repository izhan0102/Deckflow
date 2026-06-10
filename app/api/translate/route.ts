import { NextRequest, NextResponse } from "next/server";
import type { Deck } from "@/lib/types";
import { translateDeck } from "@/lib/groq";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireFeature, PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Translate an entire deck into a target language. Only the user-visible
 * strings change — layout, theme, charts, and positions are preserved. The
 * client swaps in the returned deck. Auth + rate-limited like the other AI
 * routes.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("translate");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireFeature(uid, "translate");
    const { deck, targetLanguage } = (await req.json()) as {
      deck: Deck;
      targetLanguage: string;
    };

    if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0) {
      return NextResponse.json({ error: "A deck with slides is required." }, { status: 400 });
    }
    if (!targetLanguage || typeof targetLanguage !== "string" || !targetLanguage.trim()) {
      return NextResponse.json({ error: "A target language is required." }, { status: 400 });
    }

    const translated = await translateDeck({ deck, targetLanguage: targetLanguage.trim() });
    return NextResponse.json({ deck: translated });
  } catch (err: any) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[/api/translate] error:", err);
    return NextResponse.json({ error: err?.message || "Could not translate deck." }, { status: 500 });
  }
}
