/**
 * Per-user MONTHLY generation usage.
 *
 * Plans are billed/limited per calendar month, so usage is counted per
 * month (UTC). The monthly allowance itself lives in lib/plans.ts and is
 * resolved from the user's plan — this module only counts.
 *
 * Storage strategy:
 *   1. **localStorage** is the immediate, always-works source so the gate
 *      is responsive even if Firebase is slow/blocked.
 *   2. **Firebase Realtime DB** at `usage/{uid}/{YYYY-MM}/generations` is a
 *      best-effort sync so the count survives across browsers/devices.
 *      We read max(local, remote) so neither side undercounts.
 *
 * IMPORTANT: this client counter is for UX (meters, soft gating). The
 * hard, non-bypassable limit is enforced server-side in /api/generate
 * via firebase-admin (see lib/firebaseAdmin.ts).
 */

import {
  get, child, ref, runTransaction, onValue, serverTimestamp, update,
} from "firebase/database";
import { getFirebaseDb } from "./firebase";

/** YYYY-MM in UTC so the month flips at the same instant for everyone. */
export function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

/** Path of the per-month generations counter for a user. */
function usagePath(uid: string, month = monthKey()): string {
  return `usage/${uid}/${month}/generations`;
}

/** localStorage key — namespaced by uid + month. */
function localKey(uid: string, month = monthKey()): string {
  return `ezdeck_usage_${uid}_${month}`;
}

function readLocal(uid: string, month = monthKey()): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = window.localStorage.getItem(localKey(uid, month));
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}

function writeLocal(uid: string, value: number, month = monthKey()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localKey(uid, month), String(value));
    window.dispatchEvent(new CustomEvent("ezdeck:usage-changed", {
      detail: { uid, month, value },
    }));
  } catch { /* private mode etc. */ }
}

/** Read this month's count — max(localStorage, Firebase). */
export async function getMonthlyGenerations(uid: string): Promise<number> {
  const local = readLocal(uid);
  const db = getFirebaseDb();
  if (!db) return local;
  try {
    const snap = await get(child(ref(db), usagePath(uid)));
    if (!snap.exists()) return local;
    const v = snap.val();
    const remote = typeof v === "number" && isFinite(v) ? v : 0;
    return Math.max(local, remote);
  } catch {
    return local;
  }
}

/** Atomically bump this month's count by 1; returns the new value. */
export async function incrementMonthlyGenerations(uid: string): Promise<number> {
  const localBefore = readLocal(uid);
  const localAfter = localBefore + 1;
  writeLocal(uid, localAfter);

  const db = getFirebaseDb();
  if (!db) return localAfter;
  try {
    const node = ref(db, usagePath(uid));
    const result = await runTransaction(node, (current) => {
      const cur = typeof current === "number" && isFinite(current) ? current : 0;
      return Math.max(cur + 1, localAfter);
    });
    if (result.committed && typeof result.snapshot.val() === "number") {
      const committed = result.snapshot.val() as number;
      if (committed > localAfter) writeLocal(uid, committed);
      update(ref(db, `usage/${uid}/${monthKey()}`), {
        lastAt: serverTimestamp(),
      }).catch(() => {});
      return committed;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[usage] remote increment failed; using local count", err);
  }
  return localAfter;
}

/** Live-watch this month's count. */
export function watchMonthlyGenerations(
  uid: string,
  cb: (count: number) => void,
): () => void {
  let activeMonth = monthKey();
  let lastLocal = readLocal(uid, activeMonth);
  let lastRemote = 0;
  let unsubFb: (() => void) | null = null;
  let checkInterval: number;

  const emit = () => cb(Math.max(lastLocal, lastRemote));

  const onStorage = (e: StorageEvent) => {
    if (e.key === localKey(uid, activeMonth)) {
      lastLocal = readLocal(uid, activeMonth);
      emit();
    }
  };

  const onSameTab = (e: Event) => {
    const detail = (e as CustomEvent).detail as { uid?: string; month?: string } | undefined;
    if (detail?.uid && detail.uid !== uid) return;

    const nowMonth = monthKey();
    if (nowMonth !== activeMonth) {
      applyMonth(nowMonth);
      return;
    }

    if (detail?.month && detail.month !== activeMonth) return;
    lastLocal = readLocal(uid, activeMonth);
    emit();
  };

  function subscribeFirebase() {
    if (unsubFb) unsubFb();
    unsubFb = null;
    const db = getFirebaseDb();
    if (db) {
      const node = ref(db, usagePath(uid, activeMonth));
      const u = onValue(node, (snap) => {
        const v = snap.val();
        lastRemote = typeof v === "number" && isFinite(v) ? v : 0;
        emit();
      });
      unsubFb = () => u();
    }
  }

  function applyMonth(newMonth: string) {
    activeMonth = newMonth;
    lastLocal = readLocal(uid, activeMonth);
    lastRemote = 0;
    subscribeFirebase();
    emit();
  }

  // Initial setup
  emit();

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    window.addEventListener("ezdeck:usage-changed", onSameTab);

    // Periodically check for month rollover
    checkInterval = window.setInterval(() => {
      const nowMonth = monthKey();
      if (nowMonth !== activeMonth) {
        applyMonth(nowMonth);
      }
    }, 60_000); // Check every minute
  }

  subscribeFirebase();

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ezdeck:usage-changed", onSameTab);
      window.clearInterval(checkInterval);
    }
    unsubFb?.();
  };
}

/** First instant (UTC) of next month — when the monthly allowance resets. */
export function nextMonthlyResetAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/* ----------------------------- daily AI cap ----------------------------- */

/** YYYY-MM-DD (UTC) — matches the server's daily counter key. */
export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Live-watch today's AI-generation count (server-authoritative, read-only). */
export function watchDailyGenerations(uid: string, cb: (count: number) => void): () => void {
  let activeDay = dayKey();
  let unsubFb: (() => void) | null = null;
  let interval: number | undefined;

  const subscribe = () => {
    unsubFb?.();
    unsubFb = null;
    const db = getFirebaseDb();
    if (!db) { cb(0); return; }
    const node = ref(db, `usage/${uid}/daily/${activeDay}`);
    const u = onValue(node, (snap) => {
      const v = snap.val();
      cb(typeof v === "number" && isFinite(v) ? v : 0);
    });
    unsubFb = () => u();
  };

  subscribe();
  if (typeof window !== "undefined") {
    interval = window.setInterval(() => {
      const nd = dayKey();
      if (nd !== activeDay) { activeDay = nd; cb(0); subscribe(); }
    }, 60_000);
  }

  return () => { unsubFb?.(); if (interval !== undefined) window.clearInterval(interval); };
}

/** First instant (UTC) of the next day — when the daily cap resets. */
export function nextDailyResetAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
}

/** Human-readable "in 5h 12m" until the daily reset. */
export function formatDailyResetIn(now = new Date()): string {
  const ms = nextDailyResetAt(now).getTime() - now.getTime();
  if (ms <= 0) return "soon";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  return `${Math.floor(ms / 60_000)} min`;
}

/** Human-readable "in 12 days" / "in 3h" until the monthly reset. */
export function formatMonthlyResetIn(now = new Date()): string {
  const ms = nextMonthlyResetAt(now).getTime() - now.getTime();
  if (ms <= 0) return "soon";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes} min`;
}
