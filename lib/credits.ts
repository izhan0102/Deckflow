/**
 * Server-side AI credits — the non-bypassable balance every AI route draws
 * from. Stored in Realtime DB at `credits/{uid}` via the admin SDK so it
 * can't be tampered with from the client.
 *
 *   credits/{uid} = { balance: number, periodKey: string, plan: "free"|"pro" }
 *
 * Allowance + cadence live in lib/plans.ts:
 *   • Free → 40 credits / calendar month (UTC)
 *   • Pro  → 1500 credits / day (UTC)
 *
 * Lazy reset: there's no cron. Whenever we read or deduct, if the stored
 * periodKey differs from the current one (or the plan changed) we refill the
 * balance to the plan's allowance. So a user's credits "reset" the first time
 * they're touched in a new period — and the client's live `resetAt` timer
 * tells them exactly when that is.
 */

import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import { PlanLimitError, getUserPlanServer } from "./planServer";
import { type PlanId, type CreditAction, creditAllowance, creditPeriod, creditCost } from "./plans";

type CreditNode = { balance: number; periodKey: string; plan: PlanId };

/** Current period key for a plan: "YYYY-MM" (free) or "YYYY-MM-DD" (pro). */
export function creditPeriodKey(plan: PlanId, d = new Date()): string {
  return creditPeriod(plan) === "day" ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7);
}

/** First instant (UTC) of the next period — when the allowance refills. */
export function creditResetAt(plan: PlanId, now = new Date()): number {
  if (creditPeriod(plan) === "day") {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
  }
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}

/**
 * Pure: given the stored node (or undefined) and the user's plan, return the
 * node it *should* be right now — refilling to the full allowance if the
 * period rolled over or the plan changed. Used inside transactions.
 */
function reconcile(node: unknown, plan: PlanId): CreditNode {
  const key = creditPeriodKey(plan);
  const allowance = creditAllowance(plan);
  const cur = (node && typeof node === "object" ? node : {}) as Partial<CreditNode>;
  const samePeriod = cur.periodKey === key && cur.plan === plan;
  if (!samePeriod) {
    return { balance: allowance, periodKey: key, plan };
  }
  const bal = typeof cur.balance === "number" && isFinite(cur.balance) ? cur.balance : allowance;
  return { balance: Math.max(0, Math.min(allowance, bal)), periodKey: key, plan };
}

function creditRef(uid: string) {
  return getDatabase(getAdminAppOrThrow()).ref(`credits/${uid}`);
}

export type CreditState = { plan: PlanId; balance: number; allowance: number; resetAt: number };

/** Read (and lazily reset) a user's credit state. Persists a refill if due. */
export async function getCreditsServer(uid: string): Promise<CreditState> {
  const plan = await getUserPlanServer(uid);
  const allowance = creditAllowance(plan);
  try {
    const result = await creditRef(uid).transaction((node) => reconcile(node, plan));
    const val = (result.snapshot.val() || {}) as CreditNode;
    const balance = typeof val.balance === "number" ? val.balance : allowance;
    return { plan, balance, allowance, resetAt: creditResetAt(plan) };
  } catch {
    // Fail open on read errors — don't lock a paying user out over a DB blip.
    return { plan, balance: allowance, allowance, resetAt: creditResetAt(plan) };
  }
}

/**
 * Block the request if the user has no credits left. Throws PlanLimitError
 * (402, code "no_credits") which the routes already translate to a clean
 * client error. Returns the live state so the caller can deduct afterwards.
 */
export async function requireCredits(uid: string): Promise<CreditState> {
  const state = await getCreditsServer(uid);
  if (state.balance <= 0) {
    throw new PlanLimitError(
      "You're out of AI credits. They'll reset automatically — upgrade for more.",
      "no_credits",
      402,
    );
  }
  return state;
}

/**
 * Deduct an action's cost after a successful AI call. Atomic + reconciles the
 * period first so a deduction can never resurrect a stale balance. Clamps at
 * 0. Best-effort: never throws (a failed deduction shouldn't break a response
 * the user already received).
 */
export async function deductCredits(uid: string, action: CreditAction): Promise<void> {
  const cost = creditCost(action);
  try {
    const plan = await getUserPlanServer(uid);
    await creditRef(uid).transaction((node) => {
      const n = reconcile(node, plan);
      n.balance = Math.max(0, n.balance - cost);
      return n;
    });
  } catch {
    /* ignore — UX meter is best-effort; the pre-check already gated entry */
  }
}
