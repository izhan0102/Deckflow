"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Check, Contact, MonitorPlay, Github, LogOut,
  Presentation, Sparkles, Star, FileText, X,
  Table, ArrowLeftRight, Brain, GraduationCap, BarChart3, LayoutTemplate,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import SupportButton from "@/components/SupportDialog";
import { trackEvent } from "@/lib/stats";
import { logout, onAuthStateChange, type AppUser } from "@/lib/auth";
import { FAQ, faqJsonLd } from "@/lib/seo";
import PricingPlans from "@/components/PricingPlans";
import SlideCanvas from "@/components/SlideCanvas";
import { DECK_TEMPLATES, type DeckTemplate } from "@/lib/templates";
import { getTheme } from "@/lib/themes";
import type { Slide } from "@/lib/types";

/**
 * EXdeck landing - premium monochrome SaaS.
 *
 * Design language follows the rest of the product: one black-and-white
 * identity (white-on-black in dark, black-on-white in light) driven by the
 * `--ezd-*` CSS tokens in globals.css, so every surface adapts to the theme
 * automatically. The only color on the page comes from the slide PREVIEWS -
 * the product's own colorful output, shown off against the neutral chrome.
 *
 * All colors are token-driven (var(--ezd-...)) or use the white/opacity
 * utility classes that globals.css remaps for light mode, so the page reads
 * cleanly in both themes with no per-theme branches.
 */

const DISPLAY = '"Bricolage Grotesque", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, "Roboto Mono", monospace';
const HERO = '"Bitcount Single", "Fontdiner Swanky", ui-sans-serif, system-ui, sans-serif';

/** The full tool suite, rendered as one divided index grid (no boxed icon
 *  tiles). Icons stay small, inline, and muted - wayfinding, not decoration. */
const TOOLS: { name: string; sub: string; href: string; icon: LucideIcon }[] = [
  { name: "Ask EX-AI", sub: "Your AI guide", href: "/ex-ai", icon: Sparkles },
  { name: "Template Lab", sub: "Edit your template with AI", href: "/template-lab", icon: LayoutTemplate },
  { name: "Presentations", sub: "AI slide maker", href: "/presentations", icon: Presentation },
  { name: "Documents", sub: "AI doc writer", href: "/documents", icon: FileText },
  { name: "Resumes", sub: "CV builder", href: "/resumes", icon: Contact },
  { name: "PDF Presenter", sub: "Present PDFs", href: "/pdf-presenter", icon: MonitorPlay },
  { name: "Spreadsheet", sub: "AI Excel maker", href: "/spreadsheet", icon: Table },
  { name: "Analyser", sub: "Analyse any file", href: "/analyse", icon: Brain },
  { name: "Converters", sub: "Free file tools", href: "/converter", icon: ArrowLeftRight },
  { name: "Flashcards", sub: "Study & quiz", href: "/flashcards", icon: GraduationCap },
];

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [latestChange, setLatestChange] = useState<string | null>(null);

  useEffect(() => {
    trackEvent({ kind: "page_view", path: "/", ts: Date.now() });
    const unsub = onAuthStateChange((u) => setUser(u));

    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Latest changelog entry for the hero "What's new" pill.
    fetch("/api/changelog-latest")
      .then((r) => r.json())
      .then((d) => { if (d?.title) setLatestChange(String(d.title)); })
      .catch(() => {});

    return () => {
      unsub();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const onGetStarted = () => {
    router.push("/app");
  };
  const onSignOut = async () => { await logout(); setUser(null); };

  return (
    <main
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)", fontFamily: DISPLAY }}
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
            <Link href="/benchmarks" className="text-[12.5px] transition hover:text-white">Benchmarks</Link>
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
                style={{ color: "var(--ezd-fg-muted)", touchAction: "manipulation", minHeight: "44px", minWidth: "44px" }}
              >
                <LogOut size={12} />
              </button>
            ) : (
              <Link
                href="/auth"
                className="hidden text-[12.5px] transition hover:text-white sm:inline-block"
                style={{ color: "var(--ezd-fg-muted)", touchAction: "manipulation" }}
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
              style={{ 
                background: "var(--ezd-button-strong)", 
                color: "var(--ezd-button-strong-fg)",
                touchAction: "manipulation",
                minHeight: "44px",
              }}
            >
              {user ? "Open editor" : "Get started"}
              <ArrowRight size={12} />
            </button>
          </div>
        </nav>
      </header>

      {/* ================== Hero ================== */}
      <section className="relative z-10 mx-auto max-w-[1200px] px-5 pb-16 pt-28 sm:px-6 sm:pt-36">
        {/* Layered backdrop: soft glow + masked grid for depth (both themes) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]"
          style={{ background: "radial-gradient(55% 55% at 50% -5%, var(--ezd-bg-hover), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(var(--ezd-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--ezd-hairline) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(60% 55% at 50% 0%, black, transparent 78%)",
            WebkitMaskImage: "radial-gradient(60% 55% at 50% 0%, black, transparent 78%)",
          }}
        />

        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          {/* Headline */}
          <Reveal delay={80}>
            <h1
              className="mt-6 font-semibold"
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(42px, 7vw, 82px)",
                lineHeight: 0.95,
                letterSpacing: "-0.045em",
                color: "var(--ezd-fg-strong)",
              }}
            >
              Make a presentation
              <br />
              in{" "}
              <span style={{ position: "relative", fontFamily: HERO, letterSpacing: "-0.02em" }}>
                seconds
                <span
                  aria-hidden
                  style={{
                    position: "absolute", left: 0, right: 0, bottom: "0.06em", height: "0.12em",
                    background: "var(--ezd-fg-strong)", borderRadius: 999, opacity: 0.9,
                  }}
                />
              </span>
              .
              <span className="sr-only">
                {" "}EXdeck, also searched as Exdeck and Ex deck, is a free AI PPT maker that turns your text into an
                editable PowerPoint presentation with one-click PPTX and PDF export.
              </span>
            </h1>
          </Reveal>

          {/* Subhead */}
          <Reveal delay={140}>
            <p
              className="mx-auto mt-6 max-w-xl text-[16.5px] leading-relaxed sm:text-[18px]"
              style={{ color: "var(--ezd-fg-muted)" }}
            >
              Type one line. EXdeck&rsquo;s AI writes and designs a full, editable PowerPoint — with real
              3D data charts, premium themes, and one-click <span style={{ color: "var(--ezd-fg-strong)", fontWeight: 600 }}>.pptx &amp; PDF</span> export.
            </p>
          </Reveal>

          {/* CTAs */}
          <Reveal delay={200}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onGetStarted}
                className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold shadow-lg transition hover:scale-[1.02] hover:opacity-95"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)", touchAction: "manipulation", minHeight: "48px" }}
              >
                Start free — build a deck
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border px-7 py-3.5 text-[15px] font-semibold transition hover:bg-white/5"
                style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-strong)", background: "var(--ezd-bg-card)", minHeight: "48px" }}
              >
                <MonitorPlay size={16} /> See how it works
              </a>
            </div>
          </Reveal>

          {/* Feature chips */}
          <Reveal delay={260}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
              {[
                "Real .pptx & PDF export",
                "3D data charts",
                "45 themes · 200k icons",
                "No card needed",
                "No login for your first deck",
              ].map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5">
                  <Check size={14} style={{ color: "var(--ezd-fg-strong)" }} /> {f}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================== Collaboration Mode ================== */}
      <section id="collaboration" className="relative z-10 mx-auto max-w-5xl px-5 pt-16 sm:px-6">
        <Reveal>
          <div className="grid grid-cols-1 gap-8 border-t pt-10 md:grid-cols-[0.9fr_1.1fr]" style={{ borderColor: "var(--ezd-divider)" }}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>
                Collaboration Mode
              </div>
              <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-[38px]" style={{ color: "var(--ezd-fg-strong)" }}>
                Edit the same deck together.
              </h2>
              <p className="mt-4 text-[14.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                EXdeck collaboration lets invited teammates open the same presentation, edit with the normal deck editor, and see a clear Changes history with each person&apos;s name and @username attached to the work.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border p-5" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)" }}>
              {[
                "Invite Exdeck users as owners, editors, or viewers",
                "Track slide edits, text updates, regenerated slides, images, layouts, themes, and AI changes",
                "Show chronological Changes with names, @usernames, avatars, timestamps, and undo-ready history",
                "Keep the current EXdeck editor UI, theme controls, slide canvas, AI tools, and exports",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--ezd-fg-strong)" }} />
                  <span className="text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================== The whole suite ================== */}
      <section id="tools" className="relative z-10 mx-auto max-w-5xl px-5 pt-24 sm:px-6">
        <Reveal>
          <SectionLabel
            center
            kicker="One account, every tool"
            title="Not just slides - a whole AI workspace."
            sub="Presentations are only the start. The same engine writes documents, builds spreadsheets, drafts resumes, runs mock interviews, and converts files - all in one place."
          />
        </Reveal>
        <Reveal delay={80}>
          <div
            className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-5"
            style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-hairline)" }}
          >
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className="group flex flex-col gap-3 bg-[var(--ezd-bg-page)] p-5 transition-colors hover:bg-[var(--ezd-bg-card)]"
                >
                  <Icon
                    size={17}
                    strokeWidth={1.75}
                    className="text-[color:var(--ezd-fg-quiet)] transition-colors group-hover:text-[color:var(--ezd-fg-strong)]"
                  />
                  <div>
                    <div className="flex items-center gap-1 text-[13px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
                      {t.name}
                      <ArrowRight
                        size={12}
                        className="-translate-x-1 text-[color:var(--ezd-fg-quiet)] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                      />
                    </div>
                    <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>{t.sub}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* ================== Beyond slides: docs & sheets ================== */}
      <section id="docs-sheets" className="relative z-10 mx-auto max-w-5xl px-5 pt-16 sm:px-6">
        <Reveal>
          <SectionLabel
            center
            kicker="More than presentations"
            title="Also an AI document & spreadsheet maker"
            sub="EXdeck isn't only slides. The same AI writes structured, Word-style documents and builds live Excel spreadsheets from plain English - all editable, all exportable."
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-12">
          <Reveal variant="left">
            <div className="border-t pt-6" style={{ borderColor: "var(--ezd-fg-strong)" }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>
                Document maker
              </div>
              <h3 className="mt-3 text-[22px] font-semibold leading-tight" style={{ fontFamily: DISPLAY, color: "var(--ezd-fg-strong)", letterSpacing: "-0.02em" }}>
                Reports that read like you wrote them.
              </h3>
              <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                Describe a report, proposal, brief, or essay and AI writes a structured, Word-style document - headings, tables, data charts, images, and watermarks - with clean multi-page PDF export.
              </p>
              <ul className="mt-5 space-y-2">
                {["Reports, proposals, case studies & essays", "Tables, charts, images & watermarks", "Inline editing + multi-page PDF export"].map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                    <span className="mt-2 h-px w-3 shrink-0" style={{ background: "var(--ezd-fg-quiet)" }} />{p}
                  </li>
                ))}
              </ul>
              <Link href="/documents" className="group mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold transition hover:opacity-80" style={{ color: "var(--ezd-fg-strong)" }}>
                Explore the document maker <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
          <Reveal delay={80} variant="right">
            <div className="border-t pt-6" style={{ borderColor: "var(--ezd-fg-strong)" }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>
                Spreadsheet maker
              </div>
              <h3 className="mt-3 text-[22px] font-semibold leading-tight" style={{ fontFamily: DISPLAY, color: "var(--ezd-fg-strong)", letterSpacing: "-0.02em" }}>
                Type the table. Get the formulas.
              </h3>
              <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                Say what you want - &ldquo;make a table of this data&rdquo;, &ldquo;add a total column&rdquo; - and AI builds and edits the sheet with live formulas. Export to Excel (.xlsx) or PDF, right in your browser.
              </p>
              <ul className="mt-5 space-y-2">
                {["Plain-English tables, totals & formulas", "Live SUM, AVERAGE, IF and more", "Excel (.xlsx) & PDF export, fully private"].map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
                    <span className="mt-2 h-px w-3 shrink-0" style={{ background: "var(--ezd-fg-quiet)" }} />{p}
                  </li>
                ))}
              </ul>
              <Link href="/spreadsheet" className="group mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold transition hover:opacity-80" style={{ color: "var(--ezd-fg-strong)" }}>
                Explore the spreadsheet maker <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </Link>
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
            sub="Everything you need to go from idea to a deck you'd actually present - and keep."
          />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4" variant="scale">
            <FeatureCard
              wide
              title="Generate from a brief"
              body="Describe your deck in a sentence. EXdeck picks the right layout for each slide - title, bullets, table, comparison, or a real data chart - and fills it with substantive, on-topic content in about ten seconds."
            >
              <MiniBrief />
            </FeatureCard>
          </Reveal>
          <Reveal className="md:col-span-2" variant="scale" delay={60}>
            <FeatureCard
              title="Real data charts"
              body="Bar, line, area, pie, and donut - theme-colored and exported as vectors to both PPTX and PDF."
            />
          </Reveal>
          <Reveal className="md:col-span-2" variant="scale" delay={60}>
            <FeatureCard
              title="Edit anything inline"
              body="Drag text boxes, recolor charts, drop in any of 200,000 icons, or rewrite a slide with plain-English chat."
            />
          </Reveal>
          <Reveal className="md:col-span-2" variant="scale" delay={120}>
            <FeatureCard
              title="Premium templates"
              body="Canva/Gamma-grade designs with 45 themes, 28 fonts, and textured backgrounds. Switch the whole deck's look in one click."
            />
          </Reveal>
          <Reveal className="md:col-span-2" variant="scale" delay={120}>
            <FeatureCard
              title="Export, no lock-in"
              body="A real .pptx that opens in PowerPoint, Keynote, or Slides - plus a high-res .pdf. Yours to keep."
            />
          </Reveal>
        </div>

        {/* secondary feature row */}
        <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-3">
          <Reveal>
            <MiniFeature title="AI speaker notes" body="A spoken script per slide with a teleprompter and split-by-speaker mode." />
          </Reveal>
          <Reveal delay={60}>
            <MiniFeature title="Present & share" body="Full-screen present mode, plus live share links with view analytics." />
          </Reveal>
          <Reveal delay={120}>
            <MiniFeature title="One-click translation" body="Translate a whole deck into any language with the layout preserved." />
          </Reveal>
        </div>
      </section>

      {/* ================== How it works ================== */}
      <section id="how" className="relative z-10 mx-auto max-w-3xl px-5 pb-24 pt-20 sm:px-6">
        <Reveal>
          <SectionLabel
            kicker="How it works"
            title="Five steps. Most people finish in under a minute."
            sub="Describe it, choose a look, and let EXdeck design the rest - everything stays editable."
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
              sub="The chrome is monochrome on purpose - so your deck's own colors do the talking."
            />
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Reveal variant="scale">
              <DeckSpecimen
                tag="Pitch"
                theme={{ bg: "#0B1220", fg: "#F8FAFC", accent: "#38BDF8", muted: "#94A3B8" }}
                kicker="SERIES A - 2026"
                title="Rebuilding logistics, software-first."
                bullets={["Dispatch to delivery in one stack", "40% lower cost per shipment", "Live in 9 metros"]}
                brief="Series A pitch for a logistics platform."
              />
            </Reveal>
            <Reveal delay={80} variant="scale">
              <DeckSpecimen
                tag="Lecture"
                theme={{ bg: "#FBFBF7", fg: "#0A0A0A", accent: "#B45309", muted: "#57534E" }}
                kicker="CS401 - LECTURE 4"
                title="Attention is all you need."
                bullets={["Self-attention, intuitively", "Queries, keys, and values", "One head, worked example"]}
                brief="Intro lecture on transformer architecture."
                serif
              />
            </Reveal>
            <Reveal delay={160} variant="scale">
              <DeckSpecimen
                tag="Report"
                theme={{ bg: "#10241C", fg: "#ECFDF5", accent: "#34D399", muted: "#9CA3AF" }}
                kicker="FY26 - STRATEGY"
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

      {/* ================== Competitors Comparison ================== */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-20 sm:px-6">
        <Reveal>
          <SectionLabel center kicker="Why choose EXdeck" title="Better than the rest - honest comparison." />
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-10 max-w-4xl overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
                  <th className="pb-4 pr-4 text-left font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Feature</th>
                  <th className="px-3 pb-4 text-center font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
                    <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
                      EXdeck
                    </div>
                  </th>
                  <th className="px-3 pb-4 text-center font-medium" style={{ color: "var(--ezd-fg-muted)" }}>Gamma</th>
                  <th className="px-3 pb-4 text-center font-medium" style={{ color: "var(--ezd-fg-muted)" }}>Tome</th>
                  <th className="px-3 pb-4 text-center font-medium" style={{ color: "var(--ezd-fg-muted)" }}>Canva AI</th>
                  <th className="px-3 pb-4 text-center font-medium" style={{ color: "var(--ezd-fg-muted)" }}>Beautiful.ai</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
                  <td className="py-4 pr-4 font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Price (Pro)</td>
                  <td className="px-3 py-4 text-center font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>$1.99/mo</td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>$15/mo</td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>$20/mo</td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>$15/mo</td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>$12/mo</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
                  <td className="py-4 pr-4 font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Real .pptx export</td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><X size={18} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.4 }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
                  <td className="py-4 pr-4 font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Free plan</td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>Limited</td>
                  <td className="px-3 py-4 text-center"><X size={18} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.4 }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><X size={18} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.4 }} className="mx-auto" /></td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
                  <td className="py-4 pr-4 font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Inline editor</td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>Limited</td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
                  <td className="py-4 pr-4 font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Docs + Decks</td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>Decks only</td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>Decks only</td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>Decks only</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
                  <td className="py-4 pr-4 font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Reuse your own template</td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><X size={18} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.4 }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><X size={18} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.4 }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><X size={18} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.4 }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><X size={18} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.4 }} className="mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 pr-4 font-medium" style={{ color: "var(--ezd-fg-strong)" }}>No lock-in</td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>Partial</td>
                  <td className="px-3 py-4 text-center"><X size={18} style={{ color: "var(--ezd-fg-quiet)", opacity: 0.4 }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center"><Check size={18} style={{ color: "#34D399" }} className="mx-auto" /></td>
                  <td className="px-3 py-4 text-center" style={{ color: "var(--ezd-fg-muted)" }}>Partial</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <div className="mx-auto mt-10 max-w-2xl space-y-6 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            <p>
              <span className="font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Why EXdeck costs 3x less:</span> We're
              an indie project built for designers, developers, and students who need fast, honest presentations - not enterprise
              sales teams. No bloat, no upsells, no tiered feature walls. You get everything at $1.99/month, and your decks export
              to real PowerPoint files you own forever.
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>What makes us different:</span> Most AI
              presentation tools lock you into their web editor or charge per-seat for teams. EXdeck gives you true .pptx export
              from day one - take your deck to PowerPoint, Google Slides, or Keynote and never look back. We also build documents
              and resumes with the same AI engine, so you're not paying for three separate tools.
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>No vendor lock-in:</span> Your presentations
              are yours. Export to .pptx or .pdf anytime, no restrictions, no watermarks on the Pro plan. Edit them locally, share
              them freely, present them anywhere. We believe you should own what you create.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ================== Why $1.99 ================== */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-8 pt-20 sm:px-6">
        <Reveal>
          <h2
            className="text-center font-semibold"
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(26px, 4.5vw, 42px)",
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: "var(--ezd-fg-strong)",
            }}
          >
            Why is EXdeck only $1.99?
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-8 max-w-2xl space-y-5 text-[14.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            <p>
              Because AI tools don't need to cost $20/month just because they're AI tools.
            </p>
            <p>
              EXdeck is built lean. We don't run expensive servers or carry bloated infrastructure costs. So instead of copying
              industry pricing and charging $10–$20 a month, we price EXdeck based on what it actually costs us to build and run.
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>$1.99 isn't a launch discount. It's genuine pricing.</span>
            </p>
          </div>
        </Reveal>
      </section>

      {/* ================== Verified by SaaShub ================== */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-8 pt-12 sm:px-6">
        <Reveal>
          <div className="flex flex-col items-center justify-center gap-3">
            <p className="text-sm font-medium" style={{ color: "var(--ezd-fg-muted)" }}>Verified by SaaShub</p>
            <a href='https://www.saashub.com/exdeck?utm_source=badge&utm_campaign=badge&utm_content=exdeck&badge_variant=color&badge_kind=approved' target='_blank' rel="noopener noreferrer">
              <img src="https://cdn-b.saashub.com/img/badges/approved-color.png?v=1" alt="EXdeck.xyz badge" style={{ maxWidth: "150px" }} />
            </a>
          </div>
        </Reveal>
      </section>

      {/* ================== Model benchmarks CTA ================== */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-8 sm:px-6">
        <Link
          href="/benchmarks"
          className="group flex flex-col items-start justify-between gap-4 rounded-2xl border p-6 transition hover:border-white/30 sm:flex-row sm:items-center"
          style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card, rgba(255,255,255,0.02))" }}
        >
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border" style={{ borderColor: "var(--ezd-hairline)" }}>
              <BarChart3 size={20} style={{ color: "var(--ezd-fg-strong)" }} />
            </span>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
                Pick the AI that fits — 7 models, benchmarked
              </div>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
                Regenerate any slide with Llama, Qwen, or GPT-OSS. See real speed, throughput, and reliability.
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition group-hover:opacity-90"
            style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            View model benchmarks <ArrowRight size={13} />
          </span>
        </Link>
      </section>

      {/* ================== Pricing ================== */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-20 sm:px-6">
        <Reveal>
          <SectionLabel center kicker="Pricing" title="Start free. Upgrade when you present more." />
        </Reveal>
        <Reveal delay={60}>
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
            {[
              ["Free is for trying", "30 monthly AI credits, full editor access, and real export so you can judge the product properly."],
              ["Pro is for shipping", "150 credits every day, no export watermark, and enough room for decks, docs, resumes, and revisions."],
              ["No lock-in", "Your work exports to PPTX and PDF. Upgrade for speed and volume, not because your files are trapped."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border p-4" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)" }}>
                <div className="text-[13px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</div>
                <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{body}</p>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div className="mx-auto mt-12 max-w-4xl">
            <PricingPlans onUpgrade={() => router.push("/auth?redirect=/app")} />
          </div>
          <p className="mt-5 text-center text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>
            Team &amp; Organisation members are upgraded to Pro automatically when they sign in. Manage seats in Settings.
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
        <Reveal once>
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
              Stop staring at the empty page.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[14.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
              Generate your first deck - or document - free in under a minute. Edit it, present it, export it.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={onGetStarted}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90 sm:w-auto"
                style={{ 
                  background: "var(--ezd-button-strong)", 
                  color: "var(--ezd-button-strong-fg)",
                  touchAction: "manipulation",
                  minHeight: "44px",
                }}
              >
                Start a presentation
                <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </button>
              <Link
                href="/docs"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25 sm:w-auto"
                style={{ 
                  borderColor: "var(--ezd-hairline)", 
                  color: "var(--ezd-fg-strong)",
                  touchAction: "manipulation",
                  minHeight: "44px",
                }}
              >
                <FileText size={14} /> Write a document
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
  return <span aria-hidden style={{ color: "var(--ezd-fg-quiet)", opacity: 0.5 }}>-</span>;
}

/* ----------------------- Scroll reveal -----------------------
 * Framer Motion, one-shot, GPU-only. Animates strictly opacity + x/y
 * transforms so scrolling stays composited and smooth. Respects reduced
 * motion. `variant` picks the entrance direction. */

type RevealDirection = "up" | "left" | "right" | "scale";

const REVEAL_OFFSET: Record<RevealDirection, { x?: number; y?: number; scale?: number }> = {
  up: { y: 28 },
  left: { x: -36 },
  right: { x: 36 },
  scale: { scale: 0.96, y: 18 },
};

function Reveal({
  children,
  delay = 0,
  className = "",
  variant = "up",
  amount = 0.2,
  once = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  variant?: RevealDirection;
  amount?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  const offset = REVEAL_OFFSET[variant];

  const variants: Variants = {
    hidden: reduce
      ? { opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }
      : { opacity: 0, ...offset, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
    shown: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.55,
        delay: Math.min(delay, 240) / 1000,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="shown"
      viewport={{ once, amount, margin: "0px 0px -8% 0px" }}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------- Section label ----------------------- */

function SectionLabel({
  kicker, title, sub, center,
}: { kicker: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : ""}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.26em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>
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
  title, body, children, wide,
}: {
  title: string; body: string; children?: React.ReactNode; wide?: boolean;
}) {
  return (
    <div
      className="group flex h-full flex-col rounded-2xl border p-6 transition hover:border-white/20"
      style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
    >
      <h4 className="text-[17px] font-semibold leading-tight" style={{ fontFamily: DISPLAY, color: "var(--ezd-fg-strong)", letterSpacing: "-0.015em" }}>{title}</h4>
      <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function MiniFeature({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t pt-5" style={{ borderColor: "var(--ezd-fg-strong)" }}>
      <h4 className="text-[14px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</h4>
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{body}</p>
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
        <span className="text-[9.5px] uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>
          Brief
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ezd-fg-strong)" }}>
        &ldquo;Series A pitch for a logistics platform - problem, our edge,
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

/* ----------------------- Animated hero demo ----------------------- *
 * Temporary replacement for the hero video: a looping, randomized demo of
 * the core flow - type a brief -> generating -> a colorful output slide.
 * The prompt, theme, and output are picked at random each cycle so it looks
 * different on every visit. All client-side; no assets. */

type HeroLayout = "bars" | "donut" | "table" | "cards" | "steps" | "quote";

type HeroDemoItem = {
  prompt: string;
  tags: string[];
  kicker: string;
  title: string;
  bullets: string[];
  bars: number[];
  layout: HeroLayout;
  table?: { headers: string[]; rows: string[][] };
  quote?: string;
  author?: string;
  theme: { bg: string; fg: string; accent: string };
};

const HERO_DEMOS: HeroDemoItem[] = [
  {
    prompt: "Series A pitch for a logistics startup",
    tags: ["Investors", "Confident", "8 slides"],
    kicker: "SERIES A - 2026", title: "Rebuilding logistics, software-first.",
    bullets: ["Dispatch to delivery in one stack", "40% lower cost per shipment", "Live in 9 metros"],
    bars: [46, 62, 54, 78, 68], layout: "bars",
    theme: { bg: "#0B1220", fg: "#F8FAFC", accent: "#38BDF8" },
  },
  {
    prompt: "Intro lecture on the attention mechanism",
    tags: ["Students", "Clear", "10 slides"],
    kicker: "CS401 - LECTURE 4", title: "Where attention goes.",
    bullets: ["Queries, keys, and values", "Softmax over the sequence", "Multi-head, in parallel"],
    bars: [48, 26, 18, 8], layout: "donut",
    theme: { bg: "#1B1024", fg: "#FAF5FF", accent: "#C084FC" },
  },
  {
    prompt: "FY26 board strategy review",
    tags: ["Board", "Formal", "12 slides"],
    kicker: "FY26 - STRATEGY", title: "Where we won this year.",
    bullets: [], bars: [],
    layout: "table",
    table: { headers: ["Metric", "FY25", "FY26"], rows: [["Net retention", "98%", "124%"], ["Segments", "4", "6"], ["Gross margin", "31%", "39%"]] },
    theme: { bg: "#10241C", fg: "#ECFDF5", accent: "#34D399" },
  },
  {
    prompt: "Launch deck for a new coffee brand",
    tags: ["Customers", "Bold", "7 slides"],
    kicker: "LAUNCH - SPRING", title: "Mornings, reinvented.",
    bullets: [], bars: [],
    layout: "quote",
    quote: "Single-origin coffee, ethically sourced and ready in ninety seconds.",
    author: "- Founder, launch keynote",
    theme: { bg: "#2A0E0E", fg: "#FFF1F2", accent: "#FB7185" },
  },
  {
    prompt: "Onboarding guide for a design tool",
    tags: ["New users", "Friendly", "9 slides"],
    kicker: "GET STARTED", title: "Ship your first design today.",
    bullets: ["Start from a template", "Drag, edit, and recolor", "Export anywhere"],
    bars: [], layout: "steps",
    theme: { bg: "#0C1A2B", fg: "#EFF6FF", accent: "#FBBF24" },
  },
  {
    prompt: "Quarterly climate impact report",
    tags: ["Public", "Data-led", "11 slides"],
    kicker: "Q2 - IMPACT", title: "Cutting carbon, quarter by quarter.",
    bullets: ["Emissions reduced", "Renewable sites", "On track for"],
    bars: [18, 3, 2030], layout: "cards",
    theme: { bg: "#052E2B", fg: "#ECFEFF", accent: "#2DD4BF" },
  },
];

/* ---- Output-slide building blocks (shared across layouts) ---- */

function HDKicker({ d }: { d: HeroDemoItem }) {
  return <div className="ezhd-rise text-[9px] font-bold tracking-[0.24em]" style={{ color: d.theme.accent, animationDelay: "0.05s" }}>{d.kicker}</div>;
}
function HDTitle({ d }: { d: HeroDemoItem }) {
  return <div className="ezhd-rise text-[19px] font-bold leading-tight sm:text-[22px]" style={{ animationDelay: "0.12s", fontFamily: DISPLAY, letterSpacing: "-0.02em" }}>{d.title}</div>;
}
function HDBullets({ d }: { d: HeroDemoItem }) {
  return (
    <ul className="mt-1 space-y-1.5">
      {d.bullets.map((b, i) => (
        <li key={b} className="ezhd-rise flex items-start gap-2 text-[11.5px]" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: d.theme.accent }} />
          <span style={{ opacity: 0.92 }}>{b}</span>
        </li>
      ))}
    </ul>
  );
}
function HDBars({ d }: { d: HeroDemoItem }) {
  return (
    <div className="flex h-full w-full items-end justify-center gap-2 py-4">
      {d.bars.map((h, i) => (
        <div key={i} className="ezhd-grow w-3.5 rounded-t sm:w-4" style={{ height: `${h}%`, background: d.theme.accent, opacity: 0.5 + (i / Math.max(1, d.bars.length)) * 0.5, animationDelay: `${0.25 + i * 0.09}s` }} />
      ))}
    </div>
  );
}
function HDDonut({ d }: { d: HeroDemoItem }) {
  const vals = d.bars.slice(0, 4);
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const R = 42, C = 2 * Math.PI * R;
  const shades = [1, 0.7, 0.45, 0.28];
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" className="ezhd-rise h-32 w-32" style={{ animationDelay: "0.15s" }}>
      <circle cx="60" cy="60" r={R} fill="none" stroke={d.theme.fg} strokeOpacity={0.12} strokeWidth={14} />
      {vals.map((v, i) => {
        const dash = (v / total) * C;
        const seg = (
          <circle key={i} cx="60" cy="60" r={R} fill="none" stroke={d.theme.accent} strokeOpacity={shades[i]} strokeWidth={14}
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc} transform="rotate(-90 60 60)" strokeLinecap="butt" />
        );
        acc += dash;
        return seg;
      })}
      <text x="60" y="65" textAnchor="middle" fontSize="18" fontWeight="700" fill={d.theme.fg} style={{ fontFamily: DISPLAY }}>
        {Math.round((vals[0] / total) * 100)}%
      </text>
    </svg>
  );
}
function HDTable({ d }: { d: HeroDemoItem }) {
  const t = d.table!;
  return (
    <div className="ezhd-rise w-full overflow-hidden rounded-lg" style={{ animationDelay: "0.2s", border: `1px solid ${d.theme.accent}33` }}>
      <div className="grid" style={{ gridTemplateColumns: `1.4fr repeat(${t.headers.length - 1}, 1fr)` }}>
        {t.headers.map((h, i) => (
          <div key={`h-${i}`} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${d.theme.accent}22`, color: d.theme.accent }}>{h}</div>
        ))}
        {t.rows.map((row, ri) => row.map((cell, ci) => (
          <div key={`${ri}-${ci}`} className="px-3 py-2 text-[11.5px]" style={{ borderTop: `1px solid ${d.theme.fg}14`, color: d.theme.fg, opacity: ci === 0 ? 1 : 0.9, fontWeight: ci === 0 ? 600 : 400 }}>{cell}</div>
        )))}
      </div>
    </div>
  );
}
function HDCards({ d }: { d: HeroDemoItem }) {
  const suffix = ["%", "", ""];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {d.bullets.map((label, i) => (
        <div key={label} className="ezhd-rise rounded-lg p-3" style={{ animationDelay: `${0.2 + i * 0.1}s`, background: `${d.theme.accent}18`, border: `1px solid ${d.theme.accent}33` }}>
          <div className="text-[22px] font-bold leading-none" style={{ color: d.theme.accent, fontFamily: DISPLAY }}>{d.bars[i]}{suffix[i] ?? ""}</div>
          <div className="mt-1.5 text-[10.5px] leading-tight" style={{ opacity: 0.85 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
function HDSteps({ d }: { d: HeroDemoItem }) {
  return (
    <div className="mt-1 space-y-2">
      {d.bullets.map((b, i) => (
        <div key={b} className="ezhd-rise flex items-center gap-3" style={{ animationDelay: `${0.2 + i * 0.12}s` }}>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: d.theme.accent, color: d.theme.bg }}>{i + 1}</span>
          <span className="text-[12.5px]" style={{ opacity: 0.92 }}>{b}</span>
        </div>
      ))}
    </div>
  );
}

function HeroDemo() {
  const [mounted, setMounted] = useState(false);
  const [demo, setDemo] = useState(0);
  const [phase, setPhase] = useState<"typing" | "generating" | "output">("typing");
  const [typed, setTyped] = useState(0);

  // Randomize the starting demo after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    setMounted(true);
    setDemo(Math.floor(Math.random() * HERO_DEMOS.length));
  }, []);

  const d = HERO_DEMOS[demo];
  const full = d.prompt;

  // Typewriter -> pause -> generating.
  useEffect(() => {
    if (!mounted || phase !== "typing") return;
    if (typed < full.length) {
      const t = window.setTimeout(() => setTyped((n) => n + 1), 30 + Math.random() * 45);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setPhase("generating"), 750);
    return () => window.clearTimeout(t);
  }, [mounted, phase, typed, full]);

  // Generating -> output.
  useEffect(() => {
    if (phase !== "generating") return;
    const t = window.setTimeout(() => setPhase("output"), 2000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Output -> next (a different, random demo).
  useEffect(() => {
    if (phase !== "output") return;
    const t = window.setTimeout(() => {
      setDemo((cur) => {
        if (HERO_DEMOS.length < 2) return cur;
        let n = cur;
        while (n === cur) n = Math.floor(Math.random() * HERO_DEMOS.length);
        return n;
      });
      setTyped(0);
      setPhase("typing");
    }, 2800);
    return () => window.clearTimeout(t);
  }, [phase]);

  const typingDone = typed >= full.length;

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ background: "var(--ezd-bg-page)" }}>
      {/* TYPING */}
      {phase === "typing" && (
        <div className="absolute inset-0 flex flex-col justify-center gap-4 p-6 sm:p-8">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>Your brief</div>
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)" }}>
            <span className="text-[15px] leading-relaxed sm:text-[17px]" style={{ color: "var(--ezd-fg-strong)", fontFamily: DISPLAY }}>
              {full.slice(0, typed)}
              <span className="ezhd-caret" style={{ background: "var(--ezd-fg-strong)" }} />
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" style={{ opacity: typingDone ? 1 : 0.25, transition: "opacity .4s ease" }}>
            {d.tags.map((t) => (
              <span key={t} className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-muted)" }}>{t}</span>
            ))}
          </div>
          <div className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)", opacity: typingDone ? 1 : 0.5, transition: "opacity .4s ease" }}>
            <Sparkles size={13} /> Generate
          </div>
        </div>
      )}

      {/* GENERATING */}
      {phase === "generating" && (
        <div key={`g-${demo}`} className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8">
          <div className="ezhd-orb grid h-16 w-16 place-items-center rounded-2xl" style={{ background: d.theme.bg, color: d.theme.accent, boxShadow: `0 0 42px ${d.theme.accent}55` }}>
            <Sparkles size={26} className="ezhd-spin" />
          </div>
          <div className="text-[14px] font-semibold" style={{ color: "var(--ezd-fg-strong)", fontFamily: DISPLAY }}>
            Designing your deck
            <span className="ezhd-dot">.</span>
            <span className="ezhd-dot" style={{ animationDelay: ".2s" }}>.</span>
            <span className="ezhd-dot" style={{ animationDelay: ".4s" }}>.</span>
          </div>
          <div className="w-full max-w-[260px] space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="ezhd-shim h-2.5 rounded-full" style={{ background: "var(--ezd-bg-hover)", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <div className="h-1 w-full max-w-[260px] overflow-hidden rounded-full" style={{ background: "var(--ezd-bg-hover)" }}>
            <div className="ezhd-progress h-full rounded-full" style={{ background: d.theme.accent }} />
          </div>
        </div>
      )}

      {/* OUTPUT */}
      {phase === "output" && (
        <div key={`o-${demo}`} className="ezhd-pop absolute inset-0 p-4 sm:p-5">
          <div className="relative flex h-full w-full overflow-hidden rounded-xl" style={{ background: d.theme.bg, color: d.theme.fg }}>
            <div className="ezhd-sweep pointer-events-none absolute inset-0" />
            <div className="absolute left-0 top-0 h-full w-[6px]" style={{ background: d.theme.accent }} />

            {(d.layout === "bars" || d.layout === "donut") ? (
              <>
                <div className="flex w-[56%] flex-col justify-center gap-2.5 pl-7 pr-2">
                  <HDKicker d={d} /><HDTitle d={d} /><HDBullets d={d} />
                </div>
                <div className="flex w-[44%] items-center justify-center p-4">
                  {d.layout === "bars" ? <HDBars d={d} /> : <HDDonut d={d} />}
                </div>
              </>
            ) : d.layout === "quote" ? (
              <div className="flex w-full flex-col justify-center gap-2 px-8">
                <div className="ezhd-rise text-[52px] leading-none" style={{ color: d.theme.accent, fontFamily: DISPLAY, animationDelay: "0.05s" }}>&ldquo;</div>
                <div className="ezhd-rise -mt-4 text-[18px] font-semibold leading-snug sm:text-[21px]" style={{ animationDelay: "0.15s", fontFamily: DISPLAY }}>{d.quote}</div>
                <div className="ezhd-rise text-[11px]" style={{ color: d.theme.accent, animationDelay: "0.28s" }}>{d.author}</div>
              </div>
            ) : (
              <div className="flex w-full flex-col justify-center gap-3 px-7">
                <div className="flex flex-col gap-1.5"><HDKicker d={d} /><HDTitle d={d} /></div>
                {d.layout === "table" ? <HDTable d={d} /> : d.layout === "cards" ? <HDCards d={d} /> : <HDSteps d={d} />}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .ezhd-caret { display: inline-block; width: 2px; height: 1em; margin-left: 2px; vertical-align: -2px; animation: ezhd-blink 1s steps(2) infinite; }
        @keyframes ezhd-blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }
        .ezhd-dot { opacity: 0.2; animation: ezhd-dot 1.2s infinite; }
        @keyframes ezhd-dot { 0%, 100% { opacity: 0.2 } 50% { opacity: 1 } }
        .ezhd-shim { position: relative; overflow: hidden; }
        .ezhd-shim::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(150,150,150,.28) 50%, transparent 70%); background-size: 200% 100%; animation: ezhd-shim 1.3s infinite linear; }
        @keyframes ezhd-shim { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .ezhd-progress { width: 0%; animation: ezhd-progress 2s ease-out forwards; }
        @keyframes ezhd-progress { 0% { width: 4% } 60% { width: 72% } 100% { width: 100% } }
        .ezhd-spin { animation: ezhd-spin 3s linear infinite; }
        @keyframes ezhd-spin { to { transform: rotate(360deg) } }
        .ezhd-orb { animation: ezhd-orb 1.6s ease-in-out infinite; }
        @keyframes ezhd-orb { 0%, 100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-6px) scale(1.05) } }
        .ezhd-pop { animation: ezhd-pop .5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes ezhd-pop { 0% { opacity: 0; transform: scale(.94) } 100% { opacity: 1; transform: scale(1) } }
        .ezhd-rise { animation: ezhd-rise .5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes ezhd-rise { 0% { opacity: 0; transform: translateY(10px) } 100% { opacity: 1; transform: translateY(0) } }
        .ezhd-grow { transform-origin: bottom; animation: ezhd-grow .6s cubic-bezier(.22,1,.36,1) both; }
        @keyframes ezhd-grow { 0% { transform: scaleY(0) } 100% { transform: scaleY(1) } }
        .ezhd-sweep { background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.14) 48%, transparent 62%); background-size: 250% 100%; animation: ezhd-sweep 1.1s ease-out .15s 1 both; }
        @keyframes ezhd-sweep { 0% { background-position: 180% 0 } 100% { background-position: -120% 0 } }
      `}</style>
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
  // Start with a deterministic order so server and first client render match
  // (a random shuffle during render caused a hydration mismatch). Shuffle
  // AFTER mount so each visit still starts on a random template.
  const [order, setOrder] = useState<DeckTemplate[]>(() => DECK_TEMPLATES);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => { setOrder(shuffle(DECK_TEMPLATES)); }, []);

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
      // Touch support for mobile - pause on touch too
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => {
        // Resume after a delay on touch end
        setTimeout(() => setPaused(false), 3000);
      }}
      // Prevent scroll interference
      style={{ touchAction: "manipulation" }}
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
            <span className="truncate">EXdeck - {curr.name}</span>
          </span>
          <span
            className="hidden shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex"
            style={{ borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-muted)" }}
          >
            {curr.category}
          </span>
        </div>

        {/* Cycling viewport - overflow-hidden clips the falling card. */}
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

        {/* Caption - fixed height so varying names/taglines never resize the card. */}
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
    { n: 2, kicker: "The look", title: "Pick a theme - or a template.", body: "37 palettes paginated by mood, or grab a template that bundles theme, font, and graphic in one click.", visual: <ThemeVisual /> },
    { n: 3, kicker: "The voice", title: "Choose a typeface.", body: "28 Google fonts served live, with a real-time preview of your own headline in each one.", visual: <FontVisual /> },
    { n: 4, kicker: "The texture", title: "Add an optional background.", body: "27 recolorable graphics - soft grids, mesh gradients, blueprint, halftone - tuned to your accent.", visual: <GraphicVisual /> },
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
              <div className="text-[10px] font-semibold uppercase tracking-[0.26em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>
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
        <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>
          Brief - 76 words
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
            From idea to slides - in one minute.
          </div>
        </div>
        <ul className="absolute inset-x-3 bottom-3 space-y-0.5 text-[8px] leading-snug text-black">
          <li className="flex gap-1"><span className="text-black/60">-</span><span>Drag, recolor, rewrite</span></li>
          <li className="flex gap-1"><span className="text-black/60">-</span><span>Export to .pptx or .pdf</span></li>
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
                <span style={{ color: theme.accent }}>-</span>
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
          style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)", fontFamily: MONO }}
        >
          {tag}
        </span>
        <span className="text-[10px]" style={{ color: "var(--ezd-fg-quiet)" }}>16:9 - .pptx</span>
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
  { name: "Asif Mohammad", role: "Student", rating: 5, text: "Have seen & used many PPT generators, but this is different. The UI/UX in dark mode is brilliant - pick your own theme, font, and much more. Proud to be a contributor too." },
  { name: "Aarav Mehta", role: "Product designer", rating: 5, text: "The UI is clean, the workflow makes sense, and generation is genuinely fast. No clutter, no learning curve." },
  { name: "Sofia Almeida", role: "Startup founder", rating: 4.5, text: "Speed is the standout - a full presentation came back in seconds and editing felt smooth the whole way through." },
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
        style={{ 
          color: "var(--ezd-fg-strong)",
          touchAction: "manipulation",
          minHeight: "44px",
        }}
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
   const [isHovered, setIsHovered] = useState(false);
   const [showScrollTop, setShowScrollTop] = useState(false);

   useEffect(() => {
     const onScroll = () => setShowScrollTop(window.scrollY > 420);
     onScroll();
     window.addEventListener("scroll", onScroll, { passive: true });
     return () => window.removeEventListener("scroll", onScroll);
   }, []);

  return (
    <footer className="relative z-10 border-t" style={{ borderColor: "var(--ezd-divider)" }}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2">
            <Logo size="sm" />
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
              Generate, edit, present, and export real presentations from a single
              brief. An indie project, written and maintained in the open.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/izhan0102/exdeck"
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition hover:border-white/25"
                style={{ 
                  borderColor: "var(--ezd-hairline)", 
                  background: "var(--ezd-bg-card)", 
                  color: "var(--ezd-fg-muted)",
                  touchAction: "manipulation",
                  minHeight: "32px",
                }}
              >
                <Github size={11} /> Source
              </a>
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition hover:border-white/25"
                style={{ 
                  borderColor: "var(--ezd-hairline)", 
                  background: "var(--ezd-bg-card)", 
                  color: "var(--ezd-fg-muted)",
                  touchAction: "manipulation",
                  minHeight: "32px",
                }}
              >
                <Sparkles size={11} /> Developer&rsquo;s note
              </Link>
              <SupportButton />
            </div>
            <div className="mt-4">
              <a href='https://www.saashub.com/exdeck?utm_source=badge&utm_campaign=badge&utm_content=exdeck&badge_variant=color&badge_kind=approved' target='_blank' rel="noopener noreferrer">
                <img src="https://cdn-b.saashub.com/img/badges/approved-color.png?v=1" alt="EXdeck.xyz badge" style={{ maxWidth: "130px" }} />
              </a>
            </div>
          </div>

          <FooterCol
            title="Product"
            items={[
              { label: "Features", href: "#features" },
              { label: "Ask EX-AI", href: "/ex-ai" },
              { label: "How it works", href: "#how" },
              { label: "Template Lab (beta)", href: "/template-lab" },
              { label: "Examples", href: "#examples" },
              { label: "Pricing", href: "#pricing" },
              { label: "How-to guides", href: "/how-to" },
              { label: "Explore everything", href: "/keywords" },
              { label: "AI document maker", href: "/docs" },
              { label: "Open the editor", href: "/app" },
            ]}
          />
          <FooterCol
            title="Company"
            items={[
              { label: "About / Dev's note", href: "/about" },
              { label: "Meet the developer", href: "/developer" },
              { label: "Model benchmarks", href: "/benchmarks" },
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
              { label: "No-signup AI presentation", href: "/ai-presentation-maker-no-sign-up" },
              { label: "PPT maker without login", href: "/ppt-maker-without-login" },
              { label: "PowerPoint without account", href: "/create-powerpoint-without-account" },
              { label: "Text to PPT", href: "/text-to-ppt" },
              { label: "PowerPoint generator", href: "/powerpoint-generator" },
              { label: "Blog", href: "/blog" },
            ]}
          />
          <FooterCol
            title="Compare"
            items={[
              { label: "Compare all", href: "/compare" },
              { label: "EXdeck", href: "/exdeck" },
              { label: "EXdeck PPT", href: "/exdeck-ppt" },
              { label: "EXdeck vs Gamma", href: "/exdeck-vs-gamma" },
              { label: "EXdeck vs Canva", href: "/exdeck-vs-canva" },
              { label: "EXdeck vs Tome", href: "/exdeck-vs-tome" },
              { label: "vs PowerPoint Copilot", href: "/exdeck-vs-powerpoint-copilot" },
              { label: "vs Google Slides", href: "/exdeck-vs-google-slides" },
            ]}
          />
          <FooterCol
            title="Free tools"
            items={[
              { label: "All converters", href: "/converter" },
              { label: "AI spreadsheet", href: "/spreadsheet" },
              { label: "Document analyser", href: "/analyse" },
              { label: "PDF to PPT presenter", href: "/pdf-to-ppt" },
              { label: "Image to PDF", href: "/converter/image-to-pdf" },
              { label: "PDF to JPG", href: "/converter/pdf-to-jpg" },
              { label: "Merge PDF", href: "/converter/merge-pdf" },
              { label: "PNG to JPG", href: "/converter/png-to-jpg" },
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
        <span>(c) {new Date().getFullYear()} EXdeck - All rights reserved</span>
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
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Scroll to top"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "10px 15px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: isHovered ? "#555" : "var(--ezd-fg-muted)",
            opacity: showScrollTop ? 1 : 0,
            pointerEvents: showScrollTop ? "auto" : "none",
            transform: showScrollTop ? (isHovered ? "scale(1.1)" : "scale(1)") : "translateY(8px) scale(0.96)",
            transition: "opacity 0.25s ease, transform 0.25s ease, background-color 0.25s ease",
            color: "white",
            cursor: "pointer",
            fontSize:"12px",
            zIndex: 1000,
            }}
          >
          ↑
          </button>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)", fontFamily: MONO }}>
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-[12px]">
        {items.map((it) => (
          <li key={it.label}>
            <Link 
              href={it.href} 
              className="transition hover:text-white" 
              style={{ 
                color: "var(--ezd-fg-muted)",
                touchAction: "manipulation",
              }}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
