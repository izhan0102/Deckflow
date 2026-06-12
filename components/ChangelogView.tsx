"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp, ChevronDown, ExternalLink, GitCommit } from "lucide-react";
import Logo from "@/components/Logo";
import type { ReleaseGroup, ChangeKind, ChangeItem } from "@/lib/changelog";

const KIND_LABEL: Record<ChangeKind, string> = {
  new: "New",
  fix: "Fix",
  improved: "Improved",
  docs: "Docs",
  merged: "Merged",
  update: "Update",
};

export default function ChangelogView({ groups }: { groups: ReleaseGroup[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Track active release + progress. The progress bar is mutated directly on
  // the DOM (no React state) so scrolling never triggers a re-render; only
  // `active` is state, and setState bails out when the value is unchanged —
  // so we re-render at most once per section change, not once per frame.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const { scrollTop, scrollHeight, clientHeight } = scroller;
      const max = scrollHeight - clientHeight;
      const p = max > 0 ? Math.min(1, scrollTop / max) : 0;
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${p})`;
      }

      const mid = scrollTop + clientHeight / 2;
      let best = 0;
      let bestDist = Infinity;
      sectionRefs.current.forEach((el, i) => {
        if (!el) return;
        const center = el.offsetTop + el.offsetHeight / 2;
        const d = Math.abs(center - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      setActive((prev) => (prev === best ? prev : best));
    };

    const onScroll = () => {
      if (raf) return;            // coalesce to one update per animation frame
      raf = requestAnimationFrame(measure);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [groups.length]);

  // Reveal-on-enter for individual items.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("cl-in");
            io.unobserve(e.target); // reveal once, then stop watching
          }
        }
      },
      { root: scrollerRef.current, threshold: 0.18 },
    );
    const nodes = scrollerRef.current?.querySelectorAll(".cl-reveal") || [];
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [groups.length]);

  const goTo = (i: number) => {
    sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="relative h-screen overflow-hidden"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}
    >
      {/* Top scroll-progress bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
        <div
          ref={progressBarRef}
          className="h-full origin-left"
          style={{ background: "var(--ezd-fg-strong)", transform: "scaleX(0)" }}
        />
      </div>

      {/* Fixed header */}
      <header className="absolute inset-x-0 top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Logo size="sm" href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={12} /> Home
          </Link>
        </div>
      </header>

      {/* Side rail (desktop) — clickable version dots */}
      <nav className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block">
        <ul className="flex flex-col gap-3">
          {groups.map((g, i) => (
            <li key={g.iso}>
              <button
                onClick={() => goTo(i)}
                className="group flex items-center gap-2.5"
                aria-label={`Jump to ${g.version}`}
              >
                <span
                  className="h-2 w-2 rounded-full transition-all duration-300"
                  style={{
                    background: i === active ? "var(--ezd-fg-strong)" : "var(--ezd-divider)",
                    transform: i === active ? "scale(1.6)" : "scale(1)",
                  }}
                />
                <span
                  className="text-[11px] font-semibold tabular-nums transition-all duration-300"
                  style={{
                    color: i === active ? "var(--ezd-fg-strong)" : "transparent",
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? "translateX(0)" : "translateX(-4px)",
                  }}
                >
                  {g.version}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Snap scroller */}
      <div
        ref={scrollerRef}
        className="cl-scroller h-full snap-y snap-mandatory overflow-y-auto"
      >
        {/* Hero panel — its own snap point */}
        <section className="relative flex h-screen snap-start snap-always items-center justify-center px-6">
          <BigType />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/45 cl-reveal">
              Changelog
            </div>
            <h1
              className="mt-4 font-normal text-white cl-reveal"
              style={{
                fontFamily: '"Fredoka", ui-rounded, "Segoe UI", system-ui, sans-serif',
                fontWeight: 600,
                fontSize: "clamp(44px, 9vw, 104px)",
                lineHeight: 0.98,
                letterSpacing: "-0.03em",
                transitionDelay: "80ms",
              }}
            >
              Everything
              <br />
              we&rsquo;ve shipped.
            </h1>
            <p
              className="mx-auto mt-6 max-w-md text-[14.5px] leading-relaxed text-white/55 cl-reveal"
              style={{ transitionDelay: "160ms" }}
            >
              Pulled live from the public GitHub history. {countItems(groups)} changes
              across {groups.length} releases. Scroll to travel through time.
            </p>
            <div className="mt-10 cl-reveal" style={{ transitionDelay: "240ms" }}>
              <button
                onClick={() => goTo(1)}
                className="mx-auto flex flex-col items-center gap-1 text-white/40 transition hover:text-white/80"
              >
                <span className="text-[11px] uppercase tracking-[0.3em]">Scroll</span>
                <span className="cl-bounce text-lg">↓</span>
              </button>
            </div>
          </div>
        </section>

        {/* One snap section per release */}
        {groups.map((g, i) => (
          <ReleaseSection
            key={g.iso}
            group={g}
            setRef={(el) => { sectionRefs.current[i] = el; }}
          />
        ))}

        {/* Closing snap panel */}
        <section className="relative flex h-screen snap-start snap-always items-center justify-center px-6">
          <div className="mx-auto max-w-md text-center cl-reveal">
            <div
              className="font-semibold text-white"
              style={{
                fontFamily: '"Fredoka", system-ui, sans-serif',
                fontSize: "clamp(28px, 5vw, 44px)",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
              }}
            >
              That&rsquo;s the story so far.
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-white/55">
              EXdeck is open source and ships often. Read the full commit
              history on{" "}
              <a
                href="https://github.com/izhan0102/Deckflow/commits"
                target="_blank"
                rel="noreferrer"
                className="text-white underline-offset-4 hover:underline"
              >
                GitHub
              </a>
              .
            </p>
            <div className="mt-8 flex items-center justify-center gap-2.5">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition hover:bg-white/90"
              >
                <ArrowLeft size={12} /> Back to home
              </Link>
              <button
                onClick={() => goTo(0)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/85 transition hover:bg-white/10"
              >
                <ArrowUp size={12} /> Back to top
              </button>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        /* Hide the scroller's own scrollbar — the top bar shows progress. */
        .cl-scroller { scrollbar-width: none; }
        .cl-scroller::-webkit-scrollbar { width: 0; height: 0; }

        /* Off-screen release panels skip rendering work entirely. Huge win
           for scroll smoothness on a long changelog. */
        .cl-section {
          content-visibility: auto;
          contain-intrinsic-size: 100vh;
        }

        /* Reveal animation — items start low + transparent, ease into place.
           No blur filter (compositing many blurs tanks scroll perf). */
        .cl-reveal {
          opacity: 0;
          transform: translateY(24px);
          transition:
            opacity 500ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform;
        }
        .cl-reveal.cl-in {
          opacity: 1;
          transform: translateY(0);
          will-change: auto;
        }

        /* Cards animate themselves on mount (no observer dependency), so
           rows revealed by "Show more" always fade in instead of staying
           invisible. */
        .cl-card {
          animation: cl-card-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes cl-card-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cl-bounce { animation: cl-bounce 1.6s ease-in-out infinite; }
        @keyframes cl-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50%      { transform: translateY(5px); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cl-reveal { opacity: 1; transform: none; transition: none; }
          .cl-card { animation: none; }
          .cl-bounce { animation: none; }
          .cl-scroller { scroll-behavior: auto; }
        }
      `}</style>
    </div>
  );
}

function ReleaseSection({
  group, setRef,
}: { group: ReleaseGroup; setRef: (el: HTMLElement | null) => void }) {
  const [expanded, setExpanded] = useState(false);
  const COLLAPSED = 2;
  const items = group.items;
  const visible = expanded ? items : items.slice(0, COLLAPSED);
  const hidden = items.length - COLLAPSED;

  return (
    <section
      ref={setRef}
      className="cl-section relative flex min-h-screen snap-start snap-always items-center px-6 py-24"
    >
      {/* Ghost version watermark */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none font-bold leading-none text-white/[0.03]"
        style={{
          fontFamily: '"Fredoka", system-ui, sans-serif',
          fontSize: "clamp(120px, 26vw, 340px)",
          letterSpacing: "-0.04em",
        }}
      >
        {group.version}
      </span>

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        {/* Release head */}
        <div className="cl-reveal flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2
            className="font-semibold tabular-nums text-white"
            style={{
              fontFamily: '"Fredoka", system-ui, sans-serif',
              fontSize: "clamp(40px, 7vw, 72px)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {group.version}
          </h2>
          <span className="text-[13px] font-medium uppercase tracking-[0.2em] text-white/45">
            {group.label}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3 cl-reveal" style={{ transitionDelay: "60ms" }}>
          <span className="h-px w-12" style={{ background: "var(--ezd-fg-strong)" }} />
          <span className="text-[12px] text-white/40">
            {items.length} change{items.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Items — collapsed to 2 cards until expanded */}
        <ul className="mt-8 space-y-3">
          {visible.map((it, j) => (
            <ChangeCard key={it.sha} item={it} delayMs={Math.min(j, 8) * 55 + 120} />
          ))}
        </ul>

        {/* Show more / less — only when there's more than the collapsed count */}
        {items.length > COLLAPSED && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="cl-reveal mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-[12px] text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            {expanded ? "Show less" : `Show ${hidden} more`}
            <ChevronDown
              size={13}
              className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
    </section>
  );
}

function ChangeCard({ item: it, delayMs }: { item: ChangeItem; delayMs: number }) {
  return (
    <li
      className="cl-card group relative rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-all duration-300 hover:border-white/30 hover:bg-white/[0.05]"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex flex-wrap items-center gap-2 pr-24">
        <KindBadge kind={it.kind} />
        <span className="text-[15px] font-medium leading-snug text-white">
          {it.title}
        </span>
      </div>

      {it.body.length > 0 && (
        <ul className="mt-2 space-y-1 pl-0.5">
          {it.body.map((b, k) => (
            <li key={k} className="flex gap-2 text-[12.5px] leading-relaxed text-white/55">
              <span className="text-white/30">—</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Commit ref — always visible (theme-aware), brightens on hover. */}
      <a
        href={it.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2.5 inline-flex items-center gap-1 text-[11px] text-white/45 underline-offset-2 transition hover:text-white hover:underline"
      >
        <GitCommit size={11} />
        {it.shortSha} · {it.author}
      </a>

      {/* "details" hint — top-right, points to the GitHub commit. */}
      <a
        href={it.url}
        target="_blank"
        rel="noreferrer"
        title="View this commit on GitHub"
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/55 opacity-0 transition group-hover:opacity-100 hover:border-white/30 hover:text-white"
      >
        Details <ExternalLink size={9} />
      </a>
    </li>
  );
}

function KindBadge({ kind }: { kind: ChangeKind }) {
  return (
    <span className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-white/65">
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Faint oversized wordmark behind the hero for depth. */
function BigType() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 grid select-none place-items-center"
    >
      <span
        className="font-bold leading-none text-white/[0.025]"
        style={{
          fontFamily: '"Fredoka", system-ui, sans-serif',
          fontSize: "min(40vw, 520px)",
          letterSpacing: "-0.05em",
        }}
      >
        EX
      </span>
    </span>
  );
}

function countItems(groups: ReleaseGroup[]): number {
  return groups.reduce((a, g) => a + g.items.length, 0);
}
