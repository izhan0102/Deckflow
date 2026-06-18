import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import { PRODUCTS, normalizePlan, normalizeProduct, type PlanId, type ProductId } from "./plans";

/**
 * Server-side billing: turns (plan, period, coupon) into a trusted price.
 * The client never decides the amount — this does, so discounts can't be faked.
 *
 * Coupons live at /coupons/{CODE} in RTDB:
 *   { code, type: "percent" | "free", value (0-100), maxUses (0 = unlimited),
 *     usedCount, active, createdAt }
 */

export type BillingPeriod = "monthly" | "annual";

export type CouponScope = "any" | "pro" | "team" | "org";
export type CouponPeriodScope = "any" | "monthly" | "annual";

export type Coupon = {
  code: string;
  type: "percent" | "free";
  value: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  /** Restrict which plan the code applies to ("any" = both). */
  plan: CouponScope;
  /** Restrict which billing period it applies to ("any" = both). */
  period: CouponPeriodScope;
  createdAt?: number;
};

export const CURRENCY = (process.env.NEXT_PUBLIC_RAZORPAY_CURRENCY || "USD").toUpperCase();
/** Annual billing gives 10% off the 12-month price. */
export const ANNUAL_DISCOUNT = 0.10;
const MONTH_MS = 31 * 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type Currency = "USD" | "INR";

export function normalizeCurrency(c: unknown): Currency {
  return c === "INR" ? "INR" : "USD";
}

/** Monthly price for a PRODUCT (pro/team/org) in a given currency. */
export function productMonthly(product: ProductId, currency: Currency): number {
  const p = PRODUCTS[product] || PRODUCTS.pro;
  return currency === "INR" ? p.inr : p.usd;
}

/** Monthly list price for a plan in a given currency (Pro = the pro product). */
export function planPrice(plan: PlanId, currency: Currency): number {
  return productMonthly(normalizeProduct(plan), currency);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function grantDurationMs(period: BillingPeriod): number {
  return period === "annual" ? YEAR_MS : MONTH_MS;
}

/** Base price for a product over the chosen period (annual = 12 months − 10%). */
export function basePrice(product: ProductId, period: BillingPeriod, currency: Currency): number {
  const monthly = productMonthly(product, currency);
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
    plan: ["pro", "team", "org"].includes(v?.plan) ? v.plan : "any",
    period: v?.period === "monthly" || v?.period === "annual" ? v.period : "any",
    createdAt: v?.createdAt,
  };
}

export type CheckoutQuote = {
  product: ProductId;
  plan: PlanId;            // tier granted (always "pro" for paid products)
  period: BillingPeriod;
  currency: string;
  baseAmount: number;     // price for the period (annual already −10%)
  listAmount: number;     // undiscounted list price for the period (monthly×12 for annual)
  finalAmount: number;    // after coupon
  amountMinor: number;    // smallest unit (cents) for Razorpay
  discountPct: number;    // total % off (annual not counted here; it's in baseAmount)
  free: boolean;          // 100%-off / free coupon
  couponCode?: string;
  couponError?: "invalid" | "limit" | "not_applicable" | null;
};

/** Compute the authoritative checkout quote for a product (pro/team/org). */
export async function quote(product: ProductId, period: BillingPeriod, currency: Currency, couponCode?: string): Promise<CheckoutQuote> {
  const prod = normalizeProduct(product);
  const monthly = productMonthly(prod, currency);
  const list = period === "annual" ? round2(monthly * 12) : monthly; // undiscounted period price
  const base = basePrice(prod, period, currency);                    // annual already −10%
  let discountPct = 0;
  let free = false;
  let couponError: CheckoutQuote["couponError"] = null;
  const code = (couponCode || "").trim().toUpperCase();

  if (code) {
    const c = await getCoupon(code);
    if (!c || !c.active) couponError = "invalid";
    else if (c.maxUses > 0 && c.usedCount >= c.maxUses) couponError = "limit";
    else if (c.plan !== "any" && c.plan !== prod) couponError = "not_applicable";
    else if (c.period !== "any" && c.period !== period) couponError = "not_applicable";
    else if (c.type === "free") free = true;
    else discountPct = clamp(c.value, 0, 100);
  }

  const finalAmount = free ? 0 : round2(base * (1 - discountPct / 100));
  return {
    product: prod,
    plan: "pro",
    period,
    currency,
    baseAmount: base,
    listAmount: list,
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
