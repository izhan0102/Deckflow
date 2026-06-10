import { NextRequest, NextResponse } from "next/server";
import type { Deck } from "@/lib/types";
import { generateSpeakerNotes } from "@/lib/groq";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireFeature, PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate spoken speaker notes for an entire deck.
 *
 * The editor sends the current deck; we return one script per slide index.
 * The client folds each script into the matching slide's `notes` field,
 * which then flows through to PPTX speaker notes and the presenter
 * teleprompter. Auth + rate-limited like the other AI routes.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("speaker-notes");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireFeature(uid, "speakerNotes");
    const { deck, audience, tone, speakers, setting } = (await req.json()) as {
      deck: Deck;
      audience?: string;
      tone?: string;
      speakers?: string[];
      setting?: string;
    };

    if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0) {
      return NextResponse.json({ error: "A deck with slides is required." }, { status: 400 });
    }

    const notes = await generateSpeakerNotes({ deck, audience, tone, speakers, setting });
    return NextResponse.json({ notes });
  } catch (err: any) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[/api/speaker-notes] error:", err);
    return NextResponse.json({ error: err?.message || "Could not generate notes." }, { status: 500 });
  }
}
