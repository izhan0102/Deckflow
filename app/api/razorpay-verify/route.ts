import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { grantPlan, hmacHex, safeEqual } from "@/lib/razorpayServer";

export const runtime = "nodejs";

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/** Verify a completed Razorpay payment and grant the plan. Called from the
 *  checkout success handler. The signature proves the payment is genuine;
 *  the plan is granted to the AUTHENTICATED user (not whatever the client claims). */
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
    const plan = body?.plan;
    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: "Missing payment fields." }, { status: 400 });
    }

    const expected = hmacHex(KEY_SECRET, `${orderId}|${paymentId}`);
    if (!safeEqual(expected, signature)) {
      return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
    }

    const granted = await grantPlan(uid, plan, paymentId);
    if (!granted) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    return NextResponse.json({ ok: true, plan });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Verification failed." }, { status });
  }
}
