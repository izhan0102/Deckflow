"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Sparkles, Wand2, LayoutGrid, MessageSquare, Download,
  Presentation, Table as TableIcon, Quote, Users, Zap, ShieldCheck,
} from "lucide-react";
import HeroBackdrop from "@/components/landing/HeroBackdrop";
import { MockSlide } from "@/components/landing/MockSlide";
import DeveloperNote from "@/components/landing/DeveloperNote";
import Counter from "@/components/Counter";
import { dailyActiveUsers, totalDecksGenerated, decksToday, trackEvent } from "@/lib/stats";
import { isLoggedIn } from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    trackEvent({ kind: "page_view", path: "/", ts: Date.now() });
    // Re-tick every minute so counters feel alive without being absurd.
    const t = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(t);
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

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <HeroBackdrop />

      {/* ----- Header ----- */}
      <header className="sticky top-0 z-50 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 backdrop-blur-sm">
        <Link href="/" className="font-semibold tracking-tight">
          <span className="border-b-2 border-white pb-0.5">DeckFlow</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#stats" className="hover:text-white">Stats</a>
          <DeveloperNote />
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="text-sm text-white/70 hover:text-white">Sign in</Link>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-white/90"
          >
            Get started <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* ----- Hero ----- */}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <Sparkles size={12} className="text-violet-300" />
            One prompt · seconds to a finished deck
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Pitch decks, lectures, and reports{" "}
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent">
              from a single prompt.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-white/70">
            DeckFlow turns a sentence into a polished, editable presentation.
            Drag-and-drop layout. Real PowerPoint export. Free your slides
            from blank-page paralysis.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={onGetStarted}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-medium text-black transition hover:bg-white/90"
            >
              Make my first deck
              <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </button>
            <Link
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base text-white/85 hover:bg-white/10"
            >
              See how it works
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-6 text-xs text-white/50">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> No credit card</span>
            <span className="inline-flex items-center gap-2"><Zap size={14} /> 30-second decks</span>
            <span className="inline-flex items-center gap-2"><Download size={14} /> Real .pptx export</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-transparent blur-2xl" />
          <MockSlide />
          <div className="absolute -bottom-6 -right-6 hidden rounded-2xl border border-white/10 bg-zinc-900/90 p-3 text-xs shadow-xl backdrop-blur md:block">
            <div className="mb-1 flex items-center gap-1 text-white/50">
              <MessageSquare size={11} /> Edit with AI
            </div>
            <div className="text-white/85">"add a bullet about pricing"</div>
            <div className="mt-1 text-emerald-300">Added to slide 3 →</div>
          </div>
        </div>
      </section>

      {/* ----- Stats strip ----- */}
      <section id="stats" className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:grid-cols-3 sm:p-7">
          <Stat
            label="Daily active users"
            value={
              <Counter value={stats.dau} />
            }
            sub="last 24 hours"
          />
          <Stat
            label="Decks generated"
            value={<Counter value={stats.total} />}
            sub="all time"
            highlight
          />
          <Stat
            label="Generated today"
            value={<Counter value={stats.today} />}
            sub={`as of ${today.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          />
        </div>
      </section>

      {/* ----- Features ----- */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Everything you need. Nothing you don't.
          </h2>
          <p className="mt-3 text-white/60">
            Built around the workflow real people use, not a feature checklist.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feature
            icon={<Wand2 size={20} />}
            title="Prompt to deck"
            body="Type a topic, pick a density, get a structured deck with title, content, and a closing slide. References optional."
          />
          <Feature
            icon={<LayoutGrid size={20} />}
            title="Smart layouts"
            body="Bullets, two-column, tables with sources, quotes, section dividers. The model picks the layout that fits the content."
          />
          <Feature
            icon={<MessageSquare size={20} />}
            title="Edit with AI"
            body='"Make the title smaller", "add a bullet about ROI", "match the other slides background". Per-slide chat with full deck context.'
          />
          <Feature
            icon={<Presentation size={20} />}
            title="Live editor"
            body="Drag any text box. Resize via PowerPoint-style font sizes. Drop images and place them anywhere on the slide."
          />
          <Feature
            icon={<TableIcon size={20} />}
            title="Tables, not stat cards"
            body="Numerical content renders as real tables with headers, rows, and a citation line. Honest data presentation."
          />
          <Feature
            icon={<Download size={20} />}
            title="Real .pptx export"
            body="Open in PowerPoint, Keynote, or Google Slides. Drag offsets, font overrides, images, annotations — all preserved."
          />
        </div>
      </section>

      {/* ----- How it works ----- */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Three steps. Thirty seconds.</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Step n={1} title="Prompt" body="Describe the topic, audience, tone, and density." />
          <Step n={2} title="Theme" body="Pick a preset palette or build a custom color scheme." />
          <Step n={3} title="Edit & present" body="Refine with chat, drag, resize, and launch full-screen." />
        </div>
      </section>

      {/* ----- CTA ----- */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Your next deck is one prompt away.
        </h2>
        <p className="mt-3 text-white/60">No template lock-in. No onboarding. Just type.</p>
        <button
          onClick={onGetStarted}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-medium text-black hover:bg-white/90"
        >
          Start now <ArrowRight size={16} />
        </button>
      </section>

      <footer className="relative z-10 border-t border-white/5 bg-black/40">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="font-semibold tracking-tight">
                <span className="border-b-2 border-white pb-0.5">DeckFlow</span>
              </div>
              <p className="mt-3 text-xs text-white/45 leading-relaxed">
                AI-powered presentations from a single prompt. Built with care,
                exported to real PowerPoint.
              </p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-white/40">Product</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#how" className="hover:text-white">How it works</a></li>
                <li><Link href="/app" className="hover:text-white">Open app</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-white/40">Legal</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms & Conditions</Link></li>
                <li><Link href="/refund" className="hover:text-white">Refund & Cancellation</Link></li>
                <li><Link href="/shipping" className="hover:text-white">Shipping & Delivery</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-white/40">Company</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li><Link href="/contact" className="hover:text-white">Contact us</Link></li>
                <li><Link href="/auth" className="hover:text-white">Sign in</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-white/40">
            <span>© {new Date().getFullYear()} DeckFlow. All rights reserved.</span>
            <span className="flex items-center gap-3">
              <Link href="/privacy" className="hover:text-white/70">Privacy</Link>
              <Link href="/terms" className="hover:text-white/70">Terms</Link>
              <Link href="/refund" className="hover:text-white/70">Refunds</Link>
              <Link href="/contact" className="hover:text-white/70">Contact</Link>
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ------------------------------ Subcomponents ------------------------------ */

function Stat({
  label, value, sub, highlight,
}: { label: string; value: React.ReactNode; sub: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-transparent"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${highlight ? "text-violet-200" : "text-white"}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-white/40">{sub}</div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
        {icon}
      </div>
      <div className="text-base font-medium">{title}</div>
      <p className="mt-1 text-sm text-white/60">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 grid h-8 w-8 place-items-center rounded-full border border-white/15 text-sm font-semibold">
        {n}
      </div>
      <div className="text-base font-medium">{title}</div>
      <p className="mt-1 text-sm text-white/60">{body}</p>
    </div>
  );
}
