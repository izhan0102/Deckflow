import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "firebase-admin/database";
import { authenticateRequest, AuthError, getAdminAppOrThrow } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { setSubStatus } from "@/lib/razorpayServer";
import { PRODUCTS, normalizeProduct } from "@/lib/plans";

export const runtime = "nodejs";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

async function rzp(path: string, method = "GET", body?: any) {
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Billing/manage-plan endpoint: returns the user's plan + live subscription
 *  details, and can cancel an autopay subscription (at cycle end). */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("edit-slide");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");

    const db = getDatabase(getAdminAppOrThrow());
    const plan = (await db.ref(`plans/${uid}`).get()).val() || {};
    const now = Date.now();
    const tierActive = (plan.tier === "pro") && (typeof plan.expiresAt !== "number" || plan.expiresAt > now);
    const source: string = plan.source || "none";
    const product = normalizeProduct(plan.product || "pro");
    const currency = plan.payCurrency === "INR" ? "INR" : "USD";
    const amount = currency === "INR" ? PRODUCTS[product].inr : PRODUCTS[product].usd;
    const subscriptionId: string | undefined = plan.subscriptionId;

    // Cancel (autopay only).
    if (action === "cancel") {
      if (source !== "razorpay-sub" || !subscriptionId) {
        return NextResponse.json({ error: "No active subscription to cancel." }, { status: 400 });
      }
      if (!KEY_ID || !KEY_SECRET) return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
      const { ok, data } = await rzp(`/subscriptions/${subscriptionId}/cancel`, "POST", { cancel_at_cycle_end: 1 });
      if (!ok) return NextResponse.json({ error: data?.error?.description || "Couldn't cancel." }, { status: 502 });
      await setSubStatus(uid, "cancelled");
    }

    // Live subscription detail (best-effort).
    let sub: any = null;
    if (subscriptionId && KEY_ID && KEY_SECRET) {
      const { ok, data } = await rzp(`/subscriptions/${subscriptionId}`);
      if (ok) sub = data;
    }

    const refreshed = (await db.ref(`plans/${uid}`).get()).val() || {};
    const subStatus: string = refreshed.subStatus || "";
    const isTrial = subStatus === "trialing";
    const nextChargeAt = sub?.charge_at ? sub.charge_at * 1000 : (typeof plan.expiresAt === "number" ? plan.expiresAt : null);
    const currentEnd = sub?.current_end ? sub.current_end * 1000 : null;

    return NextResponse.json({
      tier: tierActive ? "pro" : "free",
      source,
      product,
      subStatus: refreshed.subStatus || null,
      isTrial,
      razorpayStatus: sub?.status || null,
      amount,
      currency,
      nextChargeAt,
      currentEnd,
      expiresAt: typeof refreshed.expiresAt === "number" ? refreshed.expiresAt : null,
      ownerName: refreshed.ownerName || null,
      seatKind: refreshed.seatKind || null,
      trialUsed: refreshed.trialUsed === true,
      canCancel: source === "razorpay-sub" && subStatus !== "cancelled" && !!subscriptionId,
      cancelled: subStatus === "cancelled",
    });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Failed." }, { status });
  }
}
