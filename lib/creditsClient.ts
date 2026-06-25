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

import { ref, onValue, get, child } from "firebase/database";
import { getFirebaseDb } from "./firebase";
import { type PlanId, creditAllowance, creditPeriod, normalizePlan, resolvePlanFromNode, DEFAULT_PLAN } from "./plans";

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

/**
 * Build the view from the credits node + the user's AUTHORITATIVE plan (read
 * from plans/{uid}). The credits node carries its own `plan`, but that's only
 * refreshed server-side on the next AI call — so right after an upgrade it can
 * be stale. We trust `realPlan` for allowance/period/reset, and only use the
 * stored balance when it actually belongs to this plan + current period
 * (otherwise show the full allowance the server will refill to on next use).
 */
function view(node: any, realPlan: PlanId): CreditView {
  const plan = realPlan;
  const allowance = creditAllowance(plan);
  const sameContext = node && node.periodKey === periodKey(plan) && normalizePlan(node.plan) === plan;
  let balance = sameContext && typeof node.balance === "number" ? node.balance : allowance;
  balance = Math.max(0, Math.min(allowance, balance));
  return { plan, balance, allowance, resetAt: creditResetAtClient(plan), exhausted: balance <= 0 };
}

/** Live-watch a user's credit balance + plan. Emits immediately, then on change. */
export function watchCredits(uid: string, cb: (v: CreditView) => void): () => void {
  const db = getFirebaseDb();
  if (!db) {
    cb({ plan: "free", balance: creditAllowance("free"), allowance: creditAllowance("free"), resetAt: creditResetAtClient("free"), exhausted: false });
    return () => {};
  }
  let creditNode: any = null;
  let plan: PlanId = DEFAULT_PLAN;
  let gotCredits = false, gotPlan = false;
  const emit = () => { if (gotCredits && gotPlan) cb(view(creditNode, plan)); };
  const u1 = onValue(ref(db, `credits/${uid}`), (snap) => { creditNode = snap.exists() ? snap.val() : null; gotCredits = true; emit(); });
  const u2 = onValue(ref(db, `plans/${uid}`), (snap) => { plan = snap.exists() ? resolvePlanFromNode(snap.val()) : DEFAULT_PLAN; gotPlan = true; emit(); });
  return () => { u1(); u2(); };
}

/** One-shot read of a user's credit view (for pre-submit UX gates). */
export async function readCredits(uid: string): Promise<CreditView> {
  const db = getFirebaseDb();
  const fallback: CreditView = { plan: "free", balance: creditAllowance("free"), allowance: creditAllowance("free"), resetAt: creditResetAtClient("free"), exhausted: false };
  if (!db) return fallback;
  try {
    const [cSnap, pSnap] = await Promise.all([
      get(child(ref(db), `credits/${uid}`)),
      get(child(ref(db), `plans/${uid}`)),
    ]);
    const plan = pSnap.exists() ? resolvePlanFromNode(pSnap.val()) : DEFAULT_PLAN;
    return view(cSnap.exists() ? cSnap.val() : null, plan);
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
