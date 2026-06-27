import { NextRequest, NextResponse } from "next/server";
import { generateDeck, generateDeckFromContent } from "@/lib/groq";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { PlanLimitError } from "@/lib/planServer";
import { requireCredits, deductCredits } from "@/lib/credits";
import { rateLimitResponse } from "@/lib/rateLimit";
import { generationCacheKey, getCachedDeck, setCachedDeck, invalidateCachedDeck } from "@/lib/generationCache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    // Hard, non-bypassable credit gate. Throws PlanLimitError (402,
    // "no_credits") when the balance is exhausted.
    await requireCredits(uid);
    const body = await req.json();
    const { prompt, slideCount, audience, tone, density, includeReferences, directives, sourceText, regenerate } = body || {};

    // Import mode: the user pasted/uploaded their own content. Organize it
    // into slides rather than generating from a brief. A short prompt is
    // optional here (intent/audience hint), so we don't require it.
    const hasSource = typeof sourceText === "string" && sourceText.trim().length >= 40;

    if (!hasSource && (!prompt || typeof prompt !== "string" || prompt.trim().length < 5)) {
      return NextResponse.json({ error: "Prompt is required (min 5 chars)." }, { status: 400 });
    }

    let deck;
    // Tracks whether the deck was served from the generation cache (issue
    // #141) so the client can show a "from cache" indicator and monitoring
    // can compute a hit rate from the X-Generation-Cache response header.
    let fromCache = false;
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
      // Cache only the brief-based path. Import mode (sourceText) is handled
      // above and is intentionally never cached, since the pasted content can
      // be private to the user.
      const cacheKey = generationCacheKey({
        prompt: prompt.trim(), slideCount: count, audience, tone, density,
        includeReferences, directives: typeof directives === "string" ? directives : "",
      });

      // "Regenerate" bypasses and refreshes the cache, satisfying the
      // acceptance criterion that an explicit regenerate gets fresh output.
      const cached = regenerate ? null : getCachedDeck(cacheKey);
      if (cached) {
        deck = cached;
        fromCache = true;
      } else {
        if (regenerate) invalidateCachedDeck(cacheKey);
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
        deck.audience = audience;
        deck.tone = tone;
        deck.density = density;
        setCachedDeck(cacheKey, deck);
      }
    }

    deck.audience = audience;
    deck.tone = tone;
    deck.density = density;

    // Charge the generation against the user's credit balance (server-side).
    // We still charge on a cache hit: the cache saves our upstream API cost
    // and latency, but from the user's plan perspective a generation is a
    // generation — keeping the deduction preserves existing billing fairness
    // and prevents free unlimited decks by replaying an identical prompt.
    deductCredits(uid, "generateDeck").catch(() => {});

    return NextResponse.json(
      { deck, fromCache },
      { headers: { "X-Generation-Cache": fromCache ? "HIT" : "MISS" } },
    );
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
