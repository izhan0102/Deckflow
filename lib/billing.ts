import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import { PLANS, normalizePlan, type PlanId } from "./plans";

/**
 * Server-side billing: turns (plan, period, coupon) into a trusted price.
 * The client never decides the amount — this does, so discounts can't be faked.
 *
 * Coupons live at /coupons/{CODE} in RTDB:
 *   { code, type: "percent" | "free", value (0-100), maxUses (0 = unlimited),
 *     usedCount, active, createdAt }
 */

export type BillingPeriod = "monthly" | "annual";

export type Coupon = {
  code: string;
  type: "percent" | "free";
  value: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  createdAt?: number;
};

export const CURRENCY = (process.env.NEXT_PUBLIC_RAZORPAY_CURRENCY || "USD").toUpperCase();
/** Annual billing gives 10% off the 12-month price. */
export const ANNUAL_DISCOUNT = 0.10;
const MONTH_MS = 31 * 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type Currency = "USD" | "INR";

/** INR monthly prices (Indian users pay in ₹ via UPI/cards/netbanking). */
const INR_PRICES: Record<string, number> = { pro: 5, proplus: 899 };

export function normalizeCurrency(c: unknown): Currency {
  return c === "INR" ? "INR" : "USD";
}

/** Monthly list price for a plan in a given currency. */
export function planPrice(plan: PlanId, currency: Currency): number {
  if (currency === "INR") return INR_PRICES[plan] ?? 0;
  return PLANS[plan].price || 0; // USD
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function grantDurationMs(period: BillingPeriod): number {
  return period === "annual" ? YEAR_MS : MONTH_MS;
}

/** Base price for a plan over the chosen period (annual = 12 months − 10%). */
export function basePrice(plan: PlanId, period: BillingPeriod, currency: Currency): number {
  const monthly = planPrice(plan, currency);
  return period === "annual" ? round2(monthly * 12 * (1 - ANNUAL_DISCOUNT)) : monthly;
}

export async function getCoupon(code: string): Promise<Coupon | null> {
  const c = (code || "").trim().toUpperCase();
  if (!c) return null;
  const db = getDatabase(getAdminAppOrThrow());
  const snap = await db.ref(`coupons/${c}`).get();
  if (!snap.exists()) return null;
  const v = snap.val();
  return {
    code: c,
    type: v?.type === "free" ? "free" : "percent",
    value: typeof v?.value === "number" ? v.value : 0,
    maxUses: typeof v?.maxUses === "number" ? v.maxUses : 0,
    usedCount: typeof v?.usedCount === "number" ? v.usedCount : 0,
    active: v?.active !== false,
    createdAt: v?.createdAt,
  };
}

export type CheckoutQuote = {
  plan: PlanId;
  period: BillingPeriod;
  currency: string;
  baseAmount: number;     // price for the period before discount
  finalAmount: number;    // after coupon
  amountMinor: number;    // smallest unit (cents) for Razorpay
  discountPct: number;    // total % off (annual not counted here; it's in baseAmount)
  free: boolean;          // 100%-off / free coupon
  couponCode?: string;
  couponError?: "invalid" | "limit" | null;
};

/** Compute the authoritative checkout quote. */
export async function quote(plan: PlanId, period: BillingPeriod, currency: Currency, couponCode?: string): Promise<CheckoutQuote> {
  const base = basePrice(plan, period, currency);
  let discountPct = 0;
  let free = false;
  let couponError: CheckoutQuote["couponError"] = null;
  const code = (couponCode || "").trim().toUpperCase();

  if (code) {
    const c = await getCoupon(code);
    if (!c || !c.active) couponError = "invalid";
    else if (c.maxUses > 0 && c.usedCount >= c.maxUses) couponError = "limit";
    else if (c.type === "free") free = true;
    else discountPct = clamp(c.value, 0, 100);
  }

  const finalAmount = free ? 0 : round2(base * (1 - discountPct / 100));
  return {
    plan,
    period,
    currency,
    baseAmount: base,
    finalAmount,
    amountMinor: Math.round(finalAmount * 100),
    discountPct,
    free,
    couponCode: code || undefined,
    couponError,
  };
}

/** Atomically bump a coupon's usedCount. Returns false if the coupon is at its
 *  limit (so callers can refuse a free grant). Best-effort for paid grants. */
export async function incrementCouponUsage(code: string): Promise<boolean> {
  const c = (code || "").trim().toUpperCase();
  if (!c) return true;
  const db = getDatabase(getAdminAppOrThrow());
  const ref = db.ref(`coupons/${c}/usedCount`);
  // Read maxUses for the cap.
  const maxSnap = await db.ref(`coupons/${c}/maxUses`).get();
  const maxUses = typeof maxSnap.val() === "number" ? maxSnap.val() : 0;
  const res = await ref.transaction((cur) => {
    const n = typeof cur === "number" ? cur : 0;
    if (maxUses > 0 && n >= maxUses) return; // abort: at limit
    return n + 1;
  });
  return res.committed;
}

export { normalizePlan };
