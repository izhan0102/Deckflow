"use client";
/**
 * Razorpay (client) checkout helper.
 *
 * Flow: create an order on our server -> open Razorpay Checkout -> on success
 * verify the signature on our server, which grants the plan in Firebase.
 *
 * Env (public):
 *   NEXT_PUBLIC_RAZORPAY_KEY_ID    - "rzp_live_…" or "rzp_test_…"
 *   NEXT_PUBLIC_RAZORPAY_CURRENCY  - "USD" (default) etc.
 */
import type { PlanId } from "./plans";
import { getIdToken } from "./auth";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

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

/** Open Razorpay checkout for a plan. Resolves when the flow completes. */
export async function openCheckout(
  plan: PlanId,
  opts: { email?: string | null; name?: string | null } = {},
): Promise<{ ok: boolean; reason?: string }> {
  if (!KEY_ID) return { ok: false, reason: "not_configured" };
  try {
    await loadScript();
    const token = await getIdToken().catch(() => null);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    // 1) Create the order server-side (amount/currency come from the plan).
    const orderRes = await fetch("/api/razorpay-order", {
      method: "POST",
      headers,
      body: JSON.stringify({ plan }),
    });
    const order = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok || !order?.orderId) {
      return { ok: false, reason: order?.error || "order_failed" };
    }

    // 2) Open Checkout and verify on success.
    return await new Promise((resolve) => {
      const rzp = new (window as any).Razorpay({
        key: order.keyId || KEY_ID,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "EXdeck",
        description: plan === "proplus" ? "EXdeck Pro Plus (1 month)" : "EXdeck Pro (1 month)",
        prefill: { email: opts.email || "", name: opts.name || "" },
        theme: { color: "#7C5CFF" },
        handler: async (resp: any) => {
          try {
            const t = await getIdToken().catch(() => token);
            const vHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (t) vHeaders.Authorization = `Bearer ${t}`;
            const v = await fetch("/api/razorpay-verify", {
              method: "POST",
              headers: vHeaders,
              body: JSON.stringify({ ...resp, plan }),
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
