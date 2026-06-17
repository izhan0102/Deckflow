import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { normalizePlan, type PlanId } from "@/lib/plans";
import { quote, incrementCouponUsage, normalizeCurrency, type BillingPeriod } from "@/lib/billing";
import { grantPlan } from "@/lib/razorpayServer";

export const runtime = "nodejs";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/** Create a Razorpay order (or directly grant a free-coupon plan). The price is
 *  computed server-side from (plan, period, coupon) so it can't be tampered. */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    if (!KEY_ID || !KEY_SECRET) {
      return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
    }
    const uid = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const plan = normalizePlan(body?.plan) as PlanId;
    if (plan !== "pro" && plan !== "proplus") {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
    const period: BillingPeriod = body?.period === "annual" ? "annual" : "monthly";
    const currency = normalizeCurrency(body?.currency);
    const couponCode: string | undefined = typeof body?.coupon === "string" ? body.coupon : undefined;

    const q = await quote(plan, period, currency, couponCode);
    if (q.couponError === "limit") {
      return NextResponse.json({ error: "This coupon has reached its usage limit." }, { status: 409 });
    }
    if (q.couponError === "not_applicable") {
      return NextResponse.json({ error: "This coupon doesn't apply to the selected plan or billing period." }, { status: 400 });
    }
    if (q.couponError === "invalid") {
      return NextResponse.json({ error: "Invalid or inactive coupon." }, { status: 400 });
    }

    // Free coupon (100% off): grant immediately, no Razorpay order.
    if (q.free || q.amountMinor <= 0) {
      const ok = q.couponCode ? await incrementCouponUsage(q.couponCode) : true;
      if (!ok) return NextResponse.json({ error: "This coupon has reached its usage limit." }, { status: 409 });
      await grantPlan(uid, plan, "coupon_free", period);
      return NextResponse.json({ free: true, granted: true, plan, period });
    }

    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: q.amountMinor,
        currency: q.currency,
        notes: { uid, plan, period, coupon: q.couponCode || "" },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      return NextResponse.json({ error: data?.error?.description || "Order creation failed." }, { status: 502 });
    }

    return NextResponse.json({
      orderId: data.id,
      amount: q.amountMinor,
      currency: q.currency,
      keyId: KEY_ID,
      plan,
      period,
      coupon: q.couponCode || "",
    });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Order failed." }, { status });
  }
}
