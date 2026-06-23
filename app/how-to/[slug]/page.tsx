import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import { HOWTO_GUIDES, getHowToGuide } from "@/lib/howto";
import { SITE_URL, howToJsonLd, faqListJsonLd, breadcrumbJsonLd, landingSoftwareJsonLd } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return HOWTO_GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = getHowToGuide(params.slug);
  if (!g) return {};
  const path = `/how-to/${g.slug}`;
  return {
    title: { absolute: g.title },
    description: g.description,
    keywords: g.keywords,
    alternates: { canonical: path },
    openGraph: { title: g.title, description: g.description, url: `${SITE_URL}${path}`, type: "article" },
    twitter: { card: "summary_large_image", title: g.title, description: g.description },
  };
}

export default function HowToGuidePage({ params }: { params: { slug: string } }) {
  const g = getHowToGuide(params.slug);
  if (!g) notFound();

  const path = `/how-to/${g.slug}`;
  const jsonLd = [
    howToJsonLd({ name: g.h1, description: g.description, steps: g.steps }),
    faqListJsonLd(g.faq),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "How-to guides", path: "/how-to" },
      { name: g.h1, path },
    ]),
    landingSoftwareJsonLd(`EXdeck — ${g.kicker}`, g.description, path),
  ];
  const related = g.related.map((s) => getHowToGuide(s)).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {jsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/how-to" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}>
            <ArrowLeft size={13} /> All guides
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 pb-20 pt-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)" }}>{g.kicker} · How-to</p>
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[40px]" style={{ color: "var(--ezd-fg-strong)" }}>{g.h1}</h1>
        <p className="mt-4 text-[16px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{g.lede}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={g.ctaHref} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            {g.ctaLabel} <ArrowRight size={15} />
          </Link>
          <span className="text-[12.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>Free to start · No card needed</span>
        </div>

        <section className="mt-12">
          <h2 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Step by step</h2>
          <ol className="mt-6 space-y-4">
            {g.steps.map((s, i) => (
              <li key={s.name} className="flex gap-4 rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px] font-bold" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>{i + 1}</span>
                <span>
                  <span className="block text-[15.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{s.name}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 rounded-2xl border p-6" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="inline-flex items-center gap-2 text-[18px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}><Sparkles size={16} /> Try it now</h2>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>It takes seconds and the free plan needs no card.</p>
          <Link href={g.ctaHref} className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            {g.ctaLabel} <ArrowRight size={15} />
          </Link>
        </section>

        <section className="mt-12">
          <h2 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Frequently asked questions</h2>
          <div className="mt-4 divide-y" style={{ borderColor: "var(--ezd-divider)" }}>
            {g.faq.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{f.q}</summary>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--ezd-fg-muted)" }}>More guides</h2>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {related.map((r) => (
                <Link key={r.slug} href={`/how-to/${r.slug}`} className="rounded-full border px-3.5 py-1.5 text-[12.5px] transition hover:opacity-80" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}>
                  {r.h1}
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
