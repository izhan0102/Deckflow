/**
 * Razorpay subscription (autopay) config.
 *
 * Plan IDs are created in the Razorpay dashboard, one per currency. They are
 * NOT secret, so we keep sensible defaults here with optional env overrides.
 * Pro is the only product with a free trial right now.
 */
import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";

export const TRIAL_DAYS = 7;
export const SUB_TOTAL_COUNT = 60; // billing cycles (5 years monthly) — under Razorpay's per-period cap

export type SubCurrency = "USD" | "INR";

const PRO_PLAN_IDS: Record<SubCurrency, string> = {
  USD: process.env.RAZORPAY_PLAN_PRO_USD || "plan_T35qg8vcpqMB4s",
  INR: process.env.RAZORPAY_PLAN_PRO_INR || "plan_T35zanYP9ILobd",
};

/** The Razorpay plan id for Pro in the given currency. */
export function proPlanId(currency: SubCurrency): string {
  return PRO_PLAN_IDS[currency] || PRO_PLAN_IDS.USD;
}

/** Has this user already consumed their free trial? */
export async function hasUsedTrial(uid: string): Promise<boolean> {
  try {
    const db = getDatabase(getAdminAppOrThrow());
    const snap = await db.ref(`plans/${uid}/trialUsed`).get();
    return snap.val() === true;
  } catch {
    return false;
  }
}
