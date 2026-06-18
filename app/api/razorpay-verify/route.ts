import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { grantProduct, hmacHex, safeEqual } from "@/lib/razorpayServer";
import { incrementCouponUsage, quote, normalizeCurrency, type BillingPeriod } from "@/lib/billing";
import { normalizeProduct } from "@/lib/plans";

export const runtime = "nodejs";

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/** Verify a completed Razorpay payment and grant the plan to the AUTHENTICATED
 *  user, with the correct period (monthly/annual). Records coupon usage and the
 *  actual amount paid (recomputed server-side, never trusted from the client). */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    if (!KEY_SECRET) return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
    const uid = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const orderId = body?.razorpay_order_id;
    const paymentId = body?.razorpay_payment_id;
    const signature = body?.razorpay_signature;
    const product = normalizeProduct(body?.product || body?.plan);
    const period: BillingPeriod = body?.period === "annual" ? "annual" : "monthly";
    const currency = normalizeCurrency(body?.currency);
    const coupon: string | undefined = typeof body?.coupon === "string" && body.coupon ? body.coupon : undefined;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: "Missing payment fields." }, { status: 400 });
    }

    const expected = hmacHex(KEY_SECRET, `${orderId}|${paymentId}`);
    if (!safeEqual(expected, signature)) {
      return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
    }

    // Recompute the price server-side (same logic as the order) so the stored
    // amount is authoritative, not whatever the client claims.
    const q = await quote(product, period, currency, coupon);
    const granted = await grantProduct(uid, product, paymentId, period, q.finalAmount, currency);
    if (!granted) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    if (coupon) await incrementCouponUsage(coupon).catch(() => {});
    return NextResponse.json({ ok: true, product, period });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Verification failed." }, { status });
  }
}
