"use client";
import Link from "next/link";
import { Check, Sparkles, Users } from "lucide-react";
import { PLAN_ORDER, PLANS, PRODUCTS, type PlanId, deckLimitLabel } from "@/lib/plans";

/**
 * The three-tier pricing grid. Reused by the landing pricing section and
 * the dashboard upgrade modal. Upgrading isn't live yet — the CTA reports
 * "coming soon" via onUpgrade.
 */
export default function PricingPlans({
  currentPlan,
  onUpgrade,
  highlight = "pro",
}: {
  currentPlan?: PlanId;
  onUpgrade?: (plan: PlanId) => void;
  highlight?: PlanId;
}) {
  const currentIndex = currentPlan ? PLAN_ORDER.indexOf(currentPlan) : -1;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        const isCurrent = currentPlan === id;
        const thisIndex = PLAN_ORDER.indexOf(id);
        const isLower = currentIndex >= 0 && thisIndex < currentIndex;
        const featured = highlight === id;
        return (
          <div
            key={id}
            className="relative flex flex-col rounded-2xl border p-5"
            style={{
              background: featured ? "var(--ezd-bg-hover)" : "var(--ezd-bg-card)",
              borderColor: featured ? "var(--ezd-accent)" : "var(--ezd-hairline)",
            }}
          >
            {featured && (
              <span
                className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--ezd-accent)", color: "var(--ezd-button-strong-fg)" }}
              >
                <Sparkles size={10} /> Most popular
              </span>
            )}

            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{plan.name}</h3>
              {isCurrent && (
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-muted)" }}>
                  Current
                </span>
              )}
            </div>

            <div className="mb-1 flex items-end gap-1">
              <span className="text-3xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>${plan.price}</span>
              <span className="mb-1 text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>/ month</span>
            </div>
            <p className="mb-3 text-[12px]" style={{ color: "var(--ezd-fg-muted)" }}>{plan.tagline}</p>

            <div className="mb-3 rounded-lg px-3 py-2 text-[12px] font-medium"
              style={{ background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>
              {deckLimitLabel(id)} {deckLimitLabel(id) === "Unlimited" ? "decks" : "decks / month"}
            </div>

            <ul className="mb-5 flex-1 space-y-2">
              {plan.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
                  <Check size={14} className="mt-0.5 shrink-0" style={{ color: "var(--ezd-accent)" }} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            {id === "free" ? (
              <div className="rounded-xl border px-4 py-2 text-center text-[13px]"
                style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-quiet)" }}>
                {isCurrent ? "Your plan" : isLower ? "Included" : "Free forever"}
              </div>
            ) : isCurrent || isLower ? (
              <div className="rounded-xl border px-4 py-2 text-center text-[13px]"
                style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-quiet)" }}>
                {isCurrent ? "Your plan" : "Included"}
              </div>
            ) : (
              <button
                onClick={() => onUpgrade?.(id)}
                className="rounded-xl px-4 py-2 text-center text-[13px] font-semibold transition"
                style={
                  featured
                    ? { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }
                    : { border: "1px solid var(--ezd-hairline)", color: "var(--ezd-fg-strong)" }
                }
              >
                Upgrade to {plan.name}
              </button>
            )}
          </div>
        );
      })}

      {/* Teams & Organisations — one card, one button → Settings */}
      <div className="relative flex flex-col rounded-2xl border p-5" style={{ background: "var(--ezd-bg-card)", borderColor: "var(--ezd-hairline)" }}>
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Teams &amp; Organisations</h3>
        </div>
        <div className="mb-1 flex items-end gap-1">
          <span className="text-3xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>${PRODUCTS.team.usd}</span>
          <span className="mb-1 text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>/ mo and up</span>
        </div>
        <p className="mb-3 text-[12px]" style={{ color: "var(--ezd-fg-muted)" }}>Share Pro across your group.</p>
        <div className="mb-3 rounded-lg px-3 py-2 text-[12px] font-medium" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}>
          Up to {PRODUCTS.team.seats} (Team) or {PRODUCTS.org.seats} (Org) members
        </div>
        <ul className="mb-5 flex-1 space-y-2">
          {["Team — up to 3 members", "Organisation — up to 20 members", "Members auto-upgraded to Pro on sign-in"].map((h, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
              <Check size={14} className="mt-0.5 shrink-0" style={{ color: "var(--ezd-accent)" }} />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <Link href="/app/settings" className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-center text-[13px] font-semibold transition"
          style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
          <Users size={14} /> See team plans
        </Link>
      </div>
    </div>
  );
}
