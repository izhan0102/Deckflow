/**
 * Share-link view analytics.
 *
 * When someone opens a public /share/{shareId} link we log anonymous,
 * aggregate activity so the deck owner can see how their deck performed:
 *   - how many times it was opened
 *   - how many times each slide was viewed
 *   - total time spent on each slide (so we can show average dwell)
 *
 * This is intentionally NOT per-visitor tracking. We store only running
 * counters keyed by shareId — no visitor ids, no IPs, no PII — so it's
 * privacy-clean and needs no consent banner.
 *
 * RTDB layout:
 *   /analytics/{shareId}
 *     opens:         number              // total deck opens
 *     lastViewedAt:  number (serverTs)   // most recent open
 *     slides:
 *       {slideIndex}:
 *         views:     number              // times this slide was on screen
 *         ms:        number              // total ms spent on this slide
 *
 * Required Firebase rules (add alongside the existing ones). Open write
 * so anonymous viewers can log, open read so the owner dashboard can
 * display. Only aggregate counters live here, nothing sensitive:
 *   "analytics": {
 *     ".read": true,
 *     "$shareId": { ".write": true }
 *   }
 */

import { ref, update, get, child, increment, serverTimestamp } from "firebase/database";
import { getFirebaseDb } from "./firebase";

export type ShareAnalytics = {
  opens: number;
  lastViewedAt?: number;
  slides: Record<string, { views: number; ms: number }>;
};

/** Log one deck open. Called once when a share link is viewed. */
export async function trackShareOpen(shareId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !shareId) return;
  try {
    await update(ref(db, `analytics/${shareId}`), {
      opens: increment(1),
      lastViewedAt: serverTimestamp(),
    });
  } catch { /* analytics is best-effort — never block the viewer */ }
}

/**
 * Log time spent on a single slide. Called when the viewer moves off a
 * slide (or hides the tab). Ignores sub-300ms flicks and caps a single
 * dwell at 5 minutes so an idle tab left open doesn't skew the numbers.
 */
export async function trackSlideTime(
  shareId: string, slideIndex: number, ms: number,
): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !shareId || slideIndex < 0) return;
  if (ms < 300) return;
  const capped = Math.min(Math.round(ms), 5 * 60 * 1000);
  try {
    await update(ref(db, `analytics/${shareId}/slides/${slideIndex}`), {
      views: increment(1),
      ms: increment(capped),
    });
  } catch { /* best-effort */ }
}

/** Read the aggregate analytics for a share link (owner-facing). */
export async function loadShareAnalytics(shareId: string): Promise<ShareAnalytics | null> {
  const db = getFirebaseDb();
  if (!db || !shareId) return null;
  try {
    const snap = await get(child(ref(db), `analytics/${shareId}`));
    if (!snap.exists()) return null;
    const v = snap.val() || {};
    const slides: Record<string, { views: number; ms: number }> = {};
    if (v.slides && typeof v.slides === "object") {
      for (const [k, raw] of Object.entries<any>(v.slides)) {
        slides[k] = {
          views: typeof raw?.views === "number" ? raw.views : 0,
          ms: typeof raw?.ms === "number" ? raw.ms : 0,
        };
      }
    }
    return {
      opens: typeof v.opens === "number" ? v.opens : 0,
      lastViewedAt: typeof v.lastViewedAt === "number" ? v.lastViewedAt : undefined,
      slides,
    };
  } catch {
    return null;
  }
}

/** Pretty "2m 13s" / "47s" formatter for dwell times. */
export function formatDwell(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}
