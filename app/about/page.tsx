import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Github, Linkedin, GraduationCap, MapPin, Mail } from "lucide-react";
import Logo from "@/components/Logo";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "About",
  description:
    "A note from the developer of EXdeck — the free AI PPT maker. What I built, why I built it, and how to get in touch.",
  alternates: { canonical: "/about" },
};

/**
 * About / developer's note.
 *
 * Long-form column read. Editorial layout, no marketing chrome — just
 * the maker's voice. Follows the same navy + cyan palette as the rest
 * of the site so it doesn't feel like a separate microsite.
 *
 * The landing page's "Developer's note" trigger now links here instead
 * of opening a popover.
 */
export default function AboutPage() {
  return (
    <main
      className="relative min-h-screen"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}
    >
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Logo size="sm" href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white"
          >
            <ArrowLeft size={12} /> Back to home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 sm:pt-20">
        {/* Kicker */}
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Editor&rsquo;s note
        </div>
        <h1
          className="mt-3 font-semibold text-white"
          style={{
            fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
            fontSize: "clamp(36px, 6vw, 60px)",
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
          }}
        >
          Hi, I&rsquo;m Izhan.
        </h1>
        <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-white/55">
          I built EXdeck because I was tired of opening PowerPoint and
          staring at the empty title slide. This is a note about what I
          made, why, and how to reach me when something&rsquo;s broken or
          could be better.
        </p>

        <div className="mt-8 h-px w-full bg-white/8" />

        {/* Long-form body in a serif column for readability */}
        <div
          className="mt-10 space-y-6 text-[15.5px] leading-[1.8] text-white/75"
          style={{
            fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
          }}
        >
          <p>
            Most &ldquo;AI presentation builders&rdquo; produce something
            fluent enough to look real but brittle enough that you have
            to redo it from scratch. The ones that produce something
            actually good lock it inside their own format and won&rsquo;t
            let you out. You can&rsquo;t open the file in PowerPoint, you
            can&rsquo;t edit a chart, you can&rsquo;t even change the
            font without paying.
          </p>
          <p>
            The bet here is that you can have both. A first draft that
            respects how decks are actually structured — with section
            dividers, tables, two-column comparisons, callout quotes,
            real footnotes, real references — and an editor that lets
            you do anything to it. Drag any text box. Recolor a chart by
            clicking it. Ask the chat to rewrite slide three. Export to
            PowerPoint and keep editing in PowerPoint if you want.
          </p>
          <p>
            Start free, no card needed: generate, edit, present, and export
            to .pptx and .pdf. Free decks carry a small &ldquo;Made with
            EXdeck&rdquo; mark; the paid plans lift the monthly limit, remove
            it, and add the finishing touches for people who present a lot.
            All I ask is a quick honest review before your first export.
          </p>
          <p>
            EXdeck is open source. The whole thing is published under my
            name on GitHub so anyone can read what it does, fork it,
            file issues, or send a pull request. I&rsquo;d genuinely
            love to know what&rsquo;s broken or could be better. The
            product gets better when people send notes.
          </p>
          <p>
            Thanks for using it.
          </p>
        </div>

        {/* Signature */}
        <div className="mt-10 flex items-center gap-3 border-t border-white/8 pt-6">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-700 text-sm font-semibold text-white">
            MI
          </div>
          <div>
            <div className="text-[14px] font-semibold text-white">
              Muhammad Izhan
            </div>
            <div className="text-[11.5px] text-white/45">
              Sole maintainer of EXdeck
            </div>
          </div>
        </div>

        {/* Quick facts */}
        <section className="mt-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300">
            About me
          </h2>
          <ul className="mt-4 space-y-2 text-[14px] text-white/70">
            <li className="flex items-center gap-2.5">
              <MapPin size={13} className="text-white/40" />
              From Kashmir, India
            </li>
            <li className="flex items-center gap-2.5">
              <GraduationCap size={13} className="text-white/40" />
              B.E. Computer Science, RNS Institute of Technology, Bengaluru
            </li>
            <li className="flex items-center gap-2.5">
              <Mail size={13} className="text-white/40" />
              <a
                href={`mailto:${LEGAL.SUPPORT_EMAIL}`}
                className="text-white/85 underline-offset-4 hover:underline"
              >
                {LEGAL.SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
        </section>

        {/* Outbound links */}
        <section className="mt-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Find me
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a
              href="https://github.com/izhan0102"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/30 hover:bg-white/[0.05]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/85 group-hover:bg-white/10">
                <Github size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white">GitHub</div>
                <div className="truncate text-[11.5px] text-white/45">@izhan0102</div>
              </div>
            </a>
            <a
              href="https://www.linkedin.com/in/muhammad-izhan-a404752a6/"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/30 hover:bg-white/[0.05]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/85 group-hover:bg-white/10">
                <Linkedin size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white">LinkedIn</div>
                <div className="truncate text-[11.5px] text-white/45">muhammad-izhan</div>
              </div>
            </a>
            <a
              href="https://github.com/izhan0102/Deckflow"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-cyan-300/30 bg-cyan-300/5 p-4 transition hover:border-cyan-300/60 hover:bg-cyan-300/10"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/40 bg-cyan-300/15 text-cyan-200 group-hover:bg-cyan-300/20">
                <Github size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white">EXdeck source</div>
                <div className="truncate text-[11.5px] text-cyan-200/70">View on GitHub →</div>
              </div>
            </a>
          </div>
        </section>

        {/* Closing */}
        <div className="mt-14 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="text-[12px] font-medium text-white">
            Caught a bug? Got a feature in mind?
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/55">
            Open an issue on GitHub or email{" "}
            <a
              href={`mailto:${LEGAL.SUPPORT_EMAIL}`}
              className="text-cyan-200 underline-offset-4 hover:underline"
            >
              {LEGAL.SUPPORT_EMAIL}
            </a>
            . Replies usually come back the same day.
          </p>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2 text-[12.5px] text-white/85 transition hover:bg-white/10"
          >
            <ArrowLeft size={12} /> Back to home
          </Link>
        </div>
      </article>
    </main>
  );
}
