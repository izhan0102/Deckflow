"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";

/**
 * Spotlight walkthrough for the editor / presentation page.
 *
 * Each step points at a real element (matched by a `data-tour` attribute).
 * The whole screen is blurred and dimmed EXCEPT a crisp rectangular hole
 * over the target — done with four blurred panels tiled around the target
 * rect (so the target itself is never covered and stays sharp). A glowing
 * ring traces the target and a tooltip card explains it.
 *
 * Smoothness: the panels, ring, and blocker all animate their geometry with
 * a single eased transition, so moving between steps glides rather than
 * snaps. A rAF loop keeps the hole locked onto the target while the layout
 * settles or the user resizes/scrolls.
 *
 * Show frequency:
 *   - Exactly once per user. The first time a given account reaches the
 *     editor the tour runs; on finish/skip we set a per-uid flag so it
 *     never shows again for them. Because the key is brand new, every
 *     existing user (no matter how long they've been registered) also
 *     sees it once on their next visit, then never again.
 */

const STORAGE_KEY = "exdeck_deck_tour_v1";

type Placement = "top" | "bottom" | "left" | "right";
type Step = { sel: string; title: string; body: string; placement?: Placement };

const STEPS: Step[] = [
  {
    sel: "tour-styles",
    title: "Restyle any slide here",
    body: "This is the style menu. Pick a different layout or variant and the current slide instantly takes on a new look — no redoing your content.",
    placement: "left",
  },
  {
    sel: "tour-add-slide",
    title: "Add a slide anywhere",
    body: "Hover between any two thumbnails and click the + to drop a fresh slide right in that spot. Add as many as you need.",
    placement: "right",
  },
  {
    sel: "tour-notes",
    title: "Generate speaker notes",
    body: "One click writes spoken notes for every slide — perfect for the teleprompter when you present, or to export alongside your deck.",
    placement: "bottom",
  },
  {
    sel: "tour-ask-ai",
    title: "Ask AI to make changes",
    body: "Type what you want — “make this punchier”, “add a slide on pricing”, “turn these into a chart” — and the AI edits the deck for you.",
    placement: "top",
  },
  {
    sel: "tour-share",
    title: "Share with a link",
    body: "Publish a live link to your deck. Anyone can open it in the browser — no account or download needed.",
    placement: "bottom",
  },
  {
    sel: "tour-present",
    title: "Present full-screen",
    body: "Launch a clean full-screen presentation. Arrow keys to move, S for notes, Esc to exit.",
    placement: "bottom",
  },
  {
    sel: "tour-export",
    title: "Export to PowerPoint or PDF",
    body: "Download a real editable .pptx, a high-res PDF, or a notes handout. Your charts, fonts, and theme come along.",
    placement: "bottom",
  },
  {
    sel: "tour-theme",
    title: "Switch the whole theme",
    body: "Recolor the entire deck in one tap. Try a few — the layout and content stay exactly where they are.",
    placement: "bottom",
  },
  {
    sel: "tour-icon",
    title: "Add icons & graphics",
    body: "Drop in any of 200,000+ icons, patterns, and decorations to bring a slide to life.",
    placement: "bottom",
  },
  {
    sel: "tour-outline",
    title: "Edit as an outline",
    body: "Prefer writing? Flip to Outline view to restructure the whole deck as a simple list, then switch back to slides.",
    placement: "bottom",
  },
];

const PAD = 8;
const RADIUS = 14;
const EASE = "cubic-bezier(.22,.61,.36,1)";
const MOVE_MS = 380;

export default function DeckTour({ userId }: { userId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);

  // Per-user flag so the tour runs exactly once for each account.
  const storeKey = `${STORAGE_KEY}:${userId || "anon"}`;

  const step = STEPS[idx];

  // Decide whether to run, then open after the editor has painted.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let seen = false;
    try { seen = !!window.localStorage.getItem(storeKey); } catch { /* ignore */ }
    if (seen) return;
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const t = window.setTimeout(() => {
      setOpen(true);
      window.requestAnimationFrame(() => setMounted(true));
    }, 850);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  // Lock scroll while the tour is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Track the current target's rect. Scroll it into view, then keep the
  // hole locked onto it via rAF. If a target genuinely doesn't exist (e.g.
  // add-slide on a one-slide deck), auto-advance after a short grace period.
  useEffect(() => {
    if (!open || !step) return;
    let cancelled = false;
    let misses = 0;

    const find = () => document.querySelector(`[data-tour="${step.sel}"]`) as HTMLElement | null;

    const el = find();
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

    const tick = () => {
      if (cancelled) return;
      const e = find();
      if (e) {
        misses = 0;
        const r = e.getBoundingClientRect();
        setRect((prev) => {
          if (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) return prev;
          return r;
        });
      } else {
        misses += 1;
        if (misses > 45) { // ~0.75s of no element → skip this step
          cancelled = true;
          setRect(null);
          advance();
          return;
        }
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx]);

  const finish = () => {
    try { window.localStorage.setItem(storeKey, "1"); } catch { /* ignore */ }
    setMounted(false);
    window.setTimeout(() => setOpen(false), 240);
  };

  const advance = () => {
    setRect(null);
    setIdx((i) => {
      if (i >= STEPS.length - 1) { finish(); return i; }
      return i + 1;
    });
  };
  const back = () => setIdx((i) => Math.max(0, i - 1));

  const tipStyle = useMemo<React.CSSProperties>(() => {
    if (!vp.w || !rect) return centerStyle();
    return positionTooltip(rect, step?.placement || "bottom", vp);
  }, [rect, step, vp]);

  if (!open || !step) return null;

  const hole = rect
    ? {
        top: clamp(rect.top - PAD, 0, vp.h),
        left: clamp(rect.left - PAD, 0, vp.w),
        width: Math.min(rect.width + PAD * 2, vp.w),
        height: Math.min(rect.height + PAD * 2, vp.h),
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[260]"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 240ms ease" }}
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
    >
      {hole ? (
        <>
          {/* Four blurred panels tiled around the crisp target hole. */}
          <Panel style={{ top: 0, left: 0, width: vp.w, height: hole.top }} />
          <Panel style={{ top: hole.top + hole.height, left: 0, width: vp.w, height: Math.max(0, vp.h - (hole.top + hole.height)) }} />
          <Panel style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <Panel style={{ top: hole.top, left: hole.left + hole.width, width: Math.max(0, vp.w - (hole.left + hole.width)), height: hole.height }} />

          {/* Transparent blocker over the target so clicks don't fire the
              real control mid-tour, keeping the walkthrough linear. */}
          <div
            style={{
              position: "fixed",
              top: hole.top, left: hole.left, width: hole.width, height: hole.height,
              borderRadius: RADIUS,
              transition: `all ${MOVE_MS}ms ${EASE}`,
              pointerEvents: "auto",
            }}
          />

          {/* Glowing ring around the target. */}
          <div
            aria-hidden
            className="exd-tour-ring"
            style={{
              position: "fixed",
              top: hole.top, left: hole.left, width: hole.width, height: hole.height,
              borderRadius: RADIUS,
              transition: `all ${MOVE_MS}ms ${EASE}`,
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        // No target yet — blur the whole screen behind the tooltip.
        <Panel style={{ inset: 0 }} />
      )}

      {/* Tooltip card */}
      <div
        key={step.sel}
        className="exd-tour-tip rounded-2xl border border-white/12 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur"
        style={{
          position: "fixed",
          width: "min(360px, calc(100vw - 24px))",
          transition: `top ${MOVE_MS}ms ${EASE}, left ${MOVE_MS}ms ${EASE}`,
          pointerEvents: "auto",
          ...tipStyle,
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
            <Sparkles size={10} /> Tour · {idx + 1} of {STEPS.length}
          </div>
          <button
            onClick={finish}
            aria-label="Skip tour"
            className="rounded-full p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>

        <h3 className="text-[16px] font-semibold text-white">{step.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === idx ? 16 : 6,
                  background: i === idx ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.22)",
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {idx > 0 && (
              <button
                onClick={back}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 transition hover:bg-white/10"
              >
                Back
              </button>
            )}
            <button
              onClick={advance}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-black transition hover:bg-white/90"
            >
              {idx >= STEPS.length - 1 ? "Done" : "Next"}
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .exd-tour-ring {
          box-shadow:
            0 0 0 2px rgba(255, 255, 255, 0.92),
            0 0 0 5px rgba(34, 211, 238, 0.28),
            0 18px 60px -12px rgba(34, 211, 238, 0.45);
          animation: exd-tour-pulse 1.8s ease-in-out infinite;
        }
        @keyframes exd-tour-pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(255,255,255,0.92), 0 0 0 5px rgba(34,211,238,0.26), 0 18px 60px -12px rgba(34,211,238,0.40); }
          50%      { box-shadow: 0 0 0 2px rgba(255,255,255,0.92), 0 0 0 9px rgba(34,211,238,0.12), 0 18px 60px -12px rgba(34,211,238,0.55); }
        }
        .exd-tour-tip { animation: exd-tour-tip-in 300ms ${EASE}; }
        @keyframes exd-tour-tip-in {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .exd-tour-ring { animation: none; }
        }
      `}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Panel({ style }: { style: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        background: "rgba(6, 6, 9, 0.55)",
        backdropFilter: "blur(7px)",
        WebkitBackdropFilter: "blur(7px)",
        transition: `all ${MOVE_MS}ms ${EASE}`,
        pointerEvents: "auto",
        ...style,
      }}
    />
  );
}

const TIP_W = 360;
const TIP_H = 220;
const M = 14;

function centerStyle(): React.CSSProperties {
  return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
}

function positionTooltip(rect: DOMRect, preferred: Placement, vp: { w: number; h: number }): React.CSSProperties {
  const space = {
    top: rect.top,
    bottom: vp.h - rect.bottom,
    left: rect.left,
    right: vp.w - rect.right,
  };
  const order: Placement[] = [preferred, "bottom", "top", "right", "left"];
  let chosen: Placement = preferred;
  for (const p of order) {
    const ok =
      (p === "top" && space.top > TIP_H + M) ||
      (p === "bottom" && space.bottom > TIP_H + M) ||
      (p === "left" && space.left > TIP_W + M) ||
      (p === "right" && space.right > TIP_W + M);
    if (ok) { chosen = p; break; }
  }

  // On narrow screens, always dock the card to the bottom of the viewport
  // so it never collides with the target or runs off-screen.
  if (vp.w < 640) {
    const below = rect.bottom + M;
    const fitsBelow = below + TIP_H < vp.h;
    return {
      left: M,
      right: M,
      width: "auto" as unknown as number,
      top: fitsBelow ? below : Math.max(M, rect.top - M - TIP_H),
    };
  }

  switch (chosen) {
    case "top":
      return { top: Math.max(M, rect.top - M - TIP_H), left: clamp(rect.left + rect.width / 2 - TIP_W / 2, M, vp.w - TIP_W - M) };
    case "left":
      return { top: clamp(rect.top + rect.height / 2 - TIP_H / 2, M, vp.h - TIP_H - M), left: Math.max(M, rect.left - M - TIP_W) };
    case "right":
      return { top: clamp(rect.top + rect.height / 2 - TIP_H / 2, M, vp.h - TIP_H - M), left: Math.min(vp.w - TIP_W - M, rect.right + M) };
    case "bottom":
    default:
      return { top: Math.min(vp.h - TIP_H - M, rect.bottom + M), left: clamp(rect.left + rect.width / 2 - TIP_W / 2, M, vp.w - TIP_W - M) };
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
