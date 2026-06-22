import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { normalizeCurrency } from "@/lib/billing";
import { planIdFor, productHasTrial, hasUsedTrial, TRIAL_DAYS, SUB_TOTAL_COUNT, type SubProduct } from "@/lib/subscriptions";
import { normalizeProduct } from "@/lib/plans";

export const runtime = "nodejs";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/**
 * Create a Razorpay subscription (autopay) for a product (pro/team/org).
 * Individual Pro first-timers get a 7-day free trial (mandate authorized now,
 * first charge after the trial). Team/Org are pay-now: the first charge happens
 * on authorization, then autopay recurs monthly. Repeat Pro users also pay now.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    if (!KEY_ID || !KEY_SECRET) return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
    const uid = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const currency = normalizeCurrency(body?.currency);
    const product = normalizeProduct(body?.product) as SubProduct;
    const planId = planIdFor(product, currency);
    if (!planId) return NextResponse.json({ error: `Autopay isn't set up for ${product} yet.` }, { status: 400 });

    // Only individual Pro first-timers get a trial; team/org charge immediately.
    const usedTrial = productHasTrial(product) ? await hasUsedTrial(uid) : true;
    const isTrial = productHasTrial(product) && !usedTrial;
    const now = Math.floor(Date.now() / 1000);
    const startAt = isTrial ? now + TRIAL_DAYS * 86400 : undefined; // omit = bill from first cycle now

    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        total_count: SUB_TOTAL_COUNT,
        customer_notify: 1,
        ...(startAt ? { start_at: startAt } : {}),
        notes: { uid, product, period: "monthly", currency },
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
      product,
      trial: isTrial,
      trialEndsAt: startAt ? startAt * 1000 : null,
    });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Subscription failed." }, { status });
  }
}
