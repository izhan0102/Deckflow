import { NextRequest, NextResponse } from "next/server";
import { grantPlan, hmacHex, safeEqual } from "@/lib/razorpayServer";

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
