/**
 * Per-user daily generation quota.
 *
 * Storage strategy:
 *   1. **localStorage** is the primary source of truth (always works,
 *      independent of Firebase rules). Per-browser, but that's fine —
 *      this is a soft rate-limit, not a billing system.
 *   2. **Firebase Realtime DB** at `usage/{uid}/{YYYY-MM-DD}/generations`
 *      is a best-effort sync so the count survives across browsers /
 *      devices when the rules allow it. We read the max(local, remote)
 *      so neither side ever undercounts.
 *
 * Required DB rules to make Firebase sync work:
 *
 *   "usage": {
 *     "$uid": {
 *       ".read":  "auth != null && auth.uid === $uid",
 *       ".write": "auth != null && auth.uid === $uid"
 *     }
 *   }
 *
 * Without those rules, the writes get rejected and we silently fall
 * back to localStorage-only behavior.
 */

import {
  get, child, ref, runTransaction, onValue, serverTimestamp, update,
} from "firebase/database";
import { getFirebaseDb } from "./firebase";

/** How many decks a user can generate per day. */
export const DAILY_GENERATION_LIMIT = 3;

/** YYYY-MM-DD in UTC so the day flips at the same global instant for
 *  everyone and rate-limits don't depend on user timezone. */
function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Path of the per-day generations counter for a user. */
function usagePath(uid: string, day = todayKey()): string {
  return `usage/${uid}/${day}/generations`;
}

/** localStorage key — namespaced by uid + day so multiple sign-ins on
 *  the same browser don't share a counter. */
function localKey(uid: string, day = todayKey()): string {
  return `ezdeck_usage_${uid}_${day}`;
}

function readLocal(uid: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = window.localStorage.getItem(localKey(uid));
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}

function writeLocal(uid: string, value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localKey(uid), String(value));
    // localStorage's `storage` event only fires in OTHER tabs, so we
    // emit a same-tab custom event here too. The watcher below listens
    // to both.
    window.dispatchEvent(new CustomEvent("ezdeck:usage-changed", {
      detail: { uid, day: todayKey(), value },
    }));
  } catch { /* private mode etc. */ }
}

/**
 * Read today's count. Returns the max of (localStorage, Firebase).
 *
 * If either source has a higher count we trust it — better to over-count
 * than miss a generation and let someone exceed the quota.
 */
export async function getTodayGenerations(uid: string): Promise<number> {
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

/**
 * Atomically bump today's count by 1.
 *
 * Local first (so the gate is reliable), then a best-effort Firebase
 * transaction. If the remote write succeeds and lands at a higher
 * number than our local copy (e.g. because another tab wrote first),
 * we adopt the remote value and write it back to localStorage.
 *
 * Returns the new committed value.
 */
export async function incrementTodayGenerations(uid: string): Promise<number> {
  // 1) Bump locally and immediately reflect.
  const localBefore = readLocal(uid);
  const localAfter = localBefore + 1;
  writeLocal(uid, localAfter);

  // 2) Best-effort remote sync.
  const db = getFirebaseDb();
  if (!db) return localAfter;
  try {
    const node = ref(db, usagePath(uid));
    const result = await runTransaction(node, (current) => {
      const cur = typeof current === "number" && isFinite(current) ? current : 0;
      // Settle on the higher of (local, remote+1) so we never undercount
      // if a concurrent tab also incremented.
      return Math.max(cur + 1, localAfter);
    });
    if (result.committed && typeof result.snapshot.val() === "number") {
      const committed = result.snapshot.val() as number;
      if (committed > localAfter) writeLocal(uid, committed);
      // Stamp last-used so the dashboard could show "next refill" later.
      update(ref(db, `usage/${uid}/${todayKey()}`), {
        lastAt: serverTimestamp(),
      }).catch(() => {});
      return committed;
    }
  } catch (err) {
    // Surface so the developer can see when Firebase rules aren't set
    // up. Counter still works thanks to the local write above.
    // eslint-disable-next-line no-console
    console.warn("[usage] remote increment failed; using local count", err);
  }
  return localAfter;
}

/**
 * Live-watch today's count.
 *
 * Fires immediately with the localStorage value, then continues to
 * fire whenever the remote node changes. If the remote ever has a
 * lower value than local (because remote writes are blocked) we keep
 * reporting the local value.
 *
 * Also re-emits on the `storage` event so a generation in another tab
 * updates the meter live.
 */
export function watchTodayGenerations(
  uid: string,
  cb: (count: number) => void,
): () => void {
  // Emit local right away so the UI never starts at 0 incorrectly.
  let lastLocal = readLocal(uid);
  let lastRemote = 0;
  const emit = () => cb(Math.max(lastLocal, lastRemote));
  emit();

  // Cross-tab updates via the `storage` event.
  const onStorage = (e: StorageEvent) => {
    if (e.key === localKey(uid)) {
      lastLocal = readLocal(uid);
      emit();
    }
  };
  // Same-tab updates via our custom event, since `storage` only fires
  // in other tabs.
  const onSameTab = (e: Event) => {
    const detail = (e as CustomEvent).detail as { uid?: string } | undefined;
    if (detail?.uid && detail.uid !== uid) return;
    lastLocal = readLocal(uid);
    emit();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    window.addEventListener("ezdeck:usage-changed", onSameTab);
  }

  // Firebase live watcher.
  let unsubFb: (() => void) | null = null;
  const db = getFirebaseDb();
  if (db) {
    const node = ref(db, usagePath(uid));
    const u = onValue(node, (snap) => {
      const v = snap.val();
      lastRemote = typeof v === "number" && isFinite(v) ? v : 0;
      emit();
    });
    unsubFb = () => u();
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ezdeck:usage-changed", onSameTab);
    }
    unsubFb?.();
  };
}

export function syncLocalGenerationCount(uid: string, value: number) {
  const current = readLocal(uid);
  if (value > current) {
    writeLocal(uid, value);
  }
}

/** UTC midnight of the next day — used to render "refills in X" copy. */
export function nextRefillAt(now = new Date()): Date {
  const d = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return d;
}

/** Human-readable "in 3h 12m" for the next refill. */
export function formatRefillIn(now = new Date()): string {
  const ms = nextRefillAt(now).getTime() - now.getTime();
  if (ms <= 0) return "soon";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours <= 0) return `${minutes} min`;
  if (hours <= 1) return `${hours}h ${minutes}m`;
  return `${hours}h`;
}
