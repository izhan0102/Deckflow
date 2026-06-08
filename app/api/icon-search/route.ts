import { NextRequest, NextResponse } from "next/server";
import { searchIconify } from "@/lib/iconify";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

/**
 * Lightweight proxy to Iconify search. The browser hits this so we can
 * cache results server-side and avoid CORS surprises.
 */
export async function GET(req: NextRequest) {
  try {
    await authenticateRequest(req);

    const q = req.nextUrl.searchParams.get("q") || "";
    const limit = Math.min(60, Math.max(8, Number(req.nextUrl.searchParams.get("limit") || 32)));
    if (!q.trim()) return NextResponse.json({ icons: [] });
    const icons = await searchIconify(q, limit);
    return NextResponse.json({ icons });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("[/api/icon-search] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
