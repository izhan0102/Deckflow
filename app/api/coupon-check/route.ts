import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { normalizePlan, type PlanId } from "@/lib/plans";
import { quote, normalizeCurrency, type BillingPeriod } from "@/lib/billing";

export const runtime = "nodejs";

/** Live price/coupon preview for the checkout page. Auth-gated to limit coupon
 *  enumeration. Returns the same authoritative quote the order route uses. */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const plan = normalizePlan(body?.plan) as PlanId;
    if (plan !== "pro" && plan !== "proplus") {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
    const period: BillingPeriod = body?.period === "annual" ? "annual" : "monthly";
    const couponCode: string | undefined = typeof body?.coupon === "string" ? body.coupon : undefined;
    const q = await quote(plan, period, normalizeCurrency(body?.currency), couponCode);
    return NextResponse.json({
      currency: q.currency,
      baseAmount: q.baseAmount,
      listAmount: q.listAmount,
      finalAmount: q.finalAmount,
      discountPct: q.discountPct,
      free: q.free,
      couponValid: !!q.couponCode && !q.couponError,
      couponError: q.couponError || null,
    });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Check failed." }, { status });
  }
}
