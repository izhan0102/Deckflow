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
export type SubProduct = "pro" | "team" | "org";

/**
 * Razorpay subscription plan ids, per product + currency. Created in the
 * Razorpay dashboard (monthly plans). Pro has live defaults; team/org must be
 * set via env once their plans exist (RAZORPAY_PLAN_TEAM_USD, etc.).
 */
const PLAN_IDS: Record<SubProduct, Record<SubCurrency, string>> = {
  pro: {
    USD: process.env.RAZORPAY_PLAN_PRO_USD || "plan_T5v9NlSaQWIcUr",
    INR: process.env.RAZORPAY_PLAN_PRO_INR || "plan_T5vAlCBagvKBsz",
  },
  team: {
    USD: process.env.RAZORPAY_PLAN_TEAM_USD || "",
    INR: process.env.RAZORPAY_PLAN_TEAM_INR || "",
  },
  org: {
    USD: process.env.RAZORPAY_PLAN_ORG_USD || "",
    INR: process.env.RAZORPAY_PLAN_ORG_INR || "",
  },
};

/** Razorpay plan id for a product + currency ("" if not configured yet). */
export function planIdFor(product: SubProduct, currency: SubCurrency): string {
  const byCur = PLAN_IDS[product] || PLAN_IDS.pro;
  return byCur[currency] || byCur.USD || "";
}

/** Back-compat helper: the Pro plan id for a currency. */
export function proPlanId(currency: SubCurrency): string {
  return planIdFor("pro", currency);
}

/** Only individual Pro gets a 7-day free trial. Team/Org are pay-now + autopay. */
export function productHasTrial(product: SubProduct): boolean {
  return product === "pro";
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
