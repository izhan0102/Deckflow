"use client";
/**
 * Guest "try before signup" work — stashed in localStorage so we can restore
 * the user's brief + settings after they log in and run the REAL generation
 * (authenticated → no API abuse from guests).
 */
export type GuestKind = "deck" | "doc" | "resume";
export type GuestWork = {
  kind: GuestKind;
  topic?: string;
  settings?: Record<string, any>;
  ts: number;
};

const KEY = "exdeck:guestWork";
const SEEN_KEY = "exdeck:seen";

export function stashGuestWork(w: Omit<GuestWork, "ts">): void {
  try { window.localStorage.setItem(KEY, JSON.stringify({ ...w, ts: Date.now() })); } catch { /* ignore */ }
}

export function readGuestWork(): GuestWork | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw);
    // Expire stale stashes after 6 hours.
    if (!w || !w.kind || (typeof w.ts === "number" && Date.now() - w.ts > 6 * 3600_000)) return null;
    return w as GuestWork;
  } catch { return null; }
}

export function clearGuestWork(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Has this browser visited before? Used to route new vs returning visitors. */
export function hasVisited(): boolean {
  try { return window.localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
export function markVisited(): void {
  try { window.localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
}

/** Where each guest kind continues after login. */
export const KIND_PATH: Record<GuestKind, string> = { deck: "/app", doc: "/docs", resume: "/resume" };
