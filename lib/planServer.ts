/**
 * Server-side plan + usage enforcement (the non-bypassable layer).
 *
 * The client has its own meters and locks for UX, but those can be
 * worked around with a direct API call. These helpers read the user's
 * plan and monthly usage straight from Firebase Realtime DB via the
 * admin SDK, so the real limits hold no matter how the request is made.
 *
 * Reads:
 *   plans/{uid}/tier              -> "free" | "pro" | "proplus"
 *   usage/{uid}/{YYYY-MM}/generations -> number
 */

import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import {
  type PlanId, type PlanFeature, DEFAULT_PLAN, resolvePlanFromNode,
  planHasFeature, planDeckLimit, getPlan,
} from "./plans";

/** Thrown when a plan doesn't allow the requested action. Maps to 402/403. */
export class PlanLimitError extends Error {
  status: number;
  code: string;
  constructor(message: string, code: string, status = 403) {
    super(message);
    this.name = "PlanLimitError";
    this.code = code;
    this.status = status;
  }
}

function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

/** Read a user's plan server-side. Defaults to free on any error. Honors expiry. */
export async function getUserPlanServer(uid: string): Promise<PlanId> {
  try {
    const db = getDatabase(getAdminAppOrThrow());
    const snap = await db.ref(`plans/${uid}`).get();
    return snap.exists() ? resolvePlanFromNode(snap.val()) : DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
}

/**
 * Require that the user's plan unlocks a feature, else throw PlanLimitError.
 * Used by the locked routes (speaker-notes, qa-prep, translate, icon-search).
 */
export async function requireFeature(uid: string, feature: PlanFeature): Promise<PlanId> {
  const plan = await getUserPlanServer(uid);
  if (!planHasFeature(plan, feature)) {
    throw new PlanLimitError(
      "This feature isn't included in your plan. Upgrade to unlock it.",
      "plan_feature_locked",
      403,
    );
  }
  return plan;
}

/** Read this month's generation count server-side. */
export async function getMonthlyGenerationsServer(uid: string): Promise<number> {
  try {
    const db = getDatabase(getAdminAppOrThrow());
    const snap = await db.ref(`usage/${uid}/${monthKey()}/generations`).get();
    const v = snap.val();
    return typeof v === "number" && isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/**
 * Enforce the monthly deck limit for the user's plan. Throws PlanLimitError
 * (402) when the allowance is used up. Returns the plan + current count so
 * the caller can proceed and then increment.
 */
export async function requireDeckAllowance(uid: string): Promise<{ plan: PlanId; used: number }> {
  const plan = await getUserPlanServer(uid);
  const limit = planDeckLimit(plan);
  if (limit === Infinity) return { plan, used: 0 };
  const used = await getMonthlyGenerationsServer(uid);
  if (used >= limit) {
    throw new PlanLimitError(
      `You've used all ${limit} decks on the ${getPlan(plan).name} plan this month.`,
      "plan_deck_limit",
      402,
    );
  }
  return { plan, used };
}

/** Atomically bump this month's generation count server-side. */
export async function incrementMonthlyGenerationsServer(uid: string): Promise<number> {
  try {
    const db = getDatabase(getAdminAppOrThrow());
    const node = db.ref(`usage/${uid}/${monthKey()}/generations`);
    const result = await node.transaction((current) => {
      const cur = typeof current === "number" && isFinite(current) ? current : 0;
      return cur + 1;
    });
    const val = result.snapshot.val();
    return typeof val === "number" ? val : 0;
  } catch {
    return 0;
  }
}
