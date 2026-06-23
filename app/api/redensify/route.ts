import { NextRequest, NextResponse } from "next/server";
import type { Deck, ContentDensity } from "@/lib/types";
import { redensifyDeck } from "@/lib/groq";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireFeature, PlanLimitError } from "@/lib/planServer";
import { requireCredits, deductCredits } from "@/lib/credits";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Rewrite a whole deck at a new content density (concise / balanced /
 * detailed / comprehensive). Premium feature — gated on the "density" plan
 * flag. Only bullet content changes; layout, theme, charts, and structure
 * stay put.
 */

const VALID: ContentDensity[] = ["concise", "balanced", "detailed", "comprehensive"];

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("redensify");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireFeature(uid, "density");
    await requireCredits(uid);

    const { deck, density } = (await req.json()) as { deck: Deck; density: ContentDensity };
    if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0) {
      return NextResponse.json({ error: "A deck with slides is required." }, { status: 400 });
    }
    if (!VALID.includes(density)) {
      return NextResponse.json({ error: "Invalid density." }, { status: 400 });
    }

    const updated = await redensifyDeck({ deck, density });
    deductCredits(uid, "redensify").catch(() => {});
    return NextResponse.json({ deck: updated });
  } catch (err: any) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[/api/redensify] error:", err);
    return NextResponse.json({ error: err?.message || "Could not change density." }, { status: 500 });
  }
}
