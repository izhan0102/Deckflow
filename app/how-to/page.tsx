import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import { HOWTO_GUIDES } from "@/lib/howto";
import { SITE_URL, breadcrumbJsonLd } from "@/lib/seo";

const PATH = "/how-to";
const TITLE = "How-to Guides — Make Presentations, Spreadsheets, Docs & More with AI";
const DESCRIPTION =
  "Step-by-step EXdeck guides: how to make a presentation with AI, build a spreadsheet, write a document, create a resume, convert PDF to PPT, and convert files online — all free.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: ["how to make a presentation with ai", "how to make a spreadsheet with ai", "how to convert pdf to ppt", "ai how to guides", "exdeck guides"],
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}${PATH}`, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function HowToHub() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: HOWTO_GUIDES.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.h1,
      url: `${SITE_URL}/how-to/${g.slug}`,
    })),
  };
  const crumbs = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "How-to guides", path: PATH }]);

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}>
            <ArrowLeft size={13} /> Home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 pt-12 sm:pt-14">
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)" }}>How-to guides</div>
          <h1 className="mx-auto mt-3 max-w-2xl text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[42px]" style={{ color: "var(--ezd-fg-strong)" }}>
            Learn EXdeck in a few steps
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            Short, practical walkthroughs for every tool — presentations, spreadsheets, documents, resumes, and file converters.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {HOWTO_GUIDES.map((g) => (
            <Link key={g.slug} href={`/how-to/${g.slug}`} className="group rounded-2xl border p-5 transition hover:-translate-y-0.5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}>{g.kicker}</div>
              <h2 className="mt-1.5 text-[17px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{g.h1}</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{g.description}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-strong)" }}>Read the guide <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <Link href="/app" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
          Start creating free <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
