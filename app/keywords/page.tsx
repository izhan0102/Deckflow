import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import { buildKeywords, targetFor } from "@/lib/keywords";
import { SITE_URL, BRAND, breadcrumbJsonLd } from "@/lib/seo";

const PATH = "/keywords";
const TITLE = "Everything You Can Make with EXdeck — AI PPT, Docs, Sheets, Resumes & More";
const DESCRIPTION =
  "Browse every kind of presentation, document, spreadsheet, resume and file EXdeck's AI can create — free. PPT makers, PowerPoint generators, pitch decks, reports, and thousands of topics, all in one place.";

const KEYWORDS = buildKeywords();

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: KEYWORDS.slice(0, 500), // <meta keywords> — a representative slice
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}${PATH}`, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function KeywordsHub() {
  const crumbs = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Everything you can make", path: PATH }]);
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    isPartOf: { "@type": "WebSite", name: BRAND, url: SITE_URL },
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}><ArrowLeft size={13} /> Home</Link>
        </div>
      </header>

      {/* Intro for real users */}
      <section className="mx-auto max-w-3xl px-5 pt-12 text-center sm:pt-16">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)" }}><Sparkles size={12} /> Explore</div>
        <h1 className="mx-auto mt-3 max-w-2xl text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[42px]" style={{ color: "var(--ezd-fg-strong)" }}>
          Everything you can make with EXdeck
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          EXdeck turns a sentence into a finished presentation, document, spreadsheet, or resume — with real charts,
          editable slides, and one-click export. Browse the ideas below and jump straight into the right tool.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/app" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Start creating free <ArrowRight size={15} />
          </Link>
          <Link href="/how-to" className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[14px] font-semibold" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)" }}>
            How-to guides
          </Link>
        </div>
      </section>

      {/* Quick tool links */}
      <section className="mx-auto max-w-4xl px-5 pt-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[["Presentations", "/presentations"], ["Documents", "/documents"], ["Spreadsheet", "/spreadsheet"], ["Resumes", "/resumes"], ["PDF to PPT", "/pdf-to-ppt"], ["Converters", "/converter"]].map(([label, href]) => (
            <Link key={href} href={href} className="rounded-2xl border p-4 text-center text-[13px] font-semibold transition hover:-translate-y-0.5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>{label}</Link>
          ))}
        </div>
      </section>

      {/* Browsable keyword/topic index (real internal links) */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--ezd-fg-muted)" }}>Browse by topic &amp; tool</h2>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {KEYWORDS.map((kw) => (
            <Link key={kw} href={targetFor(kw)} className="rounded-full border px-2.5 py-1 text-[11.5px] transition hover:opacity-80"
              style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}>
              {kw}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
