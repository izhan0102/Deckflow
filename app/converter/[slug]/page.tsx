import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import ConverterTool from "@/components/ConverterTool";
import OrganizePdf from "@/components/OrganizePdf";
import { CONVERTERS, getConverter } from "@/lib/converters";
import { SITE_URL, landingSoftwareJsonLd, howToJsonLd, faqListJsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return CONVERTERS.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = getConverter(params.slug);
  if (!c) return {};
  const path = `/converter/${c.slug}`;
  return {
    title: { absolute: c.title },
    description: c.description,
    keywords: c.keywords,
    alternates: { canonical: path },
    openGraph: { title: c.title, description: c.description, url: `${SITE_URL}${path}`, type: "website" },
    twitter: { card: "summary_large_image", title: c.title, description: c.description },
  };
}

export default function ConverterPage({ params }: { params: { slug: string } }) {
  const c = getConverter(params.slug);
  if (!c) notFound();

  const path = `/converter/${c.slug}`;
  const jsonLd = [
    landingSoftwareJsonLd(`EXdeck ${c.name}`, c.description, path),
    howToJsonLd({ name: c.h1, description: c.description, steps: c.steps }),
    faqListJsonLd(c.faq),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Converters", path: "/converter" }, { name: c.name, path }]),
  ];
  const related = CONVERTERS.filter((x) => x.category === c.category && x.slug !== c.slug).slice(0, 6);

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {jsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/converter" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}>
            <ArrowLeft size={13} /> All converters
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 pt-12 sm:pt-16">
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}>{c.category} converter</div>
          <h1 className="mx-auto mt-3 max-w-2xl text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]" style={{ color: "var(--ezd-fg-strong)" }}>{c.h1}</h1>
          <p className="mx-auto mt-3 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{c.tagline} Free, private, and right in your browser — no upload, no watermark, no sign-up.</p>
        </div>

        <div className="mt-9 rounded-3xl border p-4 sm:p-6" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
          {c.interactive ? <OrganizePdf /> : <ConverterTool slug={c.slug} />}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="text-center text-[22px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>How it works</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {c.steps.map((s, i) => (
            <div key={s.name} className="rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <div className="grid h-8 w-8 place-items-center rounded-lg text-[14px] font-bold" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>{i + 1}</div>
              <h3 className="mt-3 text-[14.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{s.name}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16">
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>FAQ</h2>
        <div className="mt-5 divide-y" style={{ borderColor: "var(--ezd-divider)" }}>
          {c.faq.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{f.q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-3xl px-5 pb-20">
          <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--ezd-fg-muted)" }}>More {c.category.toLowerCase()} tools</h2>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {related.map((r) => (
              <Link key={r.slug} href={`/converter/${r.slug}`} className="rounded-full border px-3.5 py-1.5 text-[12.5px] transition hover:opacity-80" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>
                {r.name}
              </Link>
            ))}
          </div>
          <Link href="/converter" className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
            See all converters <ArrowRight size={14} />
          </Link>
        </section>
      )}
    </main>
  );
}
