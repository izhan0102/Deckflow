/**
 * Client-side live credits — a read-only mirror of `credits/{uid}` from
 * Realtime DB. The server is authoritative; this just powers the live
 * counter and the global "out of credits" overlay.
 *
 * Because the server resets balances lazily (only when an AI route is hit),
 * a stored balance can be stale at the start of a new period. We reconcile
 * for *display* the same way the server does, so the counter shows the
 * correct "full" amount the instant a new month/day begins — even before
 * the user makes their first call.
 *
 * DB rule required:
 *   "credits": { "$uid": { ".read": "auth.uid === $uid", ".write": false } }
 */

import { ref, onValue, get } from "firebase/database";
import { getFirebaseDb } from "./firebase";
import { type PlanId, creditAllowance, creditPeriod, normalizePlan } from "./plans";

export type CreditView = {
  plan: PlanId;
  balance: number;
  allowance: number;
  resetAt: number;     // epoch ms of the next refill
  exhausted: boolean;  // balance <= 0
};

function periodKey(plan: PlanId, d = new Date()): string {
  return creditPeriod(plan) === "day" ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7);
}

export function creditResetAtClient(plan: PlanId, now = new Date()): number {
  if (creditPeriod(plan) === "day") {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
  }
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}

function view(node: any): CreditView {
  const plan = normalizePlan(node?.plan);
  const allowance = creditAllowance(plan);
  const samePeriod = node && node.periodKey === periodKey(plan);
  let balance = samePeriod && typeof node.balance === "number" ? node.balance : allowance;
  balance = Math.max(0, Math.min(allowance, balance));
  return { plan, balance, allowance, resetAt: creditResetAtClient(plan), exhausted: balance <= 0 };
}

/** Live-watch a user's credit balance. Emits immediately, then on change. */
export function watchCredits(uid: string, cb: (v: CreditView) => void): () => void {
  const db = getFirebaseDb();
  if (!db) {
    cb({ plan: "free", balance: creditAllowance("free"), allowance: creditAllowance("free"), resetAt: creditResetAtClient("free"), exhausted: false });
    return () => {};
  }
  const node = ref(db, `credits/${uid}`);
  const u = onValue(node, (snap) => cb(view(snap.exists() ? snap.val() : null)));
  return () => u();
}

/** One-shot read of a user's credit view (for pre-submit UX gates). */
export async function readCredits(uid: string): Promise<CreditView> {
  const db = getFirebaseDb();
  const fallback: CreditView = { plan: "free", balance: creditAllowance("free"), allowance: creditAllowance("free"), resetAt: creditResetAtClient("free"), exhausted: false };
  if (!db) return fallback;
  try {
    const snap = await get(ref(db, `credits/${uid}`));
    return view(snap.exists() ? snap.val() : null);
  } catch {
    return fallback;
  }
}

/** Human-readable "in 5h 12m" / "in 12 days" until the next reset. */
export function formatResetIn(resetAt: number, now = Date.now()): string {
  const ms = resetAt - now;
  if (ms <= 0) return "any moment";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins} min`;
}
