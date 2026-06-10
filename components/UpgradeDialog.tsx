"use client";
import { useState } from "react";
import { X } from "lucide-react";
import PricingPlans from "./PricingPlans";
import { type PlanId } from "@/lib/plans";

/**
 * Dashboard upgrade modal. Shows the pricing tiers and the user's current
 * plan. Subscribing isn't live yet, so the upgrade CTAs surface a
 * "coming soon" note instead of starting checkout.
 */
export default function UpgradeDialog({
  currentPlan,
  reason,
  onClose,
}: {
  currentPlan: PlanId;
  reason?: string;
  onClose: () => void;
}) {
  const [comingSoon, setComingSoon] = useState(false);

  const onUpgrade = () => {
    setComingSoon(true);
    window.setTimeout(() => setComingSoon(false), 3000);
  };

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

        <p className="mt-4 text-center text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
          You&rsquo;re on the {currentPlan === "free" ? "Free" : currentPlan === "pro" ? "Pro" : "Pro Plus"} plan.
        </p>
      </div>
    </div>
  );
}
