// lib/rateLimit.ts
//
// Lightweight in-memory, per-IP sliding-window rate limiter.
//
// IMPORTANT (production note): the store is an in-process Map, so on a
// serverless host like Vercel each cold start gets a fresh map and the
// limit only holds within a single warm instance. It still blunts a burst
// from one client hitting a warm instance, but it is NOT a durable,
// cross-instance limit. For that, swap `store` for Upstash/Redis behind
// the same `rateLimit()` signature — see TODO below.
// TODO(#6 follow-up): back this with Upstash/Redis for multi-instance prod.

import { headers } from "next/headers";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Per-route limits. The editor fires an edit-slide call on every AI chat
// edit and an export call per download, so those get more headroom than
// full deck generation, which is heavy and rare.
export type RateLimitRoute = "generate" | "edit-slide" | "export" | "speaker-notes" | "translate" | "qa-prep" | "clarify" | "redensify" | "visualize" | "pexels" | "analyse" | "exai";

const LIMITS: Record<RateLimitRoute, { windowMs: number; max: number }> = {
  generate:        { windowMs: 60_000, max: 8 },
  "edit-slide":    { windowMs: 60_000, max: 30 },
  export:          { windowMs: 60_000, max: 20 },
  // One whole-deck notes generation is comparable to a generate call.
  "speaker-notes": { windowMs: 60_000, max: 10 },
  // Translation makes several batched model calls per deck; keep it modest.
  translate:       { windowMs: 60_000, max: 6 },
  // Q&A prep + follow-up single-question answers; allow a few back-to-back.
  "qa-prep":       { windowMs: 60_000, max: 15 },
  // Clarify runs once per generation flow; a small burst allowance is fine.
  clarify:           { windowMs: 60_000, max: 10 },
  // Whole-deck density rewrite — heavy like generation, so keep it modest.
  redensify:       { windowMs: 60_000, max: 6 },
  // Chart/visual generation — a few back-to-back while exploring options.
  visualize:       { windowMs: 60_000, max: 20 },
  // Document analysis — heavy multi-doc calls; keep modest.
  analyse:         { windowMs: 60_000, max: 8 },
  // EX-AI assistant chat — short bursts of conversation.
  exai:            { windowMs: 60_000, max: 20 },
  // Image search (Pexels) — fired as the user types/paginates, so give it
  // generous headroom (the client debounces).
  pexels:          { windowMs: 60_000, max: 60 },
};

// Occasionally drop expired entries so the map can't grow unbounded on a
// long-lived instance. Cheap: only sweeps when the map gets sizeable.
function maybePrune(now: number) {
  if (store.size < 5000) return;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Check (and consume) one request for `route` from `ip`. Buckets are keyed
 * per route so activity on one endpoint doesn't exhaust another's budget.
 */
export function rateLimit(
  route: RateLimitRoute,
  ip: string,
): { allowed: boolean; retryAfter?: number } {
  const { windowMs, max } = LIMITS[route];
  const now = Date.now();
  const key = `${route}:${ip}`;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    maybePrune(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true };
}

/**
 * Resolve the client IP from request headers. `x-forwarded-for` is a
 * comma-separated list (client, proxy1, proxy2, …) — the first entry is
 * the originating client. Falls back to x-real-ip, then "unknown".
 */
export function clientIp(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || "unknown";
  return h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Convenience guard for route handlers. Returns a ready-to-return 429
 * Response when over the limit, or null when the request may proceed.
 */
export function rateLimitResponse(route: RateLimitRoute): Response | null {
  const { allowed, retryAfter } = rateLimit(route, clientIp());
  if (allowed) return null;
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down.", code: "rate_limit" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter ?? 60),
      },
    },
  );
}
