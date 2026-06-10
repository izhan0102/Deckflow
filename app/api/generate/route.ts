import { NextRequest, NextResponse } from "next/server";
import { generateDeck, generateDeckFromContent } from "@/lib/groq";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireDeckAllowance, incrementMonthlyGenerationsServer, PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    // Hard, non-bypassable monthly deck limit by plan. Throws PlanLimitError
    // (402) when the allowance is used up.
    await requireDeckAllowance(uid);
    const body = await req.json();
    const { prompt, slideCount, audience, tone, density, includeReferences, directives, sourceText } = body || {};

    // Import mode: the user pasted/uploaded their own content. Organize it
    // into slides rather than generating from a brief. A short prompt is
    // optional here (intent/audience hint), so we don't require it.
    const hasSource = typeof sourceText === "string" && sourceText.trim().length >= 40;

    if (!hasSource && (!prompt || typeof prompt !== "string" || prompt.trim().length < 5)) {
      return NextResponse.json({ error: "Prompt is required (min 5 chars)." }, { status: 400 });
    }

    let deck;
    if (hasSource) {
      // Let the AI decide the count; cap it relative to the requested size so
      // a user who asked for ~8 doesn't get 30, but long content can expand.
      const requested = Math.min(20, Math.max(3, Number(slideCount) || 0));
      const maxSlides = requested ? Math.max(requested, 12) : 0;
      deck = await generateDeckFromContent({
        sourceText: sourceText.trim(),
        prompt: typeof prompt === "string" ? prompt.trim() : "",
        audience,
        tone,
        density,
        includeReferences,
        directives: typeof directives === "string" ? directives : "",
        maxSlides,
      });
      deck.topic = (typeof prompt === "string" && prompt.trim()) || deck.title;
    } else {
      const count = Math.min(20, Math.max(3, Number(slideCount) || 8));
      deck = await generateDeck({
        prompt: prompt.trim(),
        slideCount: count,
        audience,
        tone,
        density,
        includeReferences,
        directives: typeof directives === "string" ? directives : "",
      });
      deck.topic = prompt.trim();
    }

    deck.audience = audience;
    deck.tone = tone;
    deck.density = density;

    // Count the successful generation against the monthly allowance.
    // Server-side so it can't be skipped by a crafted client.
    incrementMonthlyGenerationsServer(uid).catch(() => {});

    return NextResponse.json({ deck });
  } catch (err: any) {
    console.error("[/api/generate] error:", err);
    const status = Number(err?.status || err?.statusCode || 0);
    const msg = String(err?.message || err?.error?.message || "Generation failed.").trim();
    let code = "unknown";
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    } else if (err instanceof AuthError) {
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
