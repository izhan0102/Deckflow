import crypto from "node:crypto";
import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import { normalizePlan } from "./plans";
import { grantDurationMs, type BillingPeriod } from "./billing";

/** Write a paid plan to plans/{uid} with an expiry matching the billing period
 *  (monthly = 31 days, annual = 1 year). resolvePlanFromNode auto-downgrades after. */
export async function grantPlan(
  uid: string,
  plan: string,
  paymentId?: string,
  period: BillingPeriod = "monthly",
): Promise<boolean> {
  const tier = normalizePlan(plan);
  if (tier !== "pro" && tier !== "proplus") return false;
  const db = getDatabase(getAdminAppOrThrow());
  const now = Date.now();
  await db.ref(`plans/${uid}`).update({
    tier,
    activatedAt: now,
    expiresAt: now + grantDurationMs(period),
    period,
    source: "razorpay",
    paymentId: paymentId || null,
  });
  return true;
}

export function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
