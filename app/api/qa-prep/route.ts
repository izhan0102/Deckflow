import { NextRequest, NextResponse } from "next/server";
import type { Deck } from "@/lib/types";
import { generateQAPrep, answerDeckQuestion } from "@/lib/groq";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireFeature, PlanLimitError } from "@/lib/planServer";
import { requireCredits, deductCredits } from "@/lib/credits";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Q&A prep for a deck.
 *
 * Two modes:
 *  - No `question`: generate a set of likely audience questions with
 *    suggested answers.
 *  - With `question`: answer that one user-supplied question against the
 *    deck's content.
 *
 * Auth + rate-limited like the other AI routes.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("qa-prep");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireFeature(uid, "qaPrep");
    await requireCredits(uid);
    const { deck, question, audience, tone } = (await req.json()) as {
      deck: Deck;
      question?: string;
      audience?: string;
      tone?: string;
    };

    if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0) {
      return NextResponse.json({ error: "A deck with slides is required." }, { status: 400 });
    }

    if (typeof question === "string" && question.trim()) {
      const answer = await answerDeckQuestion({ deck, question, audience, tone });
      deductCredits(uid, "qaPrep").catch(() => {});
      return NextResponse.json({ answer });
    }

    const items = await generateQAPrep({ deck, audience, tone });
    deductCredits(uid, "qaPrep").catch(() => {});
    return NextResponse.json({ items });
  } catch (err: any) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[/api/qa-prep] error:", err);
    return NextResponse.json({ error: err?.message || "Could not prepare Q&A." }, { status: 500 });
  }
}
