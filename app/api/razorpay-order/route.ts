import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { PLANS, normalizePlan, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const CURRENCY = (process.env.NEXT_PUBLIC_RAZORPAY_CURRENCY || "USD").toUpperCase();

/** Create a Razorpay order for a plan. Amount/currency come from the plan
 *  catalog server-side so the client can't tamper with the price. */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate"); // reuse a sane bucket
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

    const amount = Math.round((PLANS[plan].price || 0) * 100); // smallest unit
    if (amount <= 0) return NextResponse.json({ error: "Invalid amount." }, { status: 400 });

    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency: CURRENCY,
        notes: { uid, plan },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      return NextResponse.json({ error: data?.error?.description || "Order creation failed." }, { status: 502 });
    }

    return NextResponse.json({ orderId: data.id, amount, currency: CURRENCY, keyId: KEY_ID });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Order failed." }, { status });
  }
}
