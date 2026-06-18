"use client";
import { useState } from "react";
import { Sparkles, Check, Loader2, X, Crown } from "lucide-react";
import { startTrial, razorpayConfigured } from "@/lib/razorpay";

/**
 * Premium → 7-day free trial modal. Theme-aware (light/dark via --ezd tokens).
 * One step: pick currency, tap "Start free trial" → Razorpay mandate. Shown
 * when a free user clicks a premium feature/watermark or lingers on the
 * dashboard. The caller mounts it conditionally.
 */
export default function TrialDialog({ onClose, reason, email }: { onClose: () => void; reason?: string; email?: string | null }) {
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const price = currency === "INR" ? "₹450" : "$5";

  const start = async () => {
    if (!razorpayConfigured()) { setErr("Payments aren't configured yet."); return; }
    setBusy(true); setErr(null);
    const r = await startTrial({ currency, email });
    setBusy(false);
    if (r.ok) { setDone(true); return; }
    if (r.reason && r.reason !== "dismissed") setErr(r.reason === "not_configured" ? "Payments aren't configured yet." : r.reason);
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl"
        style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg)" }}>
        {/* header band */}
        <div className="relative px-7 pt-7 pb-5" style={{ background: "var(--ezd-bg-hover)" }}>
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4" style={{ color: "var(--ezd-fg-quiet)" }}><X size={18} /></button>
          <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><Crown size={22} /></div>
          <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--ezd-fg-quiet)" }}>
            <Sparkles size={12} /> {reason || "Premium feature"}
          </div>
          <h2 className="mt-1 text-[24px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>
            {done ? "You're on Pro 🎉" : "Start your 7-day free trial"}
          </h2>
        </div>

        <div className="px-7 py-6">
          {done ? (
            <>
              <p className="text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>Your trial is active — everything&rsquo;s unlocked. You won&rsquo;t be charged for 7 days, and you can cancel anytime in Settings.</p>
              <button onClick={onClose} className="mt-5 w-full rounded-xl px-5 py-3 text-[14px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>Start creating</button>
            </>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                Unlock it free for 7 days. One easy step — then {price}/month on autopay. Cancel anytime.
              </p>
              <ul className="mt-4 space-y-2">
                {["Unlimited AI generations (10/day)", "Documents, premium templates & watermark control", "Speaker notes, Q&A, translation", "No watermark on exports"].map((h) => (
                  <li key={h} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--ezd-fg-strong)" }} /> {h}
                  </li>
                ))}
              </ul>

              <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl border p-1.5" style={{ borderColor: "var(--ezd-divider)" }}>
                {(["USD", "INR"] as const).map((c) => (
                  <button key={c} onClick={() => setCurrency(c)} className="rounded-lg px-3 py-2 text-[13px] font-semibold transition"
                    style={currency === c ? { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" } : { color: "var(--ezd-fg-muted)" }}>
                    {c === "INR" ? "₹ India" : "$ International"}
                  </button>
                ))}
              </div>

              <button onClick={start} disabled={busy}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
                {busy ? <><Loader2 size={16} className="animate-spin" /> Starting…</> : <><Sparkles size={16} /> Start 7-day free trial</>}
              </button>
              {err && <p className="mt-2 text-center text-[12.5px]" style={{ color: "#ef4444" }}>{err}</p>}
              <button onClick={onClose} className="mt-3 w-full text-center text-[12.5px]" style={{ color: "var(--ezd-fg-quiet)", background: "none", border: "none", cursor: "pointer" }}>Maybe later</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
