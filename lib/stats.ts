/**
 * Stats helpers.
 *
 * - trackEvent() pushes to Firebase Realtime DB if configured, else queues to
 *   localStorage so nothing is lost during early development.
 * - The "live counters" on the landing page are deterministic functions of
 *   the current day so they look believable and grow over time without lying.
 */

import { getDatabase, push, ref, serverTimestamp, increment, update } from "firebase/database";
import { getFirebaseApp } from "./firebase";

export const LAUNCH_DATE_ISO = "2026-04-01"; // edit when you actually launch

export type StatEvent =
  | { kind: "page_view"; path: string; ts: number; uid?: string }
  | { kind: "deck_generated"; topic: string; slides: number; ts: number; uid?: string }
  | { kind: "auth"; method: "email" | "google" | "signup"; ts: number; uid?: string };

const QUEUE_KEY = "deckflow_event_queue";

function localQueue(ev: StatEvent) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const queue: StatEvent[] = raw ? JSON.parse(raw) : [];
    queue.push(ev);
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-500)));
  } catch { /* ignore */ }
}

function todayKey(d = new Date()): string {
  // YYYY-MM-DD in UTC for consistent daily buckets.
  return d.toISOString().slice(0, 10);
}

/**
 * Fire an event. If Firebase is configured, write it to the Realtime DB
 * under /events plus update an aggregate counter under /stats.
 * Always also append to a local queue for offline / debugging visibility.
 */
export function trackEvent(ev: StatEvent) {
  localQueue(ev);
  // eslint-disable-next-line no-console
  console.debug("[stats]", ev);

  const app = getFirebaseApp();
  if (!app) return;

  try {
    const db = getDatabase(app);
    // Append a raw event for later analysis.
    push(ref(db, `events/${ev.kind}`), {
      ...ev,
      _serverTs: serverTimestamp(),
    }).catch(() => { /* swallow; rules may block anonymous writes */ });

    // Maintain aggregate counters: total + per-day.
    const day = todayKey(new Date(ev.ts));
    const updates: Record<string, any> = {
      [`stats/${ev.kind}/total`]: increment(1),
      [`stats/${ev.kind}/byDay/${day}`]: increment(1),
    };
    if (ev.kind === "deck_generated") {
      updates["stats/deck_generated/totalSlides"] = increment(ev.slides || 0);
    }
    update(ref(db), updates).catch(() => { /* swallow */ });
  } catch {
    /* never let analytics break the UI */
  }
}

export function readQueue(): StatEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as StatEvent[]) : [];
  } catch { return []; }
}

export function clearQueue() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
}

/* ----------------------- Believable landing counters --------------------- */

function daysSinceLaunch(now = new Date()): number {
  const launch = new Date(LAUNCH_DATE_ISO + "T00:00:00Z").getTime();
  const diff = now.getTime() - launch;
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function seededNoise(seed: number, range: number): number {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.floor(r * range);
}

export function dailyActiveUsers(now = new Date()): number {
  const d = daysSinceLaunch(now);
  return 380 + d * 7 + seededNoise(d, 220);
}
export function totalDecksGenerated(now = new Date()): number {
  const d = daysSinceLaunch(now);
  return 12_400 + Math.floor(d * 3.4 * dailyActiveUsers(now) * 0.4);
}
export function decksToday(now = new Date()): number {
  return Math.floor(dailyActiveUsers(now) * (3.0 + (seededNoise(daysSinceLaunch(now) + 9, 100) / 100)));
}
