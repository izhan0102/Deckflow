import { NextRequest, NextResponse } from "next/server";
import { generateDeck, generateDeckFromContent } from "@/lib/groq";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    const body = await req.json();
    const { prompt, slideCount, audience, tone, density, includeReferences, directives, sourceText } = body || {};
    const validDensities = ["brief", "normal", "detailed"];

    if (
      density &&
      (typeof density !== "string" || !validDensities.includes(density))
    ) {
      return NextResponse.json(
        {
          error: "density must be one of: brief, normal, detailed",
        },
        { status: 400 }
      );
    }

    const sanitizedAudience =
      typeof audience === "string"
        ? audience.trim().slice(0, 100)
        : "";

    const sanitizedTone =
      typeof tone === "string"
        ? tone.trim().slice(0, 50)
        : "";

    const sanitizedDensity = density || "normal";

    const sanitizedDirectives =
      typeof directives === "string"
        ? directives.trim().slice(0, 1000)
        : "";

    const sanitizedIncludeReferences = Boolean(includeReferences);

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
        audience: sanitizedAudience,
        tone: sanitizedTone,
        density: sanitizedDensity,
        includeReferences: sanitizedIncludeReferences,
        directives: sanitizedDirectives,
        maxSlides,
      });
      deck.topic = (typeof prompt === "string" && prompt.trim()) || deck.title;
    } else {
      const count = Math.min(20, Math.max(3, Number(slideCount) || 8));
      deck = await generateDeck({
        prompt: prompt.trim(),
        slideCount: count,
        audience: sanitizedAudience,
        tone: sanitizedTone,
        density: sanitizedDensity,
        includeReferences: sanitizedIncludeReferences,
        directives: sanitizedDirectives,
      });
      deck.topic = prompt.trim();
    }

    deck.audience = sanitizedAudience;
    deck.tone = sanitizedTone;
    deck.density = sanitizedDensity;

    return NextResponse.json({ deck });
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
