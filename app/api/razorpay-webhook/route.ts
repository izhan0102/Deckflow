import { NextRequest, NextResponse } from "next/server";
import { grantPlan, grantSubscription, setSubStatus, hmacHex, safeEqual } from "@/lib/razorpayServer";

export const runtime = "nodejs";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

/**
 * Razorpay webhook — the authoritative/backup path that grants a plan even if
 * the browser closed before the success handler ran. Set RAZORPAY_WEBHOOK_SECRET
 * to the secret you configure when creating the webhook in the Razorpay
 * dashboard, and subscribe to `payment.captured` (and optionally `order.paid`).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature");

  if (WEBHOOK_SECRET) {
    const expected = hmacHex(WEBHOOK_SECRET, raw);
    if (!sig || !safeEqual(expected, sig)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const event: string = evt?.event || "";

  // ---- Subscription (autopay) events ----
  if (event.startsWith("subscription.")) {
    const sub = evt?.payload?.subscription?.entity || {};
    const subNotes = sub?.notes || {};
    const subUid: string | undefined = subNotes?.uid;
    const subProduct: string = subNotes?.product || "pro";
    const subId: string | undefined = sub?.id;
    // current_end / charge_at are unix seconds; charge_at is the next (or trial-end) charge.
    const endSec = typeof sub?.current_end === "number" ? sub.current_end : (typeof sub?.charge_at === "number" ? sub.charge_at : 0);
    const expiresAt = endSec ? endSec * 1000 : Date.now() + 31 * 86400000;
    const subPayment = evt?.payload?.payment?.entity || {};
    const subAmount = typeof subPayment?.amount === "number" ? subPayment.amount / 100 : undefined;
    const subCurrency = typeof subPayment?.currency === "string" ? subPayment.currency : undefined;

    try {
      if (!subUid || !subId) return NextResponse.json({ ok: true });
      if (event === "subscription.charged") {
        await grantSubscription(subUid, { subscriptionId: subId, product: subProduct, status: "active", expiresAt, period: "monthly", amountPaid: subAmount, payCurrency: subCurrency });
      } else if (event === "subscription.authenticated" || event === "subscription.activated") {
        // Mandate set up (trial begins, or active). Grant through the next charge date.
        await grantSubscription(subUid, { subscriptionId: subId, product: subProduct, status: endSec ? "trialing" : "active", expiresAt });
      } else if (event === "subscription.halted" || event === "subscription.pending") {
        await setSubStatus(subUid, "halted");
      } else if (event === "subscription.cancelled" || event === "subscription.completed") {
        await setSubStatus(subUid, "cancelled"); // access lapses naturally at expiresAt
      }
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[razorpay-webhook] subscription error:", e?.message || e);
      return NextResponse.json({ error: "server error" }, { status: 500 });
    }
  }

  // ---- One-time payment events ----
  const entity = evt?.payload?.payment?.entity || evt?.payload?.order?.entity || {};
  const notes = entity?.notes || {};
  const uid: string | undefined = notes?.uid;
  const plan: string | undefined = notes?.plan;
  const period = notes?.period === "annual" ? "annual" : "monthly";
  const paymentId: string | undefined = entity?.id;
  const amountPaid = typeof entity?.amount === "number" ? entity.amount / 100 : undefined; // paise/cents -> major
  const payCurrency = typeof entity?.currency === "string" ? entity.currency : undefined;

  try {
    if ((event === "payment.captured" || event === "order.paid") && uid && plan) {
      await grantPlan(uid, plan, paymentId, period, amountPaid, payCurrency);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[razorpay-webhook] error:", e?.message || e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
