"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BarChart3, Download,
  GitCommit, Github, Languages, LayoutTemplate, LogOut, MessageSquare,
  Play, Presentation, Shapes, Sparkles, Star, Wand2,
} from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import SupportButton from "@/components/SupportDialog";
import { trackEvent } from "@/lib/stats";
import { isLoggedIn, logout, onAuthStateChange, type AppUser } from "@/lib/auth";
import { FAQ, faqJsonLd } from "@/lib/seo";
import PricingPlans from "@/components/PricingPlans";
import SlideCanvas from "@/components/SlideCanvas";
import { DECK_TEMPLATES, type DeckTemplate } from "@/lib/templates";
import { getTheme } from "@/lib/themes";
import type { Slide } from "@/lib/types";

/**
 * EXdeck landing — premium monochrome SaaS.
 *
 * Design language follows the rest of the product: one black-and-white
 * identity (white-on-black in dark, black-on-white in light) driven by the
 * `--ezd-*` CSS tokens in globals.css, so every surface adapts to the theme
 * automatically. The only color on the page comes from the slide PREVIEWS —
 * the product's own colorful output, shown off against the neutral chrome.
 *
 * All colors are token-driven (var(--ezd-...)) or use the white/opacity
 * utility classes that globals.css remaps for light mode, so the page reads
 * cleanly in both themes with no per-theme branches.
 */

const DISPLAY = '"Bricolage Grotesque", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    trackEvent({ kind: "page_view", path: "/", ts: Date.now() });
    const unsub = onAuthStateChange((u) => setUser(u));

    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      unsub();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const onGetStarted = () => {
    if (isLoggedIn()) router.push("/app");
    else router.push("/auth?redirect=/app");
  };
  const onSignOut = async () => { await logout(); setUser(null); };

  return (
    <main
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}
    >
      {/* FAQ structured data for Google rich results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />

      {/* Light-mode dot texture (invisible in dark). */}
      <div aria-hidden className="landing-bg" />

      {/* ================== Nav ================== */}
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 flex justify-center px-4 transition-[padding] duration-500 ease-out",
          scrolled ? "pt-3" : "pt-0",
        ].join(" ")}
      >
        <nav
          className={[
            "flex w-full items-center justify-between gap-3 backdrop-blur-xl",
            "transition-all duration-300 ease-out will-change-[max-width,padding,border-radius]",
            scrolled
              ? "max-w-3xl rounded-full border px-3 py-1.5"
              : "max-w-[1320px] rounded-none px-5 py-3.5 sm:px-7",
          ].join(" ")}
          style={{
            background: "var(--ezd-nav-bg)",
            borderColor: scrolled ? "var(--ezd-hairline)" : "transparent",
            borderBottom: scrolled ? undefined : "1px solid var(--ezd-hairline)",
          }}
        >
          <Logo size="sm" href="/" />
          <div
            className={[
              "hidden items-center md:flex transition-[gap] duration-300 ease-out",
              scrolled ? "gap-5" : "gap-7",
            ].join(" ")}
            style={{ color: "var(--ezd-fg-muted)" }}
          >
            <a href="#features" className="text-[12.5px] transition hover:text-white">Features</a>
            <a href="#how" className="text-[12.5px] transition hover:text-white">How it works</a>
            <a href="#pricing" className="text-[12.5px] transition hover:text-white">Pricing</a>
            <a href="#faq" className="text-[12.5px] transition hover:text-white">FAQ</a>
            <Link href="/about" className="text-[12.5px] transition hover:text-white">Dev&rsquo;s note</Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="pill" />
            {user ? (
              <button
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
                style={{ color: "var(--ezd-fg-muted)" }}
              >
                <LogOut size={12} />
              </button>
            ) : (
              <Link
                href="/auth"
                className="hidden text-[12.5px] transition hover:text-white sm:inline-block"
                style={{ color: "var(--ezd-fg-muted)" }}
              >
                Sign in
              </Link>
            )}
            <button
              onClick={onGetStarted}
              className={[
                "inline-flex items-center gap-1 rounded-full text-[12.5px] font-semibold transition-all duration-300 ease-out hover:opacity-90",
                scrolled ? "px-3 py-1.5" : "px-4 py-1.5",
              ].join(" ")}
              style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
            >
              {user ? "Open editor" : "Get started"}
              <ArrowRight size={12} />
            </button>
          </div>
        </nav>
      </header>

      {/* ================== Hero ================== */}
      <section className="relative z-10 mx-auto max-w-[1200px] px-5 pb-16 pt-28 sm:px-6 sm:pt-36">
        {/* soft glow behind the hero — subtle in both themes */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px]"
          style={{ background: "radial-gradient(60% 60% at 30% 0%, var(--ezd-bg-hover), transparent 70%)" }}
        />

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
          {/* ---------- Left: copy ---------- */}
          <div className="text-center lg:text-left">
            <Reveal delay={60}>
              <h1
                className="font-semibold"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(32px, 4.2vw, 54px)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.035em",
                  color: "var(--ezd-fg-strong)",
                }}
              >
                Your next presentation,{" "}
                <span style={{ color: "var(--ezd-fg-quiet)" }}>written and designed in seconds.</span>
                <span className="sr-only">
                  {" "}EXdeck is a free AI PPT maker that turns your text into an
                  editable PowerPoint presentation with one-click PPTX and PDF export.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={120}>
              <p
                className="mx-auto mt-5 max-w-lg text-[14.5px] leading-relaxed sm:text-[15.5px] lg:mx-0"
                style={{ color: "var(--ezd-fg-muted)" }}
              >
                Type a brief, pick a template, and EXdeck builds a fully editable deck —
                real charts, themed layouts, and speaker notes. Export to PowerPoint or
                PDF, no lock-in.
              </p>
            </Reveal>

            <Reveal delay={180}>
              <div className="mt-8 flex justify-center lg:justify-start">
                <div className="flex w-full flex-col items-center gap-4 sm:w-auto">
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <button
                      onClick={onGetStarted}
                      className="group inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90 sm:w-auto"
                      style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
                    >
                      Start for free
                      <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                    </button>
                    <a
                      href="#how"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25 sm:w-auto"
                      style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}
                    >
                      <Play size={13} /> See how it works
                    </a>
                  </div>
                  <Link
                    href="/changelog"
                    className="group inline-flex items-center gap-1.5 text-[12.5px] transition hover:text-white"
                    style={{ color: "var(--ezd-fg-muted)" }}
                  >
                    <GitCommit size={13} className="transition-transform duration-300 group-hover:rotate-[20deg]" />
                    Changelog
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={240}>
              <div
                className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12.5px] lg:justify-start"
                style={{ color: "var(--ezd-fg-quiet)" }}
              >
                <span>Free to start</span>
                <Dot />
                <span>No credit card</span>
                <Dot />
                <span>Real .pptx &amp; .pdf export</span>
              </div>
            </Reveal>
          </div>

          {/* ---------- Right: live template showcase ---------- */}
          <Reveal delay={300} className="lg:justify-self-end lg:pl-10 xl:pl-16">
            <div>
              <TemplateShowcase />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================== Features (bento) ================== */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-20 sm:px-6">
        <Reveal>
          <SectionLabel
            center
            kicker="What's inside"
            title="A real editor, not a one-shot generator."
            sub="Everything you need to go from idea to a deck you'd actually present — and keep."
          />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4">
            <FeatureCard
              wide
              icon={<Wand2 size={16} />}
              title="Generate from a brief"
              body="Describe your deck in a sentence. EXdeck picks the right layout for each slide — title, bullets, table, comparison, or a real data chart — and fills it with substantive, on-topic content in about ten seconds."
            >
              <MiniBrief />
            </FeatureCard>
          </Reveal>
          <Reveal className="md:col-span-2" delay={60}>
            <FeatureCard
              icon={<BarChart3 size={16} />}
              title="Real data charts"
              body="Bar, line, area, pie, and donut — theme-colored and exported as vectors to both PPTX and PDF."
            />
          </Reveal>
          <Reveal className="md:col-span-2" delay={60}>
            <FeatureCard
              icon={<Shapes size={16} />}
              title="Edit anything inline"
              body="Drag text boxes, recolor charts, drop in any of 200,000 icons, or rewrite a slide with plain-English chat."
            />
          </Reveal>
          <Reveal className="md:col-span-2" delay={120}>
            <FeatureCard
              icon={<LayoutTemplate size={16} />}
              title="Premium templates"
              body="Canva/Gamma-grade designs with 37 themes, 28 fonts, and textured backgrounds. Switch the whole deck's look in one click."
            />
          </Reveal>
          <Reveal className="md:col-span-2" delay={120}>
            <FeatureCard
              icon={<Download size={16} />}
              title="Export, no lock-in"
              body="A real .pptx that opens in PowerPoint, Keynote, or Slides — plus a high-res .pdf. Yours to keep."
            />
          </Reveal>
        </div>

        {/* secondary feature row */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Reveal>
            <MiniFeature icon={<MessageSquare size={15} />} title="AI speaker notes" body="A spoken script per slide with a teleprompter and split-by-speaker mode." />
          </Reveal>
          <Reveal delay={60}>
            <MiniFeature icon={<Presentation size={15} />} title="Present & share" body="Full-screen present mode, plus live share links with view analytics." />
          </Reveal>
          <Reveal delay={120}>
            <MiniFeature icon={<Languages size={15} />} title="One-click translation" body="Translate a whole deck into any language with the layout preserved." />
          </Reveal>
        </div>
      </section>

      {/* ================== How it works ================== */}
      <section id="how" className="relative z-10 mx-auto max-w-3xl px-5 pb-24 pt-20 sm:px-6">
        <Reveal>
          <SectionLabel
            kicker="How it works"
            title="Five steps. Most people finish in under a minute."
            sub="Describe it, choose a look, and let EXdeck design the rest — everything stays editable."
          />
        </Reveal>
        <HowItWorks />
      </section>

      {/* ================== Examples ================== */}
      <section
        id="examples"
        className="relative z-10 border-y"
        style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
      >
        <div className="mx-auto max-w-5xl px-5 py-20 sm:px-6">
          <Reveal>
            <SectionLabel
              center
              kicker="Examples"
              title="Real slides, generated from one line."
              sub="The chrome is monochrome on purpose — so your deck's own colors do the talking."
            />
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Reveal>
              <DeckSpecimen
                tag="Pitch"
                theme={{ bg: "#0B1220", fg: "#F8FAFC", accent: "#38BDF8", muted: "#94A3B8" }}
                kicker="SERIES A · 2026"
                title="Rebuilding logistics, software-first."
                bullets={["Dispatch to delivery in one stack", "40% lower cost per shipment", "Live in 9 metros"]}
                brief="Series A pitch for a logistics platform."
              />
            </Reveal>
            <Reveal delay={80}>
              <DeckSpecimen
                tag="Lecture"
                theme={{ bg: "#FBFBF7", fg: "#0A0A0A", accent: "#B45309", muted: "#57534E" }}
                kicker="CS401 · LECTURE 4"
                title="Attention is all you need."
                bullets={["Self-attention, intuitively", "Queries, keys, and values", "One head, worked example"]}
                brief="Intro lecture on transformer architecture."
                serif
              />
            </Reveal>
            <Reveal delay={160}>
              <DeckSpecimen
                tag="Report"
                theme={{ bg: "#10241C", fg: "#ECFDF5", accent: "#34D399", muted: "#9CA3AF" }}
                kicker="FY26 · STRATEGY"
                title="Where we won this year."
                bullets={["Net retention reached 124%", "Two new enterprise segments", "Margin up 8 points"]}
                brief="Annual strategy review for the board."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================== Testimonials ================== */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-20 sm:px-6">
        <Reveal>
          <SectionLabel center kicker="Loved by builders" title="What early users say." />
        </Reveal>
        <Testimonials />
      </section>

      {/* ================== Pricing ================== */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-20 sm:px-6">
        <Reveal>
          <SectionLabel center kicker="Pricing" title="Start free. Upgrade when you present more." />
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-12 max-w-4xl">
            <PricingPlans onUpgrade={() => router.push("/auth?redirect=/app")} />
          </div>
          <p className="mt-5 text-center text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>
            Paid plans are coming soon. Everyone starts on the free plan.
          </p>
        </Reveal>
      </section>

      {/* ================== FAQ ================== */}
      <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-6">
        <Reveal>
          <SectionLabel center kicker="FAQ" title="Questions about the AI PPT maker" />
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-10 max-w-2xl border-y" style={{ borderColor: "var(--ezd-divider)" }}>
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* ================== Final CTA ================== */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-20 sm:px-6">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-3xl border px-6 py-14 text-center sm:px-10"
            style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{ background: "radial-gradient(80% 120% at 50% 0%, var(--ezd-bg-hover), transparent 70%)" }}
            />
            <h2
              className="mx-auto max-w-2xl font-semibold"
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(28px, 5vw, 50px)",
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                color: "var(--ezd-fg-strong)",
              }}
            >
              Stop staring at the empty title slide.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[14.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
              Generate your first deck free in under a minute. Edit it, present it, export it.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={onGetStarted}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90 sm:w-auto"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
              >
                Start a presentation
                <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </button>
              <Link
                href="/app/decks"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25 sm:w-auto"
                style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-strong)" }}
              >
                My decks
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================== Footer ================== */}
      <Footer />
    </main>
  );
}

/* =====================================================================
 *                          Subcomponents
 * ===================================================================== */

function Dot() {
  return <span aria-hidden style={{ color: "var(--ezd-fg-quiet)", opacity: 0.5 }}>·</span>;
}

/* ----------------------- Scroll reveal ----------------------- */

function Reveal({
  children, delay = 0, className = "",
}: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setShown(true); io.disconnect(); }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(18px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ----------------------- Section label ----------------------- */

function SectionLabel({
  kicker, title, sub, center,
}: { kicker: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : ""}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.26em]" style={{ color: "var(--ezd-fg-quiet)" }}>
        {kicker}
      </div>
      <h3
        className="mt-3 font-semibold"
        style={{
          fontFamily: DISPLAY,
          fontSize: "clamp(24px, 3.6vw, 38px)",
          lineHeight: 1.08,
          letterSpacing: "-0.028em",
          color: "var(--ezd-fg-strong)",
        }}
      >
        {title}
      </h3>
      {sub && (
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ----------------------- Feature cards ----------------------- */

function FeatureCard({
  icon, title, body, children, wide,
}: {
  icon: React.ReactNode; title: string; body: string; children?: React.ReactNode; wide?: boolean;
}) {
  return (
    <div
      className="group flex h-full flex-col rounded-2xl border p-6 transition hover:border-white/20"
      style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
    >
      <div
        className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border"
        style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
      >
        {icon}
      </div>
      <h4 className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</h4>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function MiniFeature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      className="flex h-full items-start gap-3 rounded-2xl border p-5"
      style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
    >
      <div
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
      >
        {icon}
      </div>
      <div>
        <h4 className="text-[13.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</h4>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{body}</p>
      </div>
    </div>
  );
}

function MiniBrief() {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-page)" }}
    >
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ezd-fg-quiet)" }} />
        <span className="text-[9.5px] uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)" }}>
          Brief
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ezd-fg-strong)" }}>
        &ldquo;Series A pitch for a logistics platform — problem, our edge,
        traction, market, the ask.&rdquo;
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["Investors", "Confident", "8 slides", "With charts"].map((t) => (
          <span
            key={t}
            className="rounded-full border px-2 py-0.5 text-[10.5px]"
            style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-muted)" }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------- Template showcase ----------------------- *
 * The hero's right side: a framed window that cycles through the REAL
 * deck templates from the gallery, each rendered through the same
 * SlideCanvas the editor uses. The top card "falls away" every few
 * seconds, revealing the next one rising into place. The order is
 * shuffled on every load (mixing all categories), so it always starts
 * on a random template. */

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function TemplateFrameSlide({ t }: { t: DeckTemplate }) {
  const theme = getTheme(t.themeId);
  if (!theme) return null;
  const sample: Slide = {
    layout: "title-hero",
    title: "Pitch Deck",
    subtitle: "Business presentation",
    kicker: (t.category || "Presentation").toUpperCase(),
    titleVariant: t.variants.titleVariant,
  };
  return (
    <div className="pointer-events-none w-full">
      <SlideCanvas
        slide={sample}
        theme={theme}
        idx={0}
        total={1}
        deckTitle={sample.title}
        graphicId={t.graphicId}
        graphicAccent={t.graphicAccent}
        fontId={t.fontId}
      />
    </div>
  );
}

function TemplateShowcase() {
  // Fresh random order across ALL categories on each load → random start.
  const order = useMemo(() => shuffle(DECK_TEMPLATES), []);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || order.length < 2) return;
    const id = window.setInterval(() => setStep((s) => s + 1), 3000);
    return () => window.clearInterval(id);
  }, [paused, order.length]);

  const len = order.length;
  if (len === 0) return null;
  const curr = order[step % len];
  const prev = step > 0 ? order[(step - 1) % len] : null;

  return (
    <div
      className="relative mx-auto w-full max-w-[520px] lg:w-[520px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="overflow-hidden rounded-2xl border shadow-2xl"
        style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-3 border-b px-4 py-2.5"
          style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
        >
          <span className="flex items-center gap-1.5">
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            ))}
          </span>
          <span
            className="mx-auto inline-flex min-w-0 max-w-[62%] items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px]"
            style={{ background: "var(--ezd-bg-page)", border: "1px solid var(--ezd-hairline)", color: "var(--ezd-fg-quiet)" }}
          >
            <Sparkles size={10} className="shrink-0" />
            <span className="truncate">EXdeck · {curr.name}</span>
          </span>
          <span
            className="hidden shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex"
            style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-muted)" }}
          >
            {curr.category}
          </span>
        </div>

        {/* Cycling viewport — overflow-hidden clips the falling card. */}
        <div
          className="relative aspect-[16/9] w-full overflow-hidden"
          style={{ background: "var(--ezd-bg-elev)" }}
        >
          {prev && (
            <div key={`p-${step - 1}`} className="ezd-tpl-fall absolute inset-0" style={{ zIndex: 2 }}>
              <TemplateFrameSlide t={prev} />
            </div>
          )}
          <div key={`c-${step}`} className="ezd-tpl-rise absolute inset-0" style={{ zIndex: 1 }}>
            <TemplateFrameSlide t={curr} />
          </div>
        </div>

        {/* Caption — fixed height so varying names/taglines never resize the card. */}
        <div
          className="flex h-[58px] items-center justify-between gap-3 overflow-hidden border-t px-4"
          style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
        >
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
              {curr.name}
            </div>
            <div className="truncate text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
              {curr.tagline}
            </div>
          </div>
          <span className="shrink-0 text-[10.5px] tabular-nums" style={{ color: "var(--ezd-fg-quiet)" }}>
            {len} templates
          </span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- How it works ----------------------- */

function HowItWorks() {
  const steps: { n: number; kicker: string; title: string; body: string; visual: React.ReactNode }[] = [
    { n: 1, kicker: "The brief", title: "Type what it's about.", body: "A sentence or two is enough. Topic, audience, tone. Specific beats long every time.", visual: <BriefVisual /> },
    { n: 2, kicker: "The look", title: "Pick a theme — or a template.", body: "37 palettes paginated by mood, or grab a template that bundles theme, font, and graphic in one click.", visual: <ThemeVisual /> },
    { n: 3, kicker: "The voice", title: "Choose a typeface.", body: "28 Google fonts served live, with a real-time preview of your own headline in each one.", visual: <FontVisual /> },
    { n: 4, kicker: "The texture", title: "Add an optional background.", body: "27 recolorable graphics — soft grids, mesh gradients, blueprint, halftone — tuned to your accent.", visual: <GraphicVisual /> },
    { n: 5, kicker: "The result", title: "Edit, present, export.", body: "Drag, recolor, rewrite. Present fullscreen with arrow keys. Export to .pptx or .pdf when you're ready.", visual: <EditVisual /> },
  ];

  return (
    <ol className="relative mt-12 grid gap-y-10">
      <span
        aria-hidden
        className="pointer-events-none absolute left-[15px] top-3 bottom-3 w-px"
        style={{ background: "var(--ezd-divider)" }}
      />
      {steps.map((s, i) => (
        <Reveal key={s.n} delay={i * 50}>
          <li className="relative grid grid-cols-[32px_1fr] items-start gap-x-5 sm:grid-cols-[32px_1fr_240px] sm:gap-x-7">
            <span
              className="z-10 grid h-8 w-8 place-items-center rounded-full border text-[12px] font-semibold tabular-nums"
              style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-page)", color: "var(--ezd-fg-strong)" }}
              aria-hidden
            >
              {String(s.n).padStart(2, "0")}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.26em]" style={{ color: "var(--ezd-fg-quiet)" }}>
                {s.kicker}
              </div>
              <h4 className="mt-1.5 text-[16px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: "var(--ezd-fg-strong)" }}>
                {s.title}
              </h4>
              <p className="mt-1.5 text-[13px] leading-[1.65]" style={{ color: "var(--ezd-fg-muted)" }}>
                {s.body}
              </p>
            </div>
            <div className="col-start-2 mt-3 sm:col-start-3 sm:row-start-1 sm:mt-0">
              {s.visual}
            </div>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}

function HowVisualFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      {children}
    </div>
  );
}

function BriefVisual() {
  return (
    <HowVisualFrame>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ezd-fg-quiet)" }} />
        <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}>
          Brief · 76 words
        </span>
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--ezd-fg-strong)" }}>
        Series A pitch for a logistics platform. Problem, our edge, traction so far, market, ask.
      </p>
    </HowVisualFrame>
  );
}

function ThemeVisual() {
  const swatches = [
    { bg: "#0B1220", accent: "#38BDF8" },
    { bg: "#FBFBF7", accent: "#0A0A0A" },
    { bg: "#10241C", accent: "#34D399" },
    { bg: "#1E1B4B", accent: "#A78BFA" },
    { bg: "#7F1D1D", accent: "#FCD34D" },
    { bg: "#0C2A2B", accent: "#5EEAD4" },
  ];
  return (
    <HowVisualFrame>
      <div className="grid grid-cols-3 gap-1.5">
        {swatches.map((s, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-md"
            style={{ background: s.bg, outline: i === 0 ? "2px solid var(--ezd-fg-strong)" : "1px solid var(--ezd-hairline)" }}
          >
            <span className="absolute left-1.5 top-1.5 h-1 w-3 rounded-sm" style={{ background: s.accent }} />
            <span className="absolute left-1.5 top-3 h-0.5 w-5 rounded-sm" style={{ background: s.accent, opacity: 0.55 }} />
            <span className="absolute left-1.5 top-4 h-0.5 w-4 rounded-sm" style={{ background: s.accent, opacity: 0.3 }} />
          </div>
        ))}
      </div>
    </HowVisualFrame>
  );
}

function FontVisual() {
  const samples: { name: string; family: string; mono?: boolean }[] = [
    { name: "Inter", family: '"Inter", system-ui, sans-serif' },
    { name: "Playfair", family: '"Playfair Display", Georgia, serif' },
    { name: "Bricolage", family: '"Bricolage Grotesque", system-ui, sans-serif' },
    { name: "JetBrains", family: '"JetBrains Mono", Consolas, monospace', mono: true },
  ];
  return (
    <HowVisualFrame>
      <div className="space-y-1.5">
        {samples.map((s, i) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-md border px-2.5 py-1.5"
            style={{
              borderColor: i === 0 ? "var(--ezd-fg-strong)" : "var(--ezd-hairline)",
              background: i === 0 ? "var(--ezd-bg-hover)" : "transparent",
            }}
          >
            <span
              className="text-[14px] font-semibold leading-none"
              style={{ fontFamily: s.family, letterSpacing: s.mono ? 0 : "-0.01em", color: "var(--ezd-fg-strong)" }}
            >
              Aa
            </span>
            <span className="text-[10px]" style={{ color: "var(--ezd-fg-quiet)" }}>{s.name}</span>
          </div>
        ))}
      </div>
    </HowVisualFrame>
  );
}

function GraphicVisual() {
  return (
    <div className="grid grid-cols-3 gap-1.5" style={{ color: "var(--ezd-fg-strong)" }}>
      <div className="aspect-[4/3] overflow-hidden rounded-md border" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
        <svg viewBox="0 0 80 60" className="h-full w-full" aria-hidden>
          <defs>
            <pattern id="g-grid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g-grid)" />
        </svg>
      </div>
      <div className="aspect-[4/3] overflow-hidden rounded-md border-2" style={{ borderColor: "var(--ezd-fg-strong)", background: "var(--ezd-bg-card)" }}>
        <svg viewBox="0 0 80 60" className="h-full w-full" aria-hidden>
          <path d="M 0 50 C 20 40, 40 60, 60 45 S 80 30, 80 35 L 80 60 L 0 60 Z" fill="currentColor" fillOpacity="0.30" />
          <path d="M 0 40 C 20 30, 40 50, 60 35 S 80 20, 80 28 L 80 60 L 0 60 Z" fill="currentColor" fillOpacity="0.15" />
        </svg>
      </div>
      <div className="aspect-[4/3] overflow-hidden rounded-md border" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
        <svg viewBox="0 0 80 60" className="h-full w-full" aria-hidden>
          <g fill="none" stroke="currentColor" strokeOpacity="0.5">
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
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--ezd-divider)", background: "#FFFFFF" }}>
      <div className="relative aspect-[16/9]">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-black" />
        <div className="absolute left-3 top-3 h-[2px] w-7 bg-black" />
        <div className="absolute left-3 right-3 top-[26%]">
          <div className="text-[7px] font-bold tracking-[0.3em] text-black/70">EDITED LIVE</div>
          <div className="mt-1 font-semibold leading-tight text-black" style={{ fontFamily: "ui-serif, Georgia, serif", fontSize: 13, letterSpacing: "-0.015em" }}>
            From idea to slides — in one minute.
          </div>
        </div>
        <ul className="absolute inset-x-3 bottom-3 space-y-0.5 text-[8px] leading-snug text-black">
          <li className="flex gap-1"><span className="text-black/60">—</span><span>Drag, recolor, rewrite</span></li>
          <li className="flex gap-1"><span className="text-black/60">—</span><span>Export to .pptx or .pdf</span></li>
        </ul>
      </div>
    </div>
  );
}

/* ----------------------- Deck specimen ----------------------- */

function DeckSpecimen({
  tag, kicker, title, theme, bullets, brief, serif,
}: {
  tag: string;
  kicker: string;
  title: string;
  theme: { bg: string; fg: string; accent: string; muted: string };
  bullets: string[];
  brief: string;
  serif?: boolean;
}) {
  return (
    <article
      className="overflow-hidden rounded-2xl border transition hover:-translate-y-0.5"
      style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}
    >
      <div className="p-3">
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg" style={{ background: theme.bg, color: theme.fg }}>
          <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: theme.accent }} />
          <div className="absolute left-[7%] top-[12%] text-[7.5px] font-bold" style={{ color: theme.accent, letterSpacing: "0.26em" }}>
            {kicker}
          </div>
          <div
            className="absolute left-[7%] right-[7%] top-[23%] font-semibold leading-[1.12]"
            style={{ color: theme.fg, fontFamily: serif ? "ui-serif, Georgia, serif" : "ui-sans-serif, system-ui", fontSize: 17, letterSpacing: "-0.015em" }}
          >
            {title}
          </div>
          <ul className="absolute inset-x-[7%] bottom-[12%] space-y-[5px]">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-1.5 text-[9px] leading-snug" style={{ color: theme.fg }}>
                <span style={{ color: theme.accent }}>—</span>
                <span style={{ opacity: 0.9 }}>{b}</span>
              </li>
            ))}
          </ul>
          <div className="absolute inset-x-[7%] bottom-[6%] h-px" style={{ background: theme.muted, opacity: 0.3 }} />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}
        >
          {tag}
        </span>
        <span className="text-[10px]" style={{ color: "var(--ezd-fg-quiet)" }}>16:9 · .pptx</span>
      </div>
      <p className="px-4 pb-4 text-[11.5px] leading-[1.55]" style={{ color: "var(--ezd-fg-muted)" }}>
        Brief: <em>&ldquo;{brief}&rdquo;</em>
      </p>
    </article>
  );
}

/* ----------------------- Testimonials ----------------------- */

type Review = { name: string; role: string; rating: number; text: string };

const REVIEWS: Review[] = [
  { name: "Asif Mohammad", role: "Student", rating: 5, text: "Have seen & used many PPT generators, but this is different. The UI/UX in dark mode is brilliant — pick your own theme, font, and much more. Proud to be a contributor too." },
  { name: "Aarav Mehta", role: "Product designer", rating: 5, text: "The UI is clean, the workflow makes sense, and generation is genuinely fast. No clutter, no learning curve." },
  { name: "Sofia Almeida", role: "Startup founder", rating: 4.5, text: "Speed is the standout — a full presentation came back in seconds and editing felt smooth the whole way through." },
  { name: "Rohan Iyer", role: "MBA student", rating: 5, text: "The editor is the best part. Everything is draggable, the layouts make sense, and exporting to PowerPoint just works." },
  { name: "Lena Fischer", role: "Marketing lead", rating: 4.5, text: "Minimal and quick. Pick a theme, type a brief, done. The output looks polished without throwing a hundred options at you." },
  { name: "Karthik Nair", role: "Engineering manager", rating: 5, text: "Performance is impressive. No lag when editing, charts render instantly, the whole thing feels lightweight. Well built." },
];

function Testimonials() {
  const avg = (REVIEWS.reduce((a, r) => a + r.rating, 0) / REVIEWS.length).toFixed(1);
  return (
    <div className="mt-12">
      <Reveal>
        <div className="mb-8 flex items-center justify-center gap-2 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
          <StarRating rating={4.5} size={15} />
          <span><span className="font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{avg}</span>/5 average</span>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((r, i) => (
          <Reveal key={r.name} delay={(i % 3) * 60}>
            <figure
              className="flex h-full flex-col rounded-2xl border p-6"
              style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
            >
              <StarRating rating={r.rating} size={14} />
              <blockquote className="mt-4 flex-1 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-strong)" }}>
                &ldquo;{r.text}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[12px] font-semibold"
                  style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
                  aria-hidden
                >
                  {r.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium" style={{ color: "var(--ezd-fg-strong)" }}>{r.name}</span>
                  <span className="block truncate text-[11.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>{r.role}</span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return <StarGlyph key={i} fill={fill} size={size} />;
      })}
    </span>
  );
}

function StarGlyph({ fill, size }: { fill: number; size: number }) {
  if (fill >= 1) {
    return <Star size={size} style={{ color: "var(--ezd-fg-strong)" }} fill="currentColor" strokeWidth={0} />;
  }
  if (fill <= 0) {
    return <Star size={size} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.5 }} fill="none" strokeWidth={1.5} />;
  }
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <Star size={size} className="absolute inset-0" style={{ color: "var(--ezd-fg-quiet)", opacity: 0.5 }} fill="none" strokeWidth={1.5} />
      <span className="absolute inset-0 overflow-hidden" style={{ width: size * fill }}>
        <Star size={size} style={{ color: "var(--ezd-fg-strong)" }} fill="currentColor" strokeWidth={0} />
      </span>
    </span>
  );
}

/* ----------------------- FAQ item ----------------------- */

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b" style={{ borderColor: "var(--ezd-divider)" }}>
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-medium [&::-webkit-details-marker]:hidden"
        style={{ color: "var(--ezd-fg-strong)" }}
      >
        <span>{q}</span>
        <span aria-hidden className="shrink-0 text-[18px] leading-none transition-transform duration-200 group-open:rotate-45" style={{ color: "var(--ezd-fg-quiet)" }}>
          +
        </span>
      </summary>
      <p className="pb-4 pr-8 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{a}</p>
    </details>
  );
}

/* ----------------------- Footer ----------------------- */

function Footer() {
  return (
    <footer className="relative z-10 border-t" style={{ borderColor: "var(--ezd-divider)" }}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <Logo size="sm" />
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
              Generate, edit, present, and export real presentations from a single
              brief. An indie project, written and maintained in the open.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/izhan0102/Deckflow"
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition hover:border-white/25"
                style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)" }}
              >
                <Github size={11} /> Source
              </a>
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition hover:border-white/25"
                style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)" }}
              >
                <Sparkles size={11} /> Developer&rsquo;s note
              </Link>
              <SupportButton />
            </div>
          </div>

          <FooterCol
            title="Product"
            items={[
              { label: "Features", href: "#features" },
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
              { label: "Changelog", href: "/changelog" },
              { label: "Leave a review", href: "/feedback" },
              { label: "Contact", href: "/contact" },
              { label: "Sign in", href: "/auth" },
            ]}
          />
          <FooterCol
            title="Make a PPT"
            items={[
              { label: "Free PPT maker", href: "/free-ppt-maker" },
              { label: "AI presentation maker", href: "/ai-presentation-maker" },
              { label: "AI PPT maker", href: "/ai-ppt-maker" },
              { label: "Text to PPT", href: "/text-to-ppt" },
              { label: "PowerPoint generator", href: "/powerpoint-generator" },
              { label: "Blog", href: "/blog" },
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

      <div className="mx-5 border-t border-dashed sm:mx-6" style={{ borderColor: "var(--ezd-divider)" }} />

      <div
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[10.5px] sm:px-6"
        style={{ color: "var(--ezd-fg-quiet)" }}
      >
        <span>© {new Date().getFullYear()} EXdeck — All rights reserved</span>
        <span>
          Built by{" "}
          <a
            href="https://www.linkedin.com/in/muhammad-izhan-a404752a6/"
            target="_blank" rel="noreferrer"
            className="underline-offset-4 hover:underline"
            style={{ color: "var(--ezd-fg-muted)" }}
          >
            Muhammad Izhan
          </a>{" "}
          in Bengaluru
        </span>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)" }}>
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-[12px]">
        {items.map((it) => (
          <li key={it.label}>
            <Link href={it.href} className="transition hover:text-white" style={{ color: "var(--ezd-fg-muted)" }}>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
