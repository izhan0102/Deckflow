"use client";
import { useEffect, useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { getTheme } from "@/lib/themes";

/**
 * Full-screen "deck is being prepared" overlay.
 *
 * Three real-template slide cards on a stage. Each card progresses
 * through a deterministic build sequence: paper → accent rail → kicker
 * → title → body → footer. The phases and offsets are baked into a
 * pure CSS animation that loops forever, so React renders the tree
 * exactly once per open and the GPU does the rest.
 *
 * Why CSS instead of rAF:
 *   - The previous version re-rendered every frame via setState. That
 *     cascades through React reconciliation and triggers width/height
 *     layout work per frame, which gets glitchy under load.
 *   - Now every animated property is `transform` or `opacity` only.
 *     No layout, no paint, just compositor work. Smooth even on
 *     low-end machines.
 *
 * Cards reference real DECK_TEMPLATES themes (cobalt, emerald,
 * crimson) so the preview shows something close to what the user
 * will actually get out the other end.
 */
/** ms — total animation cycle length, before it loops. */
const CYCLE_MS = 4500;

/** ms — per-card start delay so they assemble in sequence, not all at once. */
const CARD_OFFSETS_MS = [0, 380, 760];

const ROTATING_LINES = [
  "Reading your brief…",
  "Sketching layouts…",
  "Drafting headlines…",
  "Filling in the content…",
  "Picking the right colors…",
  "Polishing the pixels…",
  "Almost there…",
];

type SlideSpec = {
  /** Theme id from lib/themes.ts. Drives bg / fg / accent / muted. */
  themeId: string;
  /** Layout the card represents. */
  variant: "hero" | "kpi" | "bullets";
  kicker: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  kpi?: { value: string; label: string }[];
  /** Footer line — looks like a real deck slug + page number. */
  meta: string;
  /** Faux page number, shown opposite the meta. */
  page: string;
};

/**
 * Three real-feeling slides spanning common deck archetypes:
 *   1. Cobalt + bullets   — Q1 investor update
 *   2. Emerald + KPIs     — Climate strategy
 *   3. Crimson + hero     — Series A pitch
 *
 * Each maps to a real DECK_TEMPLATES theme so the colors are exactly
 * what someone picking that template would see.
 */
const SLIDES: SlideSpec[] = [
  {
    themeId: "cobalt",
    variant: "bullets",
    kicker: "Q1 INVESTOR UPDATE",
    title: "What changed this quarter",
    bullets: [
      "Net retention reached 124%",
      "Three new enterprise logos signed",
      "Hiring closed two senior engineers",
    ],
    meta: "ACME · Q1 2026",
    page: "04 / 12",
  },
  {
    themeId: "emerald",
    variant: "kpi",
    kicker: "BY THE NUMBERS",
    title: "Climate strategy, year one.",
    kpi: [
      { value: "-42%",  label: "EMISSIONS" },
      { value: "78%",   label: "SUPPLIERS" },
      { value: "$4.2M", label: "INVESTED"  },
    ],
    meta: "PLEDGE 2026",
    page: "03 / 08",
  },
  {
    themeId: "crimson",
    variant: "hero",
    kicker: "SERIES A · 2026",
    title: "Rebuilding logistics, software-first.",
    subtitle: "From dispatch to delivery in one stack.",
    meta: "PITCH",
    page: "01 / 14",
  },
];

export default function GenerateOverlay({
  open,
  error,
  loading,
  onRetry,
}: {
  open: boolean;
  error?: string | null;
  loading?: boolean;
  onRetry?: () => void;
}) {

  const [lineIdx, setLineIdx] = useState(0);

  // Lock body scroll while the overlay is mounted.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Rotate the status line every 1.4s. Cheap — no per-frame work.
  useEffect(() => {
    if (!open) { setLineIdx(0); return; }
    const id = window.setInterval(() => {
      setLineIdx((i) => (i + 1) % ROTATING_LINES.length);
    }, 1400);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Generating your deck"
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(60% 50% at 50% 30%, var(--ezd-bg-hover), transparent 70%), var(--ezd-bg-page)",
      }}
    >
      <BackdropGrid />
      {/* Error Toast */}

<div
  className={`relative z-10 flex w-full max-w-4xl flex-col items-center px-6 text-center text-white transition-all duration-500 ${
    error
      ? "opacity-20 blur-md scale-[0.98]"
      : "opacity-100 blur-0 scale-100"
  }`}
>
          {/* Brand pill */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
          <Sparkles size={11} className="text-cyan-300" />
          EXdeck · cooking up your presentation
        </div>

        {/* Headline */}
        <h2
          className="mb-2 font-semibold text-white"
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
          }}
        >
          Building your presentation
        </h2>

        {/* Rotating one-liner */}
        <div className="relative h-5 w-full max-w-md overflow-hidden text-[13px] text-white/55">
          {ROTATING_LINES.map((ln, i) => (
            <span
              key={i}
              className="absolute inset-0 transition-opacity duration-500 ease-out"
              style={{ opacity: i === lineIdx ? 1 : 0 }}
            >
              {ln}
            </span>
          ))}
        </div>

        {/* Stage with three slide cards */}
        <div className="my-10 flex h-[260px] w-full items-end justify-center gap-3 sm:h-[280px]">
          {SLIDES.map((slide, idx) => (
            <BuildingSlide
              key={idx}
              slide={slide}
              role={idx === 1 ? "front" : idx === 0 ? "back-left" : "back-right"}
              offsetMs={CARD_OFFSETS_MS[idx]}
            />
          ))}
        </div>

        {/* Looping progress bar — pure CSS, GPU accelerated. */}
        <div className="relative mb-3 h-[3px] w-60 overflow-hidden rounded-full bg-white/10">
          <div
            className="ezd-progress absolute inset-y-0 left-0 origin-left rounded-full"
            style={{
              width: "100%",
              background: "var(--ezd-fg-strong)",
              boxShadow: "0 0 16px var(--ezd-bg-hover)",
            }}
          />
        </div>

        {/* AI badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
          <Wand2 size={11} className="text-cyan-300" />
          Generated by AI · open-weight model
        </div>

        <p className="mt-3 text-[10px] text-white/30">
          Sit tight. Usually about 10 seconds.
        </p>
      </div>
        {error && (
<div className="fixed inset-0 z-[350] flex items-center justify-center p-6">    <div
      className="w-full max-w-md rounded-3xl border border-red-500/30 bg-black/80 p-8 text-center backdrop-blur-xl"
      style={{
        boxShadow: "0 20px 80px rgba(255,0,0,.15)",
      }}
    >
      <div className="mb-4 text-5xl">⚠️</div>

      <h3 className="text-2xl font-semibold text-white">
        Couldn't generate presentation
      </h3>

      <p className="mt-3 text-sm text-white/60">
        Something interrupted the generation process.
      </p>

      <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-red-300">
        {error}
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={onRetry}
          disabled={loading}
          className="rounded-xl bg-white px-5 py-2.5 font-medium text-black transition hover:opacity-90"
        >
          ↻ Try Again
        </button>

        <button
          onClick={() => window.location.reload()}
          className="rounded-xl border border-white/15 px-5 py-2.5 text-white/70 transition hover:bg-white/5"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

      {/* All animation timing lives here. transform + opacity only. */}
      <style jsx global>{`
        /* Keyframe percentages are tuned against CYCLE_MS ms per cycle.
           Phase budget (in % of cycle):
              0-2    rest
              2-12   paper appears
              12-22  accent rail grows
              22-32  kicker fades in
              32-46  title fades in
              46-72  body items fade in (staggered per element)
              72-82  footer fades in
              82-100 hold (everything sits at full state) */

        @keyframes ezd-paper {
          0%, 2%   { opacity: 0; transform: translateY(14px) scale(0.94); }
          12%,100% { opacity: 1; transform: translateY(0)    scale(1); }
        }

        @keyframes ezd-rail {
          0%, 12%   { transform: scaleX(0); }
          22%, 100% { transform: scaleX(1); }
        }

        @keyframes ezd-kicker {
          0%, 22%   { opacity: 0; transform: translateY(4px); }
          32%, 100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes ezd-title {
          0%, 32%   { opacity: 0; transform: translateY(6px); }
          46%, 100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes ezd-body {
          0%, 46%   { opacity: 0; transform: translateY(6px); }
          60%, 100% { opacity: 1; transform: translateY(0); }
        }

        /* Per-item stagger inside the body phase. Items at higher index
           use a slightly later in/out point. */
        @keyframes ezd-body-2 {
          0%, 52%   { opacity: 0; transform: translateY(6px); }
          66%, 100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes ezd-body-3 {
          0%, 58%   { opacity: 0; transform: translateY(6px); }
          72%, 100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes ezd-footer {
          0%, 72%   { opacity: 0; }
          82%, 100% { opacity: 1; }
        }

        @keyframes ezd-progress {
          0%   { transform: scaleX(0); }
          92%  { transform: scaleX(1); }
          100% { transform: scaleX(1); }
        }

        /* Apply the cycle. The card root sets --d so child animations
           can read it as their animation-delay (per-card stagger). */
        .ezd-card    { will-change: transform; }
        .ezd-paper   { animation: ezd-paper   ${CYCLE_MS}ms var(--d, 0ms) cubic-bezier(.2,.7,.2,1) infinite both; transform-origin: bottom; }
        .ezd-rail    { animation: ezd-rail    ${CYCLE_MS}ms var(--d, 0ms) cubic-bezier(.2,.7,.2,1) infinite both; transform-origin: left;   }
        .ezd-kicker  { animation: ezd-kicker  ${CYCLE_MS}ms var(--d, 0ms) cubic-bezier(.2,.7,.2,1) infinite both; }
        .ezd-title   { animation: ezd-title   ${CYCLE_MS}ms var(--d, 0ms) cubic-bezier(.2,.7,.2,1) infinite both; }
        .ezd-body    { animation: ezd-body    ${CYCLE_MS}ms var(--d, 0ms) cubic-bezier(.2,.7,.2,1) infinite both; }
        .ezd-body-2  { animation: ezd-body-2  ${CYCLE_MS}ms var(--d, 0ms) cubic-bezier(.2,.7,.2,1) infinite both; }
        .ezd-body-3  { animation: ezd-body-3  ${CYCLE_MS}ms var(--d, 0ms) cubic-bezier(.2,.7,.2,1) infinite both; }
        .ezd-footer  { animation: ezd-footer  ${CYCLE_MS}ms var(--d, 0ms) cubic-bezier(.2,.7,.2,1) infinite both; }
        .ezd-progress{ animation: ezd-progress ${CYCLE_MS}ms 0ms cubic-bezier(.45,.05,.55,.95) infinite both; transform-origin: left; }

        @media (prefers-reduced-motion: reduce) {
          .ezd-paper, .ezd-rail, .ezd-kicker, .ezd-title,
          .ezd-body, .ezd-body-2, .ezd-body-3, .ezd-footer,
          .ezd-progress { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *                          Building slide card                         *
 * ------------------------------------------------------------------ */

function BuildingSlide({
  slide, role, offsetMs,
}: {
  slide: SlideSpec;
  role: "front" | "back-left" | "back-right";
  offsetMs: number;
}) {
  const theme = getTheme(slide.themeId);
  if (!theme) return null;

  const isFront = role === "front";
  const cardWidth = isFront ? 320 : 230;

  // Front card pops forward, back cards tilt and recede so the front
  // reads as the hero.
  const transform =
    role === "front"     ? "translate(0,-12px) scale(1.05)" :
    role === "back-left" ? "translate(0,10px)  scale(0.84) rotate(-3deg)" :
                           "translate(0,10px)  scale(0.84) rotate(3deg)";

  return (
    <div
      className="ezd-card relative origin-bottom"
      style={{
        width: cardWidth,
        transform,
        transition: "transform 800ms cubic-bezier(.2,.7,.2,1)",
        // CSS variable for per-card animation delay. All children read
        // this via animation-delay: var(--d).
        ["--d" as any]: `${offsetMs}ms`,
      }}
    >
      <div
        className="ezd-paper relative overflow-hidden rounded-md border shadow-[0_30px_60px_-25px_rgba(0,0,0,0.7)]"
        style={{
          aspectRatio: "16/9",
          background: theme.bg,
          color: theme.fg,
          borderColor: "var(--ezd-divider)",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Accent rail — top edge, grows left → right */}
        <div
          className="ezd-rail absolute left-0 top-0 h-[3px] w-full"
          style={{ background: theme.accent }}
        />

        {/* Side rail — left edge, decorative on bullets / kpi cards */}
        {!isFront && (
          <div
            className="absolute left-0 top-0 h-full w-[2px]"
            style={{ background: theme.accent, opacity: 0.4 }}
          />
        )}

        {/* Kicker */}
        <div
          className="ezd-kicker absolute font-semibold uppercase"
          style={{
            left: "7%",
            top: "13%",
            color: theme.accent,
            letterSpacing: "0.22em",
            fontSize: isFront ? 8.5 : 7.5,
          }}
        >
          {slide.kicker}
        </div>

        {/* Title */}
        <div
          className="ezd-title absolute font-semibold leading-[1.1]"
          style={{
            left: "7%",
            right: "7%",
            top: isFront ? "26%" : "24%",
            color: theme.fg,
            letterSpacing: "-0.012em",
            fontSize: isFront ? 16 : 12.5,
          }}
        >
          {slide.title}
        </div>

        {/* Body — bullets / KPI / hero subtitle */}
        {slide.variant === "bullets" && slide.bullets && (
          <div
            className="absolute"
            style={{ left: "7%", right: "7%", top: "55%" }}
          >
            {slide.bullets.slice(0, 3).map((b, i) => (
              <div
                key={i}
                className={i === 0 ? "ezd-body" : i === 1 ? "ezd-body-2" : "ezd-body-3"}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  marginBottom: 6,
                  fontSize: 9,
                  lineHeight: 1.35,
                  color: theme.fg,
                }}
              >
                <span style={{ color: theme.accent, lineHeight: 1 }}>—</span>
                <span style={{ opacity: 0.92 }}>{b}</span>
              </div>
            ))}
          </div>
        )}

        {slide.variant === "kpi" && slide.kpi && (
          <div
            className="absolute"
            style={{
              left: "7%", right: "7%", top: "52%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {slide.kpi.slice(0, 3).map((k, i) => (
              <div
                key={k.label}
                className={i === 0 ? "ezd-body" : i === 1 ? "ezd-body-2" : "ezd-body-3"}
              >
                <div
                  style={{
                    color: theme.accent,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {k.value}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 6,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    color: theme.muted,
                  }}
                >
                  {k.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {slide.variant === "hero" && (
          <>
            {slide.subtitle && (
              <div
                className="ezd-body absolute"
                style={{
                  left: "7%",
                  right: "7%",
                  top: "57%",
                  color: theme.muted,
                  fontSize: 10.5,
                  lineHeight: 1.4,
                }}
              >
                {slide.subtitle}
              </div>
            )}
            <div
              className="ezd-body-2 absolute"
              style={{
                left: "7%",
                bottom: "20%",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: theme.muted,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 2,
                  background: theme.accent,
                }}
              />
              ALEX CARTER, CEO
            </div>
          </>
        )}

        {/* Footer rule + slide number */}
        <div
          className="ezd-footer absolute"
          style={{
            left: "7%",
            right: "7%",
            bottom: "8%",
          }}
        >
          <div
            className="h-px"
            style={{ background: theme.fg, opacity: 0.18 }}
          />
          <div
            className="mt-1 flex items-center justify-between font-semibold"
            style={{
              fontSize: 7,
              letterSpacing: "0.22em",
              color: theme.muted,
            }}
          >
            <span>{slide.meta}</span>
            <span>{slide.page}</span>
          </div>
        </div>
      </div>

      {/* Soft glow under each card. Static — no animation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 -bottom-2 h-6 rounded-full blur-xl"
        style={{
          background: isFront ? "rgba(120,120,120,0.28)" : "rgba(120,120,120,0.14)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *                              Backdrop                                 *
 * ------------------------------------------------------------------ */

function BackdropGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(var(--ezd-divider) 1px, transparent 1px), linear-gradient(90deg, var(--ezd-divider) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        maskImage:
          "radial-gradient(ellipse at 50% 35%, black 0%, black 35%, transparent 80%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at 50% 35%, black 0%, black 35%, transparent 80%)",
        opacity: 0.4,
      }}
    />
  );
}
