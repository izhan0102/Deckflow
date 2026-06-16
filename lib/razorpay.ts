"use client";
/**
 * Razorpay (client) checkout helper.
 *
 * startCheckout() runs the whole flow: create a server order (price computed
 * server-side from plan/period/coupon) -> if the coupon makes it free, the
 * server already granted the plan -> otherwise open Razorpay Checkout and
 * verify the signature server-side (which grants the plan).
 */
import type { PlanId } from "./plans";
import { getIdToken } from "./auth";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

export type BillingPeriod = "monthly" | "annual";

export function razorpayConfigured(): boolean {
  return !!KEY_ID;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if ((window as any).Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="1"]');
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.dataset.razorpay = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay checkout."));
    document.head.appendChild(s);
  });
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken().catch(() => null);
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export type CheckoutResult = { ok: boolean; free?: boolean; reason?: string };

/** Full checkout for a plan + period + optional coupon. */
export async function startCheckout(args: {
  plan: PlanId;
  period: BillingPeriod;
  coupon?: string;
  email?: string | null;
}): Promise<CheckoutResult> {
  if (!KEY_ID) return { ok: false, reason: "not_configured" };
  try {
    const headers = await authHeaders();
    const orderRes = await fetch("/api/razorpay-order", {
      method: "POST",
      headers,
      body: JSON.stringify({ plan: args.plan, period: args.period, coupon: args.coupon || "" }),
    });
    const order = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok) return { ok: false, reason: order?.error || "order_failed" };

    // Free coupon — server already granted the plan.
    if (order?.free && order?.granted) return { ok: true, free: true };
    if (!order?.orderId) return { ok: false, reason: order?.error || "order_failed" };

    await loadScript();
    return await new Promise<CheckoutResult>((resolve) => {
      const rzp = new (window as any).Razorpay({
        key: order.keyId || KEY_ID,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "EXdeck",
        description: `${args.plan === "proplus" ? "Pro Plus" : "Pro"} · ${args.period === "annual" ? "Annual" : "Monthly"}`,
        prefill: { email: args.email || "" },
        theme: { color: "#7C5CFF" },
        handler: async (resp: any) => {
          try {
            const v = await fetch("/api/razorpay-verify", {
              method: "POST",
              headers: await authHeaders(),
              body: JSON.stringify({ ...resp, plan: args.plan, period: args.period, coupon: args.coupon || "" }),
            });
            const vd = await v.json().catch(() => ({}));
            resolve(v.ok && vd?.ok ? { ok: true } : { ok: false, reason: vd?.error || "verify_failed" });
          } catch (e: any) {
            resolve({ ok: false, reason: e?.message || "verify_error" });
          }
        },
        modal: { ondismiss: () => resolve({ ok: false, reason: "dismissed" }) },
      });
      rzp.open();
    });
  } catch (e: any) {
    return { ok: false, reason: e?.message || "checkout_failed" };
  }
}
