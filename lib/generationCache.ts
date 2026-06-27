// lib/generationCache.ts
//
// Lightweight in-memory, TTL'd cache for AI deck generation results.
//
// Why this exists (issue #141): identical prompt + parameters previously
// triggered a fresh upstream LLM call every time, wasting API credits and
// adding latency. Popular briefs ("Introduction to React", "Machine Learning
// Basics") are requested repeatedly. Caching the generated deck keyed by a
// hash of the input parameters serves those repeats instantly and for free.
//
// IMPORTANT (production note): the store is an in-process Map, mirroring the
// same trade-off documented in lib/rateLimit.ts. On a serverless host each
// cold start gets a fresh map, so a cache entry only lives within a single
// warm instance. It still cuts cost/latency for bursts of identical requests
// on a warm instance. For a durable, cross-instance cache, swap `store` for
// Upstash/Redis behind the same get()/set() signatures — see TODO below.
// TODO(#141 follow-up): back this with Upstash/Redis for multi-instance prod.

import { createHash } from "crypto";
import type { Deck } from "@/lib/types";

type CacheEntry = {
  deck: Deck;
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();

// 24h default TTL, configurable via env so ops can tune freshness vs. savings
// without a redeploy. A value of 0 (or "off"/"false") disables caching.
function ttlMs(): number {
  const raw = process.env.GENERATION_CACHE_TTL_SECONDS;
  if (raw == null || raw === "") return 24 * 60 * 60 * 1000; // 24h
  if (/^(off|false|0)$/i.test(raw.trim())) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n * 1000 : 24 * 60 * 60 * 1000;
}

export function isCacheEnabled(): boolean {
  return ttlMs() > 0;
}

// Hard cap on entries so a long-lived warm instance can't grow unbounded.
// When exceeded we drop the oldest-inserted entry (Map preserves insertion
// order), giving a simple FIFO eviction on top of the TTL.
const MAX_ENTRIES = 500;

export type GenerationCacheKeyParts = {
  prompt: string;
  slideCount: number;
  audience?: string;
  tone?: string;
  density?: string;
  includeReferences?: boolean;
  directives?: string;
};

/**
 * Build a stable, collision-resistant cache key from the generation inputs.
 * Strings are trimmed and lower-cased so trivial differences ("React " vs
 * "react") still hit the same entry.
 */
export function generationCacheKey(parts: GenerationCacheKeyParts): string {
  const norm = [
    (parts.prompt || "").trim().toLowerCase(),
    String(parts.slideCount ?? ""),
    (parts.audience || "").trim().toLowerCase(),
    (parts.tone || "").trim().toLowerCase(),
    (parts.density || "").trim().toLowerCase(),
    parts.includeReferences ? "1" : "0",
    (parts.directives || "").trim().toLowerCase(),
  ].join("|");
  return "deck:" + createHash("sha256").update(norm).digest("hex").slice(0, 24);
}

/** Return a cached deck for `key`, or null on miss / expiry. */
export function getCachedDeck(key: string): Deck | null {
  if (!isCacheEnabled()) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.deck;
}

/** Store a freshly generated deck under `key` with the configured TTL. */
export function setCachedDeck(key: string, deck: Deck): void {
  const ttl = ttlMs();
  if (ttl <= 0) return;
  // FIFO evict the oldest entry when at capacity.
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { deck, expiresAt: Date.now() + ttl });
}

/** Explicitly drop a cached entry (used when the user forces a regenerate). */
export function invalidateCachedDeck(key: string): void {
  store.delete(key);
}
