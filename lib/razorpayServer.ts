import crypto from "node:crypto";
import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import { normalizePlan, normalizeProduct, type ProductId } from "./plans";
import { grantDurationMs, type BillingPeriod } from "./billing";
import { createOrRenewSeat } from "./seatsServer";

/**
 * Grant a purchased PRODUCT (pro/team/org) to the buyer. Always grants the
 * buyer Pro; for team/org it also creates/renews the seat plan so the owner
 * can assign member seats. Returns false on an invalid product.
 */
export async function grantProduct(
  uid: string,
  product: string,
  paymentId?: string,
  period: BillingPeriod = "monthly",
  amountPaid?: number,
  payCurrency?: string,
): Promise<boolean> {
  const prod: ProductId = normalizeProduct(product);
  const now = Date.now();
  const expiresAt = now + grantDurationMs(period);
  await getDatabase(getAdminAppOrThrow()).ref(`plans/${uid}`).update({
    tier: "pro",
    activatedAt: now,
    expiresAt,
    period,
    source: "razorpay",
    product: prod,
    paymentId: paymentId || null,
    amountPaid: typeof amountPaid === "number" ? amountPaid : null,
    payCurrency: payCurrency || null,
  });
  if (prod === "team" || prod === "org") {
    await createOrRenewSeat(uid, prod, expiresAt);
  }
  return true;
}

/** Write a paid plan to plans/{uid} with an expiry matching the billing period
 *  (monthly = 31 days, annual = 1 year). resolvePlanFromNode auto-downgrades after. */
export async function grantPlan(
  uid: string,
  plan: string,
  paymentId?: string,
  period: BillingPeriod = "monthly",
  amountPaid?: number,
  payCurrency?: string,
): Promise<boolean> {
  const tier = normalizePlan(plan);
  if (tier !== "pro") return false;
  const db = getDatabase(getAdminAppOrThrow());
  const now = Date.now();
  await db.ref(`plans/${uid}`).update({
    tier,
    activatedAt: now,
    expiresAt: now + grantDurationMs(period),
    period,
    source: "razorpay",
    paymentId: paymentId || null,
    amountPaid: typeof amountPaid === "number" ? amountPaid : null,
    payCurrency: payCurrency || null,
  });
  return true;
}

export function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/** Grant/refresh a subscription-based plan. Pro tier with an expiry equal to the
 *  current period end (trial end during the trial). Auto-downgrades after expiry. */
export async function grantSubscription(uid: string, opts: {
  subscriptionId: string;
  product?: string;
  status: string;           // trialing | active | halted | cancelled
  expiresAt: number;        // ms
  period?: BillingPeriod;
  amountPaid?: number;
  payCurrency?: string;
}): Promise<void> {
  const product = normalizeProduct(opts.product || "pro");
  const db = getDatabase(getAdminAppOrThrow());
  await db.ref(`plans/${uid}`).update({
    tier: "pro",
    source: "razorpay-sub",
    product,
    subscriptionId: opts.subscriptionId,
    subStatus: opts.status,
    period: opts.period || "monthly",
    expiresAt: opts.expiresAt,
    amountPaid: typeof opts.amountPaid === "number" ? opts.amountPaid : null,
    payCurrency: opts.payCurrency || null,
    activatedAt: Date.now(),
    trialUsed: true,
  });
  if (product === "team" || product === "org") await createOrRenewSeat(uid, product, opts.expiresAt);
}

/** Update only the subscription status (e.g. on cancel/halt). Keeps current
 *  access until it lapses naturally via expiresAt. */
export async function setSubStatus(uid: string, status: string): Promise<void> {
  const db = getDatabase(getAdminAppOrThrow());
  await db.ref(`plans/${uid}`).update({ subStatus: status });
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
