/**
 * Client-side plan resolution.
 *
 * A user's plan lives in Firebase Realtime DB at `plans/{uid}/tier`
 * (a string: "free" | "pro" | "proplus"). When absent, the user is on
 * the free plan. Nobody can set this from the app yet — upgrades are
 * "coming soon" — but the readers below are ready for when they can.
 *
 * Required DB rules:
 *   "plans": {
 *     "$uid": {
 *       ".read":  "auth != null && auth.uid === $uid",
 *       ".write": false   // only the server/billing may write tiers
 *     }
 *   }
 */

import { get, child, ref, onValue } from "firebase/database";
import { getFirebaseDb } from "./firebase";
import {
  type PlanId, type PlanFeature, DEFAULT_PLAN, resolvePlanFromNode,
  planHasFeature, planDeckLimit,
} from "./plans";

function planPath(uid: string): string {
  return `plans/${uid}`;
}

/** Read the user's plan once. Defaults to free. Honors expiry. */
export async function getUserPlan(uid: string): Promise<PlanId> {
  const db = getFirebaseDb();
  if (!db) return DEFAULT_PLAN;
  try {
    const snap = await get(child(ref(db), planPath(uid)));
    return snap.exists() ? resolvePlanFromNode(snap.val()) : DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
}

/** Live-watch the user's plan. Emits free immediately, then updates. */
export function watchUserPlan(uid: string, cb: (plan: PlanId) => void): () => void {
  cb(DEFAULT_PLAN);
  const db = getFirebaseDb();
  if (!db) return () => {};
  const node = ref(db, planPath(uid));
  const u = onValue(node, (snap) => {
    cb(snap.exists() ? resolvePlanFromNode(snap.val()) : DEFAULT_PLAN);
  });
  return () => u();
}

/** Convenience: does this plan unlock a feature? */
export function canUse(plan: PlanId, feature: PlanFeature): boolean {
  return planHasFeature(plan, feature);
}

/** Convenience: monthly deck allowance for a plan. */
export function deckAllowance(plan: PlanId): number {
  return planDeckLimit(plan);
}
