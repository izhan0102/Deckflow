import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";

/**
 * Pexels image search proxy.
 *
 * Authenticated + rate-limited like the other AI routes. Reads
 * PEXELS_API_KEY server-side so the key never reaches the client. Powers
 * the editor's image drawer and the "related images" replace panel.
 */

export const runtime = "nodejs";
// Reads the Authorization header, so it can't be statically rendered.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = rateLimitResponse("pexels");
  if (limited) return limited;
  try {
    await authenticateRequest(req);

    const key = process.env.PEXELS_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Image search isn't configured." }, { status: 503 });
    }

    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ photos: [], total_results: 0, page: 1 });

    const perPage = Math.min(80, Math.max(1, Number(req.nextUrl.searchParams.get("per_page") || 24)));
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
    const orientation = req.nextUrl.searchParams.get("orientation") || "";

    const params = new URLSearchParams({ query: q, per_page: String(perPage), page: String(page) });
    if (orientation) params.set("orientation", orientation);

    const res = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: { Authorization: key },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Image search error (${res.status})` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[/api/pexels] error:", err);
    return NextResponse.json({ error: err?.message || "Image search failed." }, { status: 500 });
  }
}
