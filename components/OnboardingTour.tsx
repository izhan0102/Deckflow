"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Bold, ChevronDown, Italic, Palette, Sparkles, Type,
  Underline as UnderlineIcon, X,
} from "lucide-react";

/**
 * First-visit walkthrough.
 *
 * Each step targets either a `data-tour` attribute on a real DOM node
 * (with a highlight ring + tooltip), OR is a centered "info" step that
 * has no target and shows a small visual inside the tooltip itself.
 *
 * Persistence: localStorage. The key is versioned so when we add new
 * steps every existing user gets the updated tour exactly once. New
 * users hit the same flow on their first visit. Once dismissed (or
 * completed), the key flips and nobody sees the tour again until we
 * bump the version.
 */

// v4 — added a step about the floating text-format toolbar. Bumping the
// version so every user (including those who've seen the older tour)
// gets the updated walkthrough once.
const STORAGE_KEY = "deckflow_onboarding_v4";

type StepId =
  | "start-from-scratch"
  | "format-text"   // centered info step
  | "drag-anything" // centered info step
  ;

type Step = {
  id: StepId;
  title: string;
  body: string;
  /** Element with this `data-tour` attribute is the anchor. Omit for a
   *  centered modal step (used for general-purpose info that doesn't
   *  point at one specific element). */
  target?: StepId;
  placement?: "top" | "bottom" | "left" | "right";
  /** Optional inline visual rendered above the body — useful for steps
   *  that don't have a real DOM target to highlight. */
  visual?: "format-toolbar" | "drag-handle";
};

const ALL_STEPS: Step[] = [
  {
    id: "start-from-scratch",
    title: "Make your first deck",
    body: "Type a one-line brief — topic, audience, tone — and EZdeck assembles a polished deck in about ten seconds.",
    target: "start-from-scratch",
    placement: "bottom",
  },
  {
    id: "format-text",
    title: "Format text with a selection",
    body: "Once a deck is open, select any text in a title or bullet to bring up a floating toolbar. Bold, italic, underline, font size, color — same shortcuts as Notion or Docs.",
    visual: "format-toolbar",
  },
  {
    id: "drag-anything",
    title: "Drag anything, anywhere",
    body: "Click and drag any text box, image, chart, or icon to move it on the slide. Right-click for size, position, and visibility options.",
    visual: "drag-handle",
  },
];

export default function OnboardingTour({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Decide whether to start the tour.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    let seen: string | null = null;
    try { seen = window.localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (seen) return;
    const t = window.setTimeout(() => {
      setOpen(true);
      window.requestAnimationFrame(() => setMounted(true));
    }, 700);
    return () => window.clearTimeout(t);
  }, [enabled]);

  const step = ALL_STEPS[stepIdx];
  const targeted = !!step?.target;

  // For targeted steps, scroll the target into view and track its rect.
  // For centered (info) steps, clear the rect so the tooltip renders in
  // the middle without a highlight ring.
  useEffect(() => {
    if (!open) return;

    if (!step?.target) {
      setRect(null);
      return;
    }

    let cancelled = false;

    const findTarget = () =>
      document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;

    const el = findTarget();
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    } else {
      setRect(null);
    }

    const tick = () => {
      if (cancelled) return;
      const e = findTarget();
      if (e) {
        const r = e.getBoundingClientRect();
        setRect((prev) => {
          if (!prev) return r;
          if (prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) {
            return prev;
          }
          return r;
        });
      } else {
        setRect(null);
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [open, step]);

  const finish = () => {
    try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setMounted(false);
    window.setTimeout(() => setOpen(false), 200);
  };

  const next = () => {
    if (stepIdx >= ALL_STEPS.length - 1) finish();
    else setStepIdx((s) => s + 1);
  };
  const prev = () => setStepIdx((s) => Math.max(0, s - 1));

  const tipStyle = useMemo<React.CSSProperties>(() => {
    if (typeof window === "undefined") return centerStyle();
    if (!targeted || !rect) return centerStyle();
    return positionTooltip(rect, step?.placement || "bottom");
  }, [rect, step, targeted]);

  if (!open || !step) return null;

  return (
    <div
      className="fixed inset-0 z-[200]"
      style={{
        pointerEvents: "auto",
        opacity: mounted ? 1 : 0,
        transition: "opacity 220ms ease",
      }}
    >
      {/* Dim layer */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(5, 5, 7, 0.62)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Highlight ring + cutout (only for targeted steps with a rect) */}
      {targeted && rect && (
        <>
          <div
            aria-hidden
            style={{
              position: "fixed",
              top: rect.top - 8,
              left: rect.left - 8,
              width: rect.width + 16,
              height: rect.height + 16,
              borderRadius: 14,
              background: "transparent",
              boxShadow:
                "0 0 0 9999px rgba(0, 0, 0, 0.68), 0 0 0 2px rgba(255,255,255,0.9), 0 16px 60px -10px rgba(255,255,255,0.35)",
              transition: "top 280ms cubic-bezier(.2,.7,.2,1), left 280ms cubic-bezier(.2,.7,.2,1), width 280ms cubic-bezier(.2,.7,.2,1), height 280ms cubic-bezier(.2,.7,.2,1)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "fixed",
              top: rect.top - 8,
              left: rect.left - 8,
              width: rect.width + 16,
              height: rect.height + 16,
              borderRadius: 14,
              border: "2px solid rgba(255,255,255,0.9)",
              transition: "top 280ms cubic-bezier(.2,.7,.2,1), left 280ms cubic-bezier(.2,.7,.2,1), width 280ms cubic-bezier(.2,.7,.2,1), height 280ms cubic-bezier(.2,.7,.2,1)",
              animation: "deckflow-tour-pulse 1.6s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Tooltip card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        key={step.id}
        style={{
          position: "fixed",
          maxWidth: 380,
          width: "calc(100vw - 32px)",
          ...tipStyle,
          animation: "deckflow-tour-tip 260ms ease",
        }}
        className="rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
            <Sparkles size={10} /> Quick tour · {stepIdx + 1} of {ALL_STEPS.length}
          </div>
          <button
            onClick={finish}
            aria-label="Skip tour"
            className="rounded-full p-1 text-white/45 hover:bg-white/10 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
        <h3 className="text-base font-semibold text-white">{step.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{step.body}</p>

        {/* Inline visual — only for steps that don't highlight a real element */}
        {step.visual === "format-toolbar" && <FormatToolbarVisual />}
        {step.visual === "drag-handle" && <DragHandleVisual />}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {ALL_STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === stepIdx ? 18 : 6,
                  background: i === stepIdx ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                onClick={prev}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-white/90"
            >
              {stepIdx >= ALL_STEPS.length - 1 ? "Got it" : "Next"}
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes deckflow-tour-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.0); }
          50%      { box-shadow: 0 0 0 8px rgba(255,255,255,0.18); }
        }
        @keyframes deckflow-tour-tip {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* --------------------------- inline visuals --------------------------- */

/** Mini preview of the floating selection toolbar — no live behavior,
 *  just a static representation so the user knows what to expect. */
function FormatToolbarVisual() {
  return (
    <div className="mt-4 rounded-xl border border-white/10 p-4" style={{ background: "var(--ezd-bg-elev)" }}>
      <div className="text-[11px] text-white/55">
        <span className="text-white/95" style={{ background: "rgba(255,255,255,0.22)" }}>Highlight any text</span>{" "}
        in a slide and a toolbar appears.
      </div>
      <div className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/15 p-1 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.7)]" style={{ background: "var(--ezd-bg-elev-strong)" }}>
        <FakeBtn icon={<Bold size={11} />} active />
        <FakeBtn icon={<Italic size={11} />} />
        <FakeBtn icon={<UnderlineIcon size={11} />} />
        <Sep />
        <FakeBtn icon={<Type size={11} />} extra={<ChevronDown size={9} className="opacity-60" />} />
        <FakeBtn icon={<Palette size={11} />} extra={
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-white/15"
            style={{ background: "var(--ezd-fg-strong)" }}
          />
        } />
      </div>
    </div>
  );
}

function DragHandleVisual() {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#FAFAF7] p-3">
      <div
        className="relative aspect-[16/9] w-full rounded-md"
        style={{ background: "#FAFAF7" }}
      >
        <div className="absolute left-2 top-2 h-1 w-8 rounded-sm" style={{ background: "rgba(15,23,42,0.85)" }} />
        <div
          className="absolute left-2 top-5 rounded-sm border border-dashed px-2 py-1 text-[10px] font-semibold text-slate-900"
          style={{ borderColor: "rgba(15,23,42,0.5)", background: "rgba(15,23,42,0.06)" }}
        >
          Drag me
        </div>
        <div
          className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full text-[8px] text-white"
          style={{ background: "rgba(15,23,42,0.85)" }}
          aria-hidden
        >
          ⋮
        </div>
        <div className="absolute bottom-2 left-2 right-2 grid grid-cols-1 gap-0.5 text-[8px] text-slate-700">
          <div>— Drag any text box, image, or icon</div>
          <div>— Right-click for size & visibility</div>
        </div>
      </div>
    </div>
  );
}

function FakeBtn({
  icon, active, extra,
}: { icon: React.ReactNode; active?: boolean; extra?: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 ${
        active ? "border border-cyan-300/30 bg-cyan-300/15 text-cyan-100" : "text-white/80"
      }`}
    >
      {icon}
      {extra}
    </span>
  );
}

function Sep() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 1,
        height: 14,
        background: "rgba(255,255,255,0.12)",
        margin: "0 2px",
      }}
    />
  );
}

/* --------------------------- positioning --------------------------- */

const TIP_W = 380;
const TIP_H_EST = 240;
const MARGIN = 16;

function centerStyle(): React.CSSProperties {
  return {
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
  };
}

function positionTooltip(
  rect: DOMRect, preferred: "top" | "bottom" | "left" | "right",
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const space = {
    top: rect.top,
    bottom: vh - rect.bottom,
    left: rect.left,
    right: vw - rect.right,
  };

  const order = [preferred, "bottom", "top", "right", "left"] as const;
  let chosen: "top" | "bottom" | "left" | "right" = preferred;
  for (const p of order) {
    const enough =
      (p === "top" && space.top > TIP_H_EST + MARGIN) ||
      (p === "bottom" && space.bottom > TIP_H_EST + MARGIN) ||
      (p === "left" && space.left > TIP_W + MARGIN) ||
      (p === "right" && space.right > TIP_W + MARGIN);
    if (enough) { chosen = p; break; }
  }

  switch (chosen) {
    case "top":
      return {
        top: Math.max(MARGIN, rect.top - MARGIN - TIP_H_EST),
        left: clamp(rect.left + rect.width / 2 - TIP_W / 2, MARGIN, vw - TIP_W - MARGIN),
      };
    case "bottom":
      return {
        top: Math.min(vh - TIP_H_EST - MARGIN, rect.bottom + MARGIN),
        left: clamp(rect.left + rect.width / 2 - TIP_W / 2, MARGIN, vw - TIP_W - MARGIN),
      };
    case "left":
      return {
        top: clamp(rect.top + rect.height / 2 - TIP_H_EST / 2, MARGIN, vh - TIP_H_EST - MARGIN),
        left: Math.max(MARGIN, rect.left - MARGIN - TIP_W),
      };
    case "right":
    default:
      return {
        top: clamp(rect.top + rect.height / 2 - TIP_H_EST / 2, MARGIN, vh - TIP_H_EST - MARGIN),
        left: Math.min(vw - TIP_W - MARGIN, rect.right + MARGIN),
      };
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
