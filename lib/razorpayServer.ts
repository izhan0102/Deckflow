import crypto from "node:crypto";
import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import { normalizePlan } from "./plans";

/** A paid month grants 31 days; resolvePlanFromNode auto-downgrades after. */
export const PLAN_GRANT_MS = 31 * 24 * 60 * 60 * 1000;

/** Write a paid plan to plans/{uid} with a 1-month expiry. */
export async function grantPlan(uid: string, plan: string, paymentId?: string): Promise<boolean> {
  const tier = normalizePlan(plan);
  if (tier !== "pro" && tier !== "proplus") return false;
  const db = getDatabase(getAdminAppOrThrow());
  const now = Date.now();
  await db.ref(`plans/${uid}`).update({
    tier,
    activatedAt: now,
    expiresAt: now + PLAN_GRANT_MS,
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
