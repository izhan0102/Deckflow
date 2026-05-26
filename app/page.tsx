"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ChevronDown, Download, Github,
  LogOut, Shapes, Sparkles, Wand2,
} from "lucide-react";
import Logo from "@/components/Logo";
import {
  dailyActiveUsers, totalDecksGenerated, decksToday, trackEvent,
} from "@/lib/stats";
import { isLoggedIn, logout, onAuthStateChange, type AppUser } from "@/lib/auth";

/**
 * Landing — center-stage variant.
 *
 * Inspired by indie product pages (think SleekDemo): pill nav floating
 * at the top, a compact pill chip above the headline, an oversized
 * center-aligned headline with a quieter second line, two chunky CTA
 * buttons, and a single product preview that sits below the hero
 * (not next to it). No editorial split. No mock slide card sitting
 * beside the headline.
 *
 * Palette stays navy + cyan from the previous pass.
 */
export default function LandingPage() {
  const router = useRouter();
  const [today, setToday] = useState(() => new Date());
  const [user, setUser] = useState<AppUser | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    trackEvent({ kind: "page_view", path: "/", ts: Date.now() });
    const t = window.setInterval(() => setToday(new Date()), 60_000);
    const unsub = onAuthStateChange((u) => setUser(u));

    // Toggle the "shrunk pill" state once the user scrolls past a small
    // threshold. We pad to avoid flicker right at y=0.
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearInterval(t);
      unsub();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const stats = useMemo(() => ({
    dau: dailyActiveUsers(today),
    total: totalDecksGenerated(today),
    today: decksToday(today),
  }), [today]);

  const onGetStarted = () => {
    if (isLoggedIn()) router.push("/app");
    else router.push("/auth?redirect=/app");
  };
  const onSignOut = async () => { await logout(); setUser(null); };

  return (
    <main
      className="relative min-h-screen overflow-x-hidden text-[#E6EDF7]"
      style={{ background: "#050B17" }}
    >
      <BackgroundField />

      {/* ================== Nav ==================
          Fixed (not sticky) because the parent <main> uses
          overflow-x-hidden, which would silently break
          position:sticky. Fixed pins to the viewport regardless of
          ancestor overflow.
          Starts full-width with no border-radius and a hairline rule.
          As soon as the user scrolls past the hero threshold, it
          morphs into the floating pill (max-width clamped, fully
          rounded, glass background, padding inwards).
          One element, classes toggle, CSS transitions do the morph. */}
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 flex justify-center px-4 transition-[padding] duration-500 ease-out",
          scrolled ? "pt-3" : "pt-0",
        ].join(" ")}
      >
        <nav
          className={[
            "flex w-full items-center justify-between gap-3",
            "transition-all duration-500 ease-out will-change-[max-width,padding,border-radius,background-color]",
            scrolled
              ? "max-w-3xl rounded-full border border-white/10 bg-[#0A1628]/80 px-3 py-1.5 backdrop-blur-xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.6)]"
              : "max-w-[1400px] rounded-none border border-transparent border-b-white/8 bg-[#050B17]/80 px-6 py-3.5 backdrop-blur-md",
          ].join(" ")}
        >
          <Logo size="sm" href="/" />
          <div
            className={[
              "hidden items-center text-[12px] text-white/65 md:flex",
              "transition-[gap] duration-500 ease-out",
              scrolled ? "gap-5" : "gap-7",
            ].join(" ")}
          >
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#examples" className="transition hover:text-white">Examples</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <Link href="/about" className="transition hover:text-white">Dev&rsquo;s note</Link>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/5 text-white/55 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut size={11} />
              </button>
            ) : (
              <Link
                href="/auth"
                className="hidden text-[12px] text-white/65 transition hover:text-white sm:inline-block"
              >
                Sign in
              </Link>
            )}
            <button
              onClick={onGetStarted}
              className={[
                "inline-flex items-center gap-1 rounded-full bg-white text-[12px] font-medium text-[#03070F] transition-all duration-500 ease-out hover:bg-white/90",
                scrolled ? "px-3 py-1" : "px-4 py-1.5",
              ].join(" ")}
            >
              {user ? "Open editor" : "Open the editor"}
              <ArrowRight size={11} />
            </button>
          </div>
        </nav>
      </header>

      {/* ================== Hero ================== */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-32 text-center sm:pt-40">
        {/* Pill chip */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/75 backdrop-blur">
          <Sparkles size={10} className="text-cyan-300" />
          <span>Introducing EZdeck — AI deck builder that's actually good</span>
        </div>

        {/* Headline — tight, centered, two-tone */}
        <h1
          className="mx-auto max-w-[20ch] font-semibold text-white"
          style={{
            // Bricolage Grotesque — warm, slightly quirky, playful without
            // feeling clown. Already preloaded in layout.tsx.
            // Swap to "Fraunces" or "Syne" if you want even more character.
            fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
            fontSize: "clamp(34px, 5.6vw, 60px)",
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
          }}
        >
          Beautiful presentations
          <br />
          <span className="text-white/55">from a single prompt.</span>
        </h1>

        {/* Subhead */}
        <p className="mx-auto mt-5 max-w-xl text-[13.5px] leading-relaxed text-white/60">
          Type a brief, pick a theme, and EZdeck assembles a real,
          editable deck in about ten seconds. Drag boxes around, recolor
          a chart, ask the chat to rewrite a slide, export to PowerPoint.
        </p>

        {/* CTA pair */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#03070F] shadow-[0_8px_24px_-12px_rgba(255,255,255,0.45)] transition hover:bg-white/90"
          >
            <Wand2 size={13} />
            Start a deck
            <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
          </button>
          <a
            href="#how"
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/85 backdrop-blur transition hover:bg-white/10"
          >
            How it works
            <ChevronDown size={12} className="transition group-hover:translate-y-0.5" />
          </a>
        </div>

        {/* Trust line */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-[10.5px] text-white/40">
          <span>Free to draft</span>
          <Dot />
          <span>Real .pptx & .pdf export</span>
          <Dot />
          <span className="tabular-nums">
            {stats.total.toLocaleString()} decks built
          </span>
          <Dot />
          <span>Open source</span>
        </div>
      </section>

      {/* ================== Feature row ================== */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-8">
        <SectionLabel kicker="What's inside" title="A real editor, not a one-shot generator." />
        <div className="mt-9 grid grid-cols-1 gap-3 md:grid-cols-3">
          <FeatureBlock
            icon={<Wand2 size={14} />}
            title="Generate from a brief"
            body="Write a sentence or two. Pick a theme, font, and graphic — or skip and let a template do it. EZdeck assembles every layout in about ten seconds."
          />
          <FeatureBlock
            icon={<Shapes size={14} />}
            title="Edit anything inline"
            body="Drag any text box. Resize from a font grid. Recolor a chart. Drop in any of 200,000 icons. Or talk to the per-slide chat in plain English."
          />
          <FeatureBlock
            icon={<Download size={14} />}
            title="Export, no lock-in"
            body="A real .pptx that opens in PowerPoint, Keynote, or Google Slides. A high-res .pdf if you'd rather lock it. Pay once per deck. No subscriptions."
          />
        </div>
      </section>

      {/* ================== How it works ================== */}
      <section
        id="how"
        className="relative z-10 mx-auto max-w-3xl px-6 pb-24"
      >
        <SectionLabel kicker="How it works" title="Five steps. Most people finish in under a minute." />
        <HowItWorks />
      </section>

      {/* ================== Examples ================== */}
      <section
        id="examples"
        className="relative z-10 border-t border-white/8 bg-white/[0.015]"
      >
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionLabel kicker="Examples" title="Three decks built from a one-line brief." />
          <div className="mt-9 grid grid-cols-1 gap-6 md:grid-cols-3">
            <DeckSpecimen
              kicker="Investor"
              title="Series A pitch"
              theme={{ bg: "#1E40AF", fg: "#FFFFFF", accent: "#FB923C", muted: "#BFDBFE" }}
              brief="Series A pitch for a logistics platform. Problem, our edge, traction so far, market, ask."
            />
            <DeckSpecimen
              kicker="Lecture"
              title="Transformers, intro"
              theme={{ bg: "#FAFAF7", fg: "#0A0A0A", accent: "#0A0A0A", muted: "#525252" }}
              brief="Intro lecture on transformer architectures: attention, encoders, decoders, a worked example."
              serif
            />
            <DeckSpecimen
              kicker="Strategy"
              title="Annual review"
              theme={{ bg: "#1F2937", fg: "#FFFFFF", accent: "#F59E0B", muted: "#9CA3AF" }}
              brief="Annual strategy review: where we won, where we lost, the bets we are doubling down on."
            />
          </div>
        </div>
      </section>

      {/* ================== Pricing ================== */}
      <section
        id="pricing"
        className="relative z-10 mx-auto max-w-2xl px-6 py-20 text-center"
      >
        <SectionLabel center kicker="Pricing" title="Free to draft. ₹15 to download." />
        <p className="mx-auto mt-5 max-w-md text-[13.5px] leading-relaxed text-white/65">
          Generate, edit, preview, and present every deck for free.
          When you're ready, pay a one-time ₹15 to unlock the .pptx and
          .pdf for that deck. No subscriptions, no slide-count tax.
        </p>
      </section>

      {/* ================== Final CTA ================== */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-4 text-center">
        <h2
          className="mx-auto max-w-2xl font-semibold text-white"
          style={{
            fontSize: "clamp(26px, 4.4vw, 44px)",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
          }}
        >
          Stop staring at the
          <br />
          <span className="text-white/55">empty title slide.</span>
        </h2>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-6 py-2.5 text-[13px] font-semibold text-[#03070F] hover:bg-white/90"
          >
            Start a deck
          </button>
          <Link
            href="/app/decks"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-6 py-2.5 text-[13px] text-white/85 backdrop-blur transition hover:bg-white/10"
          >
            My decks <ChevronDown size={12} />
          </Link>
        </div>
      </section>

      {/* ================== Footer ================== */}
      <Footer dauToday={stats.today} />
    </main>
  );
}

/* =====================================================================
 *                          Subcomponents
 * ===================================================================== */

function Dot() {
  return <span aria-hidden className="text-white/15">·</span>;
}

function SectionLabel({
  kicker, title, center,
}: { kicker: string; title: string; center?: boolean }) {
  return (
    <div className={center ? "text-center" : ""}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-300">
        {kicker}
      </div>
      <h3
        className="mt-2 font-semibold text-white"
        style={{
          fontSize: "clamp(20px, 3vw, 32px)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>
    </div>
  );
}

function FeatureBlock({
  icon, title, body,
}: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-white/15 hover:bg-white/[0.04]">
      <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
        {icon}
      </div>
      <h4 className="text-[13.5px] font-semibold text-white">{title}</h4>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/60">{body}</p>
    </div>
  );
}

/* ----------------------- How it works -----------------------
 *
 * Vertical timeline: a continuous cyan rail down the left, numbered
 * nodes at each step, copy on the left half, a small visual on the
 * right showing what that step actually looks like in the product.
 *
 * Each visual is intentionally cheap (CSS only, no dependencies on
 * SlideCanvas) so this section stays fast and clean.
 */
function HowItWorks() {
  const steps: {
    n: number;
    kicker: string;
    title: string;
    body: string;
    visual: React.ReactNode;
  }[] = [
    {
      n: 1,
      kicker: "The brief",
      title: "Type what the deck's about.",
      body: "A sentence or two is enough. Topic, audience, tone. Specific beats long every time.",
      visual: <BriefVisual />,
    },
    {
      n: 2,
      kicker: "The look",
      title: "Pick a theme — or skip it.",
      body: "32 palettes paginated by mood. Or grab a template that bundles theme, font, and graphic in one click.",
      visual: <ThemeVisual />,
    },
    {
      n: 3,
      kicker: "The voice",
      title: "Choose a typeface.",
      body: "18 Google fonts served live, with a real-time preview of your own headline in each one.",
      visual: <FontVisual />,
    },
    {
      n: 4,
      kicker: "The texture",
      title: "Add an optional background.",
      body: "22 patterns — soft grids, mesh gradients, blueprint, halftone. Recolor any of them to match your accent.",
      visual: <GraphicVisual />,
    },
    {
      n: 5,
      kicker: "The deck",
      title: "Edit, present, export.",
      body: "Drag, recolor, rewrite. Present fullscreen with arrow keys. Export to .pptx or .pdf when you're ready.",
      visual: <EditVisual />,
    },
  ];

  return (
    <ol className="relative mt-12 grid gap-y-10">
      {/* Continuous accent rail down the left */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-cyan-300/40 via-cyan-300/10 to-transparent"
      />

      {steps.map((s) => (
        <li key={s.n} className="relative grid grid-cols-[32px_1fr] items-start gap-x-5 sm:grid-cols-[32px_1fr_240px] sm:gap-x-7">
          {/* Numbered node */}
          <span
            className="z-10 grid h-8 w-8 place-items-center rounded-full border border-cyan-300/40 bg-[#0A1628] text-[12px] font-semibold tabular-nums text-cyan-200 shadow-[0_0_18px_-4px_rgba(34,211,238,0.55)]"
            aria-hidden
          >
            {String(s.n).padStart(2, "0")}
          </span>

          {/* Copy */}
          <div className="min-w-0 pt-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-300/85">
              {s.kicker}
            </div>
            <h4 className="mt-1.5 text-[16px] font-semibold leading-tight text-white tracking-[-0.01em]">
              {s.title}
            </h4>
            <p className="mt-1.5 text-[13px] leading-[1.65] text-white/60">
              {s.body}
            </p>
          </div>

          {/* Visual */}
          <div className="col-start-2 mt-3 sm:col-start-3 sm:row-start-1 sm:mt-0">
            {s.visual}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---- Per-step visuals ---- */

function BriefVisual() {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-3 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.7)]">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/35">
          Brief · 76 words
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-white/85">
        Series A pitch for a logistics platform. Problem, our edge,
        traction so far, market, ask.
        <span className="ml-0.5 inline-block h-3 w-[6px] translate-y-[2px] animate-pulse bg-cyan-300/80" />
      </p>
    </div>
  );
}

function ThemeVisual() {
  const swatches = [
    { bg: "#0E2746", accent: "#22D3EE" },
    { bg: "#FAFAF7", accent: "#0A0A0A" },
    { bg: "#1F2937", accent: "#F59E0B" },
    { bg: "#9F1239", accent: "#FCD34D" },
    { bg: "#047857", accent: "#FCD34D" },
    { bg: "#3F3DBD", accent: "#FBBF24" },
  ];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        {swatches.map((s, i) => (
          <div
            key={i}
            className={`relative aspect-square overflow-hidden rounded-md border ${
              i === 1 ? "border-cyan-300/60 ring-1 ring-cyan-300/40" : "border-white/8"
            }`}
            style={{ background: s.bg }}
          >
            <span
              className="absolute left-1.5 top-1.5 h-1 w-3 rounded-sm"
              style={{ background: s.accent }}
            />
            <span
              className="absolute left-1.5 top-3 h-0.5 w-5 rounded-sm"
              style={{ background: s.accent, opacity: 0.55 }}
            />
            <span
              className="absolute left-1.5 top-4 h-0.5 w-4 rounded-sm"
              style={{ background: s.accent, opacity: 0.3 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FontVisual() {
  const samples: { name: string; family: string; serif?: boolean; mono?: boolean }[] = [
    { name: "Inter",    family: '"Inter", system-ui, sans-serif' },
    { name: "Playfair", family: '"Playfair Display", Georgia, serif', serif: true },
    { name: "Bricolage",family: '"Bricolage Grotesque", system-ui, sans-serif' },
    { name: "JetBrains",family: '"JetBrains Mono", Consolas, monospace', mono: true },
  ];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-2.5">
      <div className="space-y-1.5">
        {samples.map((s, i) => (
          <div
            key={s.name}
            className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 ${
              i === 0 ? "border-cyan-300/40 bg-cyan-300/5" : "border-white/6 bg-white/[0.015]"
            }`}
          >
            <span
              className="text-[14px] font-semibold leading-none text-white"
              style={{ fontFamily: s.family, letterSpacing: s.mono ? 0 : "-0.01em" }}
            >
              Aa
            </span>
            <span className="text-[10px] text-white/45">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphicVisual() {
  // Three small graphic patterns rendered inline.
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <div className="aspect-[4/3] overflow-hidden rounded-md border border-white/10 bg-[#0A1628]">
        <svg viewBox="0 0 80 60" className="h-full w-full" aria-hidden>
          <defs>
            <pattern id="g-grid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#22D3EE" strokeOpacity="0.45" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g-grid)" />
        </svg>
      </div>
      <div className="aspect-[4/3] overflow-hidden rounded-md border border-cyan-300/40 bg-[#0A1628] ring-1 ring-cyan-300/40">
        <svg viewBox="0 0 80 60" className="h-full w-full" aria-hidden>
          <path d="M 0 50 C 20 40, 40 60, 60 45 S 80 30, 80 35 L 80 60 L 0 60 Z" fill="#22D3EE" fillOpacity="0.35" />
          <path d="M 0 40 C 20 30, 40 50, 60 35 S 80 20, 80 28 L 80 60 L 0 60 Z" fill="#22D3EE" fillOpacity="0.18" />
        </svg>
      </div>
      <div className="aspect-[4/3] overflow-hidden rounded-md border border-white/10 bg-[#0A1628]">
        <svg viewBox="0 0 80 60" className="h-full w-full" aria-hidden>
          <g fill="none" stroke="#22D3EE" strokeOpacity="0.55">
            <circle cx="80" cy="30" r="20" />
            <circle cx="80" cy="30" r="32" />
            <circle cx="80" cy="30" r="44" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function EditVisual() {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#FAFAF7] shadow-[0_10px_30px_-15px_rgba(0,0,0,0.7)]">
      <div className="relative aspect-[16/9]">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-[#0E7490]" />
        <div className="absolute left-3 top-3 h-[2px] w-7 bg-[#0E7490]" />
        <div className="absolute left-3 right-3 top-[28%]">
          <div className="text-[7px] font-bold tracking-[0.3em] text-[#0E7490]">
            EDITED LIVE
          </div>
          <div
            className="mt-1 font-semibold leading-tight text-[#0F172A]"
            style={{
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: 13,
              letterSpacing: "-0.015em",
            }}
          >
            From idea to deck — in one minute.
          </div>
        </div>
        <ul className="absolute inset-x-3 bottom-3 space-y-0.5 text-[8px] leading-snug text-[#0F172A]">
          <li className="flex gap-1">
            <span className="text-[#0E7490]">—</span>
            <span>Drag, recolor, rewrite</span>
          </li>
          <li className="flex gap-1">
            <span className="text-[#0E7490]">—</span>
            <span>Export to .pptx or .pdf</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ----------------------- Deck specimen ----------------------- */

function DeckSpecimen({
  kicker, title, theme, brief, serif,
}: {
  kicker: string;
  title: string;
  theme: { bg: string; fg: string; accent: string; muted: string };
  brief: string;
  serif?: boolean;
}) {
  return (
    <article>
      <div
        className="relative aspect-[16/9] overflow-hidden rounded-lg border"
        style={{ background: theme.bg, color: theme.fg, borderColor: "rgba(140,179,230,0.18)" }}
      >
        <div
          className="absolute left-[6%] top-[14%] h-[2px] w-8"
          style={{ background: theme.accent }}
        />
        <div className="absolute left-[6%] right-[6%] top-[20%]">
          <div
            className="text-[7.5px] font-bold tracking-[0.32em]"
            style={{ color: theme.accent }}
          >
            {kicker.toUpperCase()}
          </div>
          <div
            className="mt-1.5 font-semibold leading-[1.04]"
            style={{
              color: theme.fg,
              fontFamily: serif ? "ui-serif, Georgia, serif" : "ui-sans-serif, system-ui",
              fontSize: 18,
              letterSpacing: "-0.015em",
            }}
          >
            {title}
          </div>
        </div>
        <ul
          className="absolute inset-x-[6%] bottom-[14%] space-y-1 text-[9px] leading-relaxed"
          style={{ color: theme.fg }}
        >
          <li className="flex gap-1.5">
            <span style={{ color: theme.accent }}>—</span>
            <span>Built from a one-line brief</span>
          </li>
          <li className="flex gap-1.5">
            <span style={{ color: theme.accent }}>—</span>
            <span>Edited inline, exported in seconds</span>
          </li>
        </ul>
      </div>
      <div className="mt-2 flex items-center justify-between text-[9.5px] uppercase tracking-[0.22em] text-white/40">
        <span>{kicker}</span>
        <span>16:9 · .pptx</span>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-[1.55] text-white/55">
        Brief: <em>"{brief}"</em>
      </p>
    </article>
  );
}

/* ----------------------- Footer ----------------------- */

function Footer({ dauToday }: { dauToday: number }) {
  return (
    <footer className="relative z-10 border-t border-white/8">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand block */}
          <div className="col-span-2">
            <Logo size="sm" />
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-white/50">
              Generate, edit, present, and export real presentations from
              a single brief. An indie project, written and maintained
              in the open.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <a
                href="https://github.com/izhan0102/Deckflow"
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-white/10"
              >
                <Github size={11} /> Source
              </a>
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-white/10"
              >
                <Sparkles size={11} className="text-cyan-300" /> Developer&rsquo;s note
              </Link>
            </div>
          </div>

          <FooterCol
            title="Product"
            items={[
              { label: "How it works", href: "#how" },
              { label: "Examples", href: "#examples" },
              { label: "Pricing", href: "#pricing" },
              { label: "Open the editor", href: "/app" },
            ]}
          />
          <FooterCol
            title="Company"
            items={[
              { label: "About / Dev's note", href: "/about" },
              { label: "Contact", href: "/contact" },
              { label: "Sign in", href: "/auth" },
            ]}
          />
          <FooterCol
            title="Legal"
            items={[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Refunds", href: "/refund" },
              { label: "Shipping", href: "/shipping" },
            ]}
          />
        </div>
      </div>

      <div className="mx-6 border-t border-dashed border-white/10" />

      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-[10.5px] text-white/40">
        <span>© {new Date().getFullYear()} EZdeck — All rights reserved</span>
        <span className="tabular-nums">{dauToday.toLocaleString()} decks built today</span>
        <span>
          Built by{" "}
          <a
            href="https://www.linkedin.com/in/muhammad-izhan-a404752a6/"
            target="_blank" rel="noreferrer"
            className="text-white/65 underline-offset-4 hover:underline"
          >
            Muhammad Izhan
          </a>{" "}
          in Bengaluru
        </span>
      </div>
    </footer>
  );
}

function FooterCol({
  title, items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-[12px]">
        {items.map((it) => (
          <li key={it.label}>
            {it.href.startsWith("#") || it.href.startsWith("/") ? (
              <Link href={it.href} className="text-white/65 transition hover:text-white">
                {it.label}
              </Link>
            ) : (
              <a href={it.href} className="text-white/65 transition hover:text-white">
                {it.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------- Background ----------------------- */

/**
 * Quiet field. A single soft cyan glow at the top, a subtle hairline
 * grid that fades out, and a gentle bottom haze. No spinning orbs.
 */
function BackgroundField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(140,179,230,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(140,179,230,0.10) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse at 50% 30%, black 0%, black 35%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 30%, black 0%, black 35%, transparent 80%)",
        }}
      />
      <div
        className="absolute left-1/2 top-[-10%] h-[55vh] w-[110vw] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(34,211,238,0.10) 0%, transparent 60%)",
          filter: "blur(30px)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[28vh] bg-gradient-to-t from-[#03070F] via-transparent to-transparent" />
    </div>
  );
}
