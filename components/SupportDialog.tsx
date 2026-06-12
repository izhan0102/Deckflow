"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, ExternalLink, X, Sparkles } from "lucide-react";

const DONATE_URL = "https://razorpay.me/@muhammadizhan";

/**
 * "Support the project" flow.
 *
 * A small button (rendered by the trigger below) opens this dialog. The
 * user taps "Donate", which opens the Razorpay link in a new tab and
 * flips the dialog to a follow-up: "Did you donate?". On yes we show a
 * warm thank-you; on no we just close. Entirely client-side, no tracking,
 * no payment verification — it's an honest nudge, not a gate.
 */

type Phase = "ask" | "confirm" | "thanks";

export function SupportDialog({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [mounted, setMounted] = useState(false);

  // Portal target is only available on the client.
  useEffect(() => setMounted(true), []);

  // Reset to the first phase whenever the dialog reopens.
  useEffect(() => {
    if (open) setPhase("ask");
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const openDonate = () => {
    window.open(DONATE_URL, "_blank", "noopener,noreferrer");
    // Give the new tab a beat, then ask if they went through with it.
    setPhase("confirm");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border"
        style={{ background: "var(--ezd-bg-elev)", borderColor: "var(--ezd-divider)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--ezd-divider)" }}
        >
          <span className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--ezd-fg-strong)" }}>
            <Heart size={13} /> Support EXdeck
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/10"
            style={{ color: "var(--ezd-fg-muted)" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6">
          {phase === "ask" && (
            <div className="support-fade text-center">
              <div
                className="mx-auto grid h-12 w-12 place-items-center rounded-full"
                style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
              >
                <Heart size={20} />
              </div>
              <h3 className="mt-4 text-[17px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
                Keep EXdeck free and open
              </h3>
              <p className="mx-auto mt-2 max-w-[18rem] text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                It&rsquo;s built and maintained by one person, in the open.
                A small tip helps cover costs and keeps the updates coming.
                Give whatever you like.
              </p>
              <button
                onClick={openDonate}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition hover:brightness-110"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
              >
                <Heart size={14} /> Donate
                <ExternalLink size={13} className="opacity-70" />
              </button>
              <button
                onClick={onClose}
                className="mt-2 w-full rounded-xl px-4 py-2 text-[12.5px] transition"
                style={{ color: "var(--ezd-fg-quiet)" }}
              >
                Maybe later
              </button>
            </div>
          )}

          {phase === "confirm" && (
            <div className="support-fade text-center">
              <h3 className="text-[17px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
                Did you donate?
              </h3>
              <p className="mx-auto mt-2 max-w-[18rem] text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                No pressure either way — just curious. It genuinely helps to
                know people support open-source work.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={onClose}
                  className="rounded-xl border px-4 py-2.5 text-[13px] font-medium transition hover:bg-white/10"
                  style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg)" }}
                >
                  Not yet
                </button>
                <button
                  onClick={() => setPhase("thanks")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition hover:brightness-110"
                  style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
                >
                  Yes, I did
                </button>
              </div>
              <button
                onClick={() => window.open(DONATE_URL, "_blank", "noopener,noreferrer")}
                className="mt-3 inline-flex items-center gap-1 text-[12px] underline-offset-4 hover:underline"
                style={{ color: "var(--ezd-fg-quiet)" }}
              >
                Reopen the donate page <ExternalLink size={11} />
              </button>
            </div>
          )}

          {phase === "thanks" && (
            <div className="support-fade text-center">
              <div
                className="mx-auto grid h-12 w-12 place-items-center rounded-full"
                style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
              >
                <Sparkles size={20} />
              </div>
              <h3 className="mt-4 text-[17px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
                Thank you, truly.
              </h3>
              <p className="mx-auto mt-2 max-w-[18rem] text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                This kind of support is exactly what keeps EXdeck free, open,
                and improving. It means a lot. Now go make something great.
              </p>
              <button
                onClick={onClose}
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-[13px] font-semibold transition hover:brightness-110"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
              >
                You&rsquo;re welcome
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .support-fade {
          animation: support-fade 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes support-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

/**
 * Standalone trigger button + dialog. Drop <SupportButton /> anywhere on
 * the landing page; it owns its own open state.
 */
export default function SupportButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ||
          "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-white/10"
        }
      >
        <Heart size={11} /> Support the project
      </button>
      <SupportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
