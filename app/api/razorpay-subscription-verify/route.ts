import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { grantSubscription, hmacHex, safeEqual } from "@/lib/razorpayServer";
import { normalizeCurrency } from "@/lib/billing";
import { hasUsedTrial, TRIAL_DAYS, productHasTrial, type SubProduct } from "@/lib/subscriptions";
import { normalizeProduct } from "@/lib/plans";

export const runtime = "nodejs";

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

/** Verify the subscription mandate authorization and grant immediate access.
 *  Trial users get Pro until trial end (server-computed); the webhook then
 *  takes over for renewals/cancellations. */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    if (!KEY_SECRET) return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
    const uid = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const paymentId = body?.razorpay_payment_id;
    const subscriptionId = body?.razorpay_subscription_id;
    const signature = body?.razorpay_signature;
    const currency = normalizeCurrency(body?.currency);
    const product = normalizeProduct(body?.product) as SubProduct;
    if (!paymentId || !subscriptionId || !signature) {
      return NextResponse.json({ error: "Missing payment fields." }, { status: 400 });
    }

    // Subscription signature: HMAC_SHA256(payment_id + "|" + subscription_id).
    const expected = hmacHex(KEY_SECRET, `${paymentId}|${subscriptionId}`);
    if (!safeEqual(expected, signature)) {
      return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
    }

    // Server-computed expiry — never trust the client for dates. Only individual
    // Pro first-timers get the trial window; team/org & repeat users start now.
    const wasTrial = productHasTrial(product) && !(await hasUsedTrial(uid));
    const expiresAt = wasTrial
      ? Date.now() + TRIAL_DAYS * 86400000        // access through the trial
      : Date.now() + 31 * 86400000;               // first cycle (webhook will correct on charge)

    await grantSubscription(uid, {
      subscriptionId,
      product,
      status: wasTrial ? "trialing" : "active",
      expiresAt,
      period: "monthly",
      payCurrency: currency,
    });

    return NextResponse.json({ ok: true, trial: wasTrial });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Verification failed." }, { status });
  }
}
