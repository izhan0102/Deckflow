"use client";
import { useEffect, useState } from "react";
import type { Deck } from "@/lib/types";
import { LEGAL } from "@/lib/legal";
import { CheckCircle2, Crown, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import ExportFormatPicker, { type ExportFormat } from "./ExportFormatPicker";

type Stage = "review" | "processing" | "format" | "success" | "error";

export default function PaymentDialog({
  open, deck, onClose, onPaid,
}: {
  open: boolean;
  deck: Deck;
  onClose: () => void;
  onPaid: (orderId: string, format: ExportFormat) => void | Promise<void>;
}) {
  const slides = deck.slides.length;
  const subtotal = LEGAL.PRICE_PER_DECK_INR;

  const [stage, setStage] = useState<Stage>("review");
  const [orderId, setOrderId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStage("review");
      setOrderId("");
      setError(null);
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "processing") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stage, onClose]);

  if (!open) return null;

  const startPay = () => {
    setStage("processing");
    setError(null);
    const id = `order_test_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setOrderId(id);
    window.setTimeout(() => setStage("format"), 1800);
  };

  const onFormatPicked = async (format: ExportFormat) => {
    setStage("success");
    try {
      await onPaid(orderId, format);
    } catch (e: any) {
      setError(e?.message || "Could not export.");
      setStage("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && stage !== "processing") onClose();
      }}
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
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
                    DeckFlow Premium
                  </span>
                </div>
                <div className="mt-0.5 text-base font-semibold text-white">
                  Unlock the .pptx download
                </div>
              </div>
            </div>
            {stage !== "processing" && (
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {stage === "review" && (
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
                Payments are processed by Razorpay. Card numbers and UPI handles are
                entered into Razorpay's interface and never stored on our servers.
                See our <a href="/refund" className="underline">refund policy</a>.
              </span>
            </div>

            <button
              onClick={startPay}
              className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 px-4 py-3 font-semibold text-amber-950 shadow-[0_10px_30px_-8px_rgba(251,191,36,0.6)] hover:brightness-110"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-12 w-12 -skew-x-12 bg-white/40 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100"
              />
              <Lock size={14} />
              Pay ₹{subtotal.toLocaleString("en-IN")} & download
            </button>

            <div className="mt-3 text-center text-[10px] text-white/35">
              By continuing you accept our{" "}
              <a href="/terms" className="underline hover:text-white/55">Terms</a> and{" "}
              <a href="/refund" className="underline hover:text-white/55">Refund Policy</a>.
            </div>
          </div>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <Loader2 size={32} className="mb-4 animate-spin text-violet-300" />
            <div className="text-sm font-medium text-white">Confirming payment…</div>
            <div className="mt-1 text-xs text-white/45">
              Don't close this window. This usually takes a few seconds.
            </div>
            <div className="mt-4 rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] text-white/50">
              {orderId}
            </div>
          </div>
        )}

        {stage === "format" && (
          <div className="p-5">
            <div className="mb-4">
              <div className="text-sm font-semibold text-white">Choose a format</div>
              <div className="text-[11px] text-white/55">
                Both formats are included. Pick whichever you prefer.
              </div>
            </div>
            <ExportFormatPicker onPick={onFormatPicked} />
          </div>
        )}

        {stage === "success" && (
          <div className="p-5">
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <div>
                <div className="text-sm font-semibold text-white">Payment successful</div>
                <div className="text-xs text-white/55">
                  Your download is starting now. A receipt has been emailed to your
                  registered address.
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40">Order ID</div>
                <div className="mt-0.5 font-mono text-white/85 truncate">{orderId}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40">Amount</div>
                <div className="mt-0.5 text-white/85">₹{subtotal.toLocaleString("en-IN")}</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/10"
            >
              Done
            </button>
          </div>
        )}

        {stage === "error" && (
          <div className="p-5">
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error || "Payment could not be completed."}
            </div>
            <button
              onClick={() => setStage("review")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-white/90"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
