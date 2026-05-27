import { NextRequest, NextResponse } from "next/server";
import { generateDeck } from "@/lib/groq";

import { verifyToken } from "@/lib/firebaseAdmin";
import { isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(req, 5, 60000)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", code: "rate_limit" },
        { status: 429 }
      );
    }

    const uid = await verifyToken(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Quota check
    const today = new Date().toISOString().slice(0, 10);
    const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.replace(/\/$/, "");
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";
    
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && !uid.startsWith("local_") && idToken) {
      const qRes = await fetch(`${dbUrl}/usage/${uid}/${today}/generations.json?auth=${idToken}`);
      if (qRes.ok) {
        const count = await qRes.json();
        if (typeof count === "number" && count >= 3) {
          return NextResponse.json(
            { error: "You've used all 3 of today's free generations. Resets at UTC midnight." },
            { status: 429 }
          );
        }
      }
    }

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

    let nextCount = undefined;
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && !uid.startsWith("local_") && idToken) {
      try {
        const qRes = await fetch(`${dbUrl}/usage/${uid}/${today}/generations.json?auth=${idToken}`);
        let currentCount = 0;
        if (qRes.ok) {
          const val = await qRes.json();
          currentCount = typeof val === "number" ? val : 0;
        }
        nextCount = currentCount + 1;
        await fetch(`${dbUrl}/usage/${uid}/${today}.json?auth=${idToken}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generations: nextCount,
            lastAt: Date.now(),
          }),
        });
      } catch (quotaErr) {
        console.error("Failed to increment quota:", quotaErr);
      }
    }

    return NextResponse.json({ deck, theme, generations: nextCount });
  } catch (err: any) {
    console.error("[/api/generate] error:", err);
    const status = Number(err?.status || err?.statusCode || 0);
    const msg = String(err?.message || err?.error?.message || "Generation failed.").trim();
    let code = "unknown";
    if (status === 429 || /rate.?limit|quota/i.test(msg)) code = "rate_limit";
    else if (status === 401 || status === 403 || /invalid.api.key|unauthorized/i.test(msg)) code = "auth";
    else if (/json|parse|invalid/i.test(msg)) code = "parse";
    return NextResponse.json({ error: msg, code }, { status: status || 500 });
  }
}
