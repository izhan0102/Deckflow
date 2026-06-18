import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { normalizeCurrency } from "@/lib/billing";
import { proPlanId, hasUsedTrial, TRIAL_DAYS, SUB_TOTAL_COUNT } from "@/lib/subscriptions";

export const runtime = "nodejs";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/**
 * Create a Razorpay subscription for Pro (autopay). First-time users get a
 * 7-day free trial: the mandate is authorized now, the first charge happens
 * after the trial (start_at). Repeat users are billed from the next cycle.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    if (!KEY_ID || !KEY_SECRET) return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
    const uid = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const currency = normalizeCurrency(body?.currency);
    const planId = proPlanId(currency);
    if (!planId) return NextResponse.json({ error: "No plan configured for this currency." }, { status: 400 });

    const usedTrial = await hasUsedTrial(uid);
    const now = Math.floor(Date.now() / 1000);
    const startAt = usedTrial ? undefined : now + TRIAL_DAYS * 86400; // omit = bill from next cycle immediately

    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        total_count: SUB_TOTAL_COUNT,
        customer_notify: 1,
        ...(startAt ? { start_at: startAt } : {}),
        notes: { uid, product: "pro", period: "monthly", currency },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      // eslint-disable-next-line no-console
      console.error("[razorpay-subscription] create failed", res.status, JSON.stringify(data));
      const detail = data?.error?.description || data?.error?.reason || `Razorpay error (${res.status})`;
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    return NextResponse.json({
      subscriptionId: data.id,
      keyId: KEY_ID,
      trial: !usedTrial,
      trialEndsAt: startAt ? startAt * 1000 : null,
    });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Subscription failed." }, { status });
  }
}
