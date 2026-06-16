"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Github, X } from "lucide-react";
import PricingPlans from "./PricingPlans";
import { type PlanId } from "@/lib/plans";
import { razorpayConfigured } from "@/lib/razorpay";

/**
 * Dashboard upgrade modal. Shows the pricing tiers; the Upgrade buttons send
 * the user to the dedicated /checkout page (plan, monthly/annual, coupon).
 */
export default function UpgradeDialog({
  currentPlan,
  reason,
  onClose,
  email,
}: {
  currentPlan: PlanId;
  reason?: string;
  onClose: () => void;
  email?: string | null;
}) {
  const [comingSoon, setComingSoon] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  void email;

  const notice = () => {
    setComingSoon(true);
    timeoutRef.current = window.setTimeout(() => setComingSoon(false), 3000);
  };

  const onUpgrade = (plan: PlanId) => {
    if (!razorpayConfigured()) { notice(); return; }
    onClose();
    window.location.assign(`/checkout?plan=${plan}`);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border p-6 shadow-2xl"
        style={{ background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", borderColor: "var(--ezd-hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border hover:opacity-80"
          style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-muted)" }}
          aria-label="Close"
        >
          <X size={15} />
        </button>

        <div className="mb-1 text-center">
          <h2 className="text-xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Choose your plan</h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
            {reason || "Upgrade to unlock more decks and pro features."}
          </p>
        </div>

        {comingSoon && (
          <div
            className="mx-auto mb-3 mt-3 w-fit rounded-full border px-3 py-1 text-[12px] font-medium"
            style={{ borderColor: "var(--ezd-accent)", color: "var(--ezd-fg-strong)", background: "var(--ezd-bg-hover)" }}
          >
            Paid plans are coming soon. Hang tight.
          </div>
        )}

        <div className="mt-5">
          <PricingPlans currentPlan={currentPlan} onUpgrade={onUpgrade} />
        </div>

        {/* Contributor perk — open-source contributors get a free Pro Plus
            month. Routes to the redeem page which auto-activates it. */}
        {currentPlan !== "proplus" && (
          <Link
            href="/redeem"
            onClick={onClose}
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition hover:opacity-90"
            style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)" }}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border"
                style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-strong)" }}
              >
                <Github size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
                  Contributed to EXdeck?
                </span>
                <span className="block text-[11.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
                  Click here to claim a free month of Pro Plus.
                </span>
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-medium" style={{ color: "var(--ezd-fg-strong)" }} aria-hidden>
              →
            </span>
          </Link>
        )}

        <p className="mt-4 text-center text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
          You&rsquo;re on the {currentPlan === "free" ? "Free" : currentPlan === "pro" ? "Pro" : "Pro Plus"} plan.
        </p>
      </div>
    </div>
  );
}
