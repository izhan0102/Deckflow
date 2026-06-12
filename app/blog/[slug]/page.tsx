import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import ContentShell, { ContentSections, ContentFaq } from "@/components/ContentShell";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog";
import { getLandingPage, CTA_NOTE } from "@/lib/content";
import {
  SITE_URL,
  articleJsonLd,
  breadcrumbJsonLd,
  faqListJsonLd,
  howToJsonLd,
} from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getBlogPost(params.slug);
  if (!post) return {};
  const url = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE_URL}${url}`,
      type: "article",
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified || post.datePublished,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const path = `/blog/${post.slug}`;
  const jsonLd: object[] = [
    articleJsonLd({
      title: post.title,
      description: post.description,
      path,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
    }),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.h1, path },
    ]),
  ];
  if (post.faq) jsonLd.push(faqListJsonLd(post.faq));
  if (post.howTo) jsonLd.push(howToJsonLd(post.howTo));

  const related = post.related
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
        <nav className="text-[12px] text-white/45">
          <Link href="/blog" className="hover:text-white/70">
            Blog
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-white/60">{post.h1}</span>
        </nav>

        <div className="mt-4 flex items-center gap-2 text-[11.5px] text-white/45">
          <time dateTime={post.datePublished}>
            {new Date(post.datePublished).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span>·</span>
          <span>{post.readMins} min read</span>
        </div>

        <h1 className="mt-2 text-[32px] font-bold leading-[1.12] tracking-tight text-white sm:text-[38px]">
          {post.h1}
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-white/70">{post.lede}</p>

        <ContentSections sections={post.sections} />

        <div className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6">
          <h2 className="text-[18px] font-semibold text-white">Build one now, free</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/70">{CTA_NOTE}</p>
          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black transition hover:bg-white/90"
          >
            Open the editor <ArrowRight size={15} />
          </Link>
        </div>

        {post.faq && <ContentFaq faq={post.faq} />}

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[15px] font-semibold tracking-tight text-white/80">
              Related tools
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
