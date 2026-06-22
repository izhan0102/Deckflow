import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache — depends on the caller's IP

/**
 * Returns the visitor's 2-letter country code from the edge/CDN IP headers.
 * On Vercel this is `x-vercel-ip-country` (set automatically, no API key);
 * Cloudflare uses `cf-ipcountry`. Empty when undeterminable (e.g. localhost),
 * in which case the client falls back to its timezone/locale guess.
 */
export async function GET(req: NextRequest) {
  const country = (
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-country-code") ||
    ""
  ).toUpperCase();
  return NextResponse.json(
    { country: country && country !== "XX" ? country : "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
