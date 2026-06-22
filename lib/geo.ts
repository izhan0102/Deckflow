"use client";
/**
 * Currency auto-detection for checkout.
 *
 * Two layers:
 *  1. guessCurrencyFromLocale() — instant, offline, from the browser timezone
 *     and language (good enough on localhost and as an immediate default).
 *  2. fetchCurrencyFromIp() — authoritative, from the server's IP-geo header
 *     (Vercel/Cloudflare). Use it to confirm/correct the instant guess.
 *
 * India → INR, everywhere else → USD.
 */
export type DetectedCurrency = "USD" | "INR";

export function guessCurrencyFromLocale(): DetectedCurrency | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (/Kolkata|Calcutta/i.test(tz)) return "INR";
    const langs = (typeof navigator !== "undefined"
      ? (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""])
      : []
    ).join(",");
    if (/-IN\b/i.test(langs)) return "INR";
    if (tz) return "USD"; // we have a timezone and it isn't India
  } catch { /* ignore */ }
  return null;
}

export async function fetchCurrencyFromIp(): Promise<DetectedCurrency | null> {
  try {
    const res = await fetch("/api/geo", { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    const c = String(d?.country || "").toUpperCase();
    if (!c) return null;
    return c === "IN" ? "INR" : "USD";
  } catch {
    return null;
  }
}
