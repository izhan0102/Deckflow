import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import ContentShell, { ContentSections, ContentFaq } from "@/components/ContentShell";
import { LANDING_PAGES, getLandingPage, CTA_NOTE } from "@/lib/content";
import {
  SITE_URL,
  faqListJsonLd,
  breadcrumbJsonLd,
  landingSoftwareJsonLd,
} from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANDING_PAGES.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getLandingPage(params.slug);
  if (!page) return {};
  const url = `/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${SITE_URL}${url}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    },
  };
}

export default function LandingPage({ params }: { params: { slug: string } }) {
  const page = getLandingPage(params.slug);
  if (!page) notFound();

  const path = `/${page.slug}`;
  const jsonLd = [
    landingSoftwareJsonLd(page.title, page.description, path),
    faqListJsonLd(page.faq),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: page.h1, path },
    ]),
  ];

  const related = page.related
    .map((s) => getLandingPage(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <ContentShell>
      {jsonLd.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}

      <main className="mx-auto max-w-3xl px-6 pb-16 pt-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
          {page.keyword}
        </p>
        <h1 className="mt-2 text-[34px] font-bold leading-[1.1] tracking-tight text-white sm:text-[40px]">
          {page.h1}
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-white/70">{page.lede}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black transition hover:bg-white/90"
          >
            Make a presentation free <ArrowRight size={15} />
          </Link>
          <span className="text-[12.5px] text-white/45">No card needed · Export to PPTX &amp; PDF</span>
        </div>

        <ContentSections sections={page.sections} />

        {/* Mid-page CTA */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6">
          <h2 className="text-[18px] font-semibold text-white">Try it now</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/70">{CTA_NOTE}</p>
          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black transition hover:bg-white/90"
          >
            Open the editor <ArrowRight size={15} />
          </Link>
        </div>

        <ContentFaq faq={page.faq} />

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[15px] font-semibold tracking-tight text-white/80">
              Related
            </h2>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${r.slug}`}
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] text-white/75 transition hover:bg-white/10"
                >
                  {r.h1}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </ContentShell>
  );
}
