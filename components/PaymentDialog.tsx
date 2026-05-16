"use client";
import { useEffect } from "react";
import type { Deck } from "@/lib/types";
import { LEGAL } from "@/lib/legal";
import { Crown, ExternalLink, Lock, ShieldCheck, X } from "lucide-react";

/**
 * Payment dialog for the PPTX export.
 *
 * Flow:
 *   1. User clicks "Pay & download" → we save the current deck id to
 *      localStorage and redirect them to Razorpay's payment page.
 *   2. On successful payment, Razorpay redirects to /payment-success
 *      where we mark the deck as paid in Firebase.
 *   3. The user lands back on /app?id=<deckId> with the deck unlocked.
 *
 * If the redirect doesn't happen (user closed the tab, payment failed,
 * etc.) the deck stays locked. There's no honour-system "I've paid"
 * button — payment proof is the redirect.
 */

const RAZORPAY_PAYMENT_URL = "https://rzp.io/rzp/NutOAwbL";
const PENDING_KEY = "deckflow_pending_paid_deck_id";

export default function PaymentDialog({
  open, deck, deckId, onClose,
}: {
  open: boolean;
  deck: Deck;
  /** Required to remember which deck the user paid for. */
  deckId: string | null;
  onClose: () => void;
}) {
  const slides = deck.slides.length;
  const subtotal = LEGAL.PRICE_PER_DECK_INR;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const goToPay = () => {
    // Remember which deck this payment is for so /payment-success can
    // unlock the right one when Razorpay redirects back.
    if (deckId) {
      try { window.localStorage.setItem(PENDING_KEY, deckId); } catch { /* ignore */ }
    }
    // Replace this tab with the Razorpay page. Keeps the redirect-back
    // simple: same tab in, same tab out.
    window.location.href = RAZORPAY_PAYMENT_URL;
  };

  const cantPay = !deckId;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-br from-amber-300/15 via-yellow-300/10 to-transparent px-5 py-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl"
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-amber-950 shadow-inner">
                <Crown size={18} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
                  DeckFlow Premium
                </div>
                <div className="mt-0.5 text-base font-semibold text-white">
                  Unlock the .pptx download
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm text-white/85 line-clamp-2">{deck.title}</div>
            {deck.subtitle && (
              <div className="mt-1 text-xs text-white/45 line-clamp-2">{deck.subtitle}</div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-sm">
              <span className="text-white/65">
                Flat fee · {slides} slide{slides === 1 ? "" : "s"}
              </span>
              <span className="text-white">₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-base font-semibold text-white">Total</span>
              <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-2xl font-bold tabular-nums text-transparent">
                ₹{subtotal.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-white/40">
              One-time payment. No subscription, no auto-renewal.
            </div>
          </div>

          <ul className="mb-4 space-y-1.5 text-[11px] text-white/65">
            <li className="flex items-center gap-2">
              <Crown size={11} className="text-amber-300" />
              Editable Microsoft PowerPoint file
            </li>
            <li className="flex items-center gap-2">
              <Crown size={11} className="text-amber-300" />
              Works in PowerPoint, Keynote, and Google Slides
            </li>
            <li className="flex items-center gap-2">
              <Crown size={11} className="text-amber-300" />
              Speaker notes, theme, and uploads preserved
            </li>
          </ul>

          <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[11px] text-white/55">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-300" />
            <span>
              You'll be redirected to Razorpay's secure payment page. After a
              successful payment we'll bring you back here and your PPTX
              download unlocks automatically.
            </span>
          </div>

          {cantPay && (
            <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-200">
              Save the deck first (it auto-saves while you edit). Then come
              back and click Pay.
            </div>
          )}

          <button
            onClick={goToPay}
            disabled={cantPay}
            className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 px-4 py-3 font-semibold text-amber-950 shadow-[0_10px_30px_-8px_rgba(251,191,36,0.6)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-12 w-12 -skew-x-12 bg-white/40 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100"
            />
            <Lock size={14} />
            Pay ₹{subtotal.toLocaleString("en-IN")} on Razorpay
            <ExternalLink size={12} className="opacity-70" />
          </button>

          <div className="mt-3 text-center text-[10px] text-white/35">
            By continuing you accept our{" "}
            <a href="/terms" className="underline hover:text-white/55">Terms</a> and{" "}
            <a href="/refund" className="underline hover:text-white/55">Refund Policy</a>.
          </div>
        </div>
      </div>
    </div>
  );
}
