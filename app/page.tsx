"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Download, Github, LayoutGrid, LogOut, Palette, Pencil,
  Presentation, Search, Type, Wand2, Shapes,
} from "lucide-react";
import HeroBackdrop from "@/components/landing/HeroBackdrop";
import { MockSlide } from "@/components/landing/MockSlide";
import DeveloperNote from "@/components/landing/DeveloperNote";
import Counter from "@/components/Counter";
import { dailyActiveUsers, totalDecksGenerated, decksToday, trackEvent } from "@/lib/stats";
import { isLoggedIn, logout, onAuthStateChange, type AppUser } from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();
  const [today, setToday] = useState(() => new Date());
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    trackEvent({ kind: "page_view", path: "/", ts: Date.now() });
    const t = window.setInterval(() => setToday(new Date()), 60_000);
    const unsub = onAuthStateChange((u) => setUser(u));
    return () => {
      window.clearInterval(t);
      unsub();
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

  const onSignOut = async () => {
    await logout();
    setUser(null);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <HeroBackdrop />

      {/* ----- Header ----- */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight">
            <span className="border-b-2 border-white pb-0.5">DeckFlow</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#stats" className="hover:text-white">Stats</a>
            <DeveloperNote />
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 pr-3 text-sm">
                <span
                  aria-hidden
                  className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-semibold text-white"
                >
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[140px] truncate text-white/85 sm:inline">
                  {user.name || user.email}
                </span>
                <button
                  onClick={onSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="grid h-5 w-5 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut size={11} />
                </button>
              </div>
            ) : (
              <Link href="/auth" className="text-sm text-white/70 hover:text-white">
                Sign in
              </Link>
            )}
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-white/90"
            >
              {user ? "Open app" : "Get started"} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ----- Hero ----- */}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            v1 · 32 themes · 18 fonts · 200k icons
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Decks that don't look{" "}
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent">
              made in a hurry.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-white/70">
            Write a brief, choose how it looks, get a real editable deck.
            Drag the boxes around, swap colors, drop in a chart, present it
            full-screen, export to PowerPoint or PDF. The work, just faster.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={onGetStarted}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-medium text-black transition hover:bg-white/90"
            >
              Make a deck
              <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </button>
            <Link
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base text-white/85 hover:bg-white/10"
            >
              See how it works
            </Link>
            <a
              href="https://github.com/izhan0102/Deckflow"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base text-white/85 hover:bg-white/10"
              title="View source on GitHub"
            >
              <Github size={16} /> Source
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/45">
            <span>Free · no credit card</span>
            <span>·</span>
            <span>Real .pptx and .pdf export</span>
            <span>·</span>
            <span>Open source on GitHub</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-transparent blur-2xl" />
          <MockSlide />
        </div>
      </section>

      {/* ----- Stats strip ----- */}
      <section id="stats" className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:grid-cols-3 sm:p-7">
          <Stat
            label="People making decks today"
            value={<Counter value={stats.dau} />}
            sub="updated through the day"
          />
          <Stat
            label="Decks built so far"
            value={<Counter value={stats.total} />}
            sub="since launch"
            highlight
          />
          <Stat
            label="In the last 24 hours"
            value={<Counter value={stats.today} />}
            sub={`as of ${today.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          />
        </div>
      </section>

      {/* ----- What's inside ----- */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            A real editor, not a one-shot generator.
          </h2>
          <p className="mt-3 text-white/60">
            Every part of a finished slide is yours to move, recolor, or rewrite.
            Here's the toolbox.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feature
            icon={<Palette size={20} />}
            title="32 themes"
            body="From editorial whites to bold cobalts and crimsons. Custom colors and fonts if none of them fit. Paginated picker, four pages of choice."
          />
          <Feature
            icon={<Type size={20} />}
            title="18 typefaces"
            body="Inter, Manrope, Playfair, Fraunces, Bricolage, JetBrains Mono and more. Live previews so you see the deck before you commit."
          />
          <Feature
            icon={<LayoutGrid size={20} />}
            title="22 background patterns"
            body="Soft grids, mesh gradients, corner arcs, editorial rules. Recolor any of them to match your accent before generation."
          />
          <Feature
            icon={<Shapes size={20} />}
            title="36 graphics + 200k icons"
            body="Donut and bar charts, timelines, Venn diagrams, KPI tiles, section dividers. Plus search any icon (rocket, cloud, calendar) from a global library."
          />
          <Feature
            icon={<Pencil size={20} />}
            title="Edit anything inline"
            body="Click a title to rewrite it. Drag a text box. Pick a font size from a PowerPoint-style grid. Recolor a graphic with a swatch. No menus to dig through."
          />
          <Feature
            icon={<Search size={20} />}
            title="Per-slide chat"
            body="Ask in plain words. 'Add a chart on the right.' 'Make the title smaller.' 'Match the other slides background.' It does the right thing."
          />
          <Feature
            icon={<Presentation size={20} />}
            title="Full-screen present mode"
            body="Auto-fullscreen on launch. Arrow keys, B for blank screen, type a number then Enter to jump. The shortcuts you already know from PowerPoint."
          />
          <Feature
            icon={<Download size={20} />}
            title="Real .pptx and .pdf"
            body="Open in PowerPoint, Keynote, or Google Slides. Drag offsets, font choices, images, charts, annotations preserved. PDF for share-ready exports."
          />
          <Feature
            icon={<Wand2 size={20} />}
            title="Built to evolve"
            body="Open source. New themes, new graphics, and a template gallery are landing soon. Tell me what's missing and it tends to ship."
          />
        </div>
      </section>

      {/* ----- How it works ----- */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Five steps. Most people finish in under a minute.
          </h2>
          <p className="mt-3 text-white/60">
            The first deck takes the longest because you're choosing how it
            should look. After that, you'll be repeating step one and skipping
            the rest.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Step n={1} title="Brief"   body="Topic, audience, tone, density." />
          <Step n={2} title="Theme"   body="32 palettes or a custom one." />
          <Step n={3} title="Font"    body="18 typefaces, live preview." />
          <Step n={4} title="Graphic" body="Optional background pattern." />
          <Step n={5} title="Edit"    body="Rewrite, drag, recolor, present." />
        </div>
      </section>

      {/* ----- Quote / signal ----- */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        <blockquote className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center">
          <p className="text-balance text-lg italic text-white/85">
            "I had a deck due in two hours. DeckFlow gave me something I was
            willing to put my name on by the time I'd finished the first coffee."
          </p>
          <div className="mt-3 text-xs text-white/45">
            — early user, anonymous, exactly the kind of feedback we built it for
          </div>
        </blockquote>
      </section>

      {/* ----- CTA ----- */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Stop staring at the empty title slide.
        </h2>
        <p className="mt-3 text-white/60">
          Free to use, free to export, free to break and tell me about.
        </p>
        <button
          onClick={onGetStarted}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-medium text-black hover:bg-white/90"
        >
          Make a deck <ArrowRight size={16} />
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
                A presentation tool that respects your time. Built in the
                open by Muhammad Izhan.
              </p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-white/40">Product</div>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#how" className="hover:text-white">How it works</a></li>
                <li><Link href="/app" className="hover:text-white">Open app</Link></li>
                <li>
                  <a
                    href="https://github.com/izhan0102/Deckflow"
                    target="_blank" rel="noreferrer"
                    className="hover:text-white"
                  >
                    GitHub
                  </a>
                </li>
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
            <span>© {new Date().getFullYear()} DeckFlow · All rights reserved</span>
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
