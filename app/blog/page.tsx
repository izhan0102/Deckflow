import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ContentShell from "@/components/ContentShell";
import { BLOG_POSTS } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog — Guides on AI Presentations & PowerPoint",
  description:
    "Practical guides on making presentations with AI: how to turn text into a PowerPoint, build a pitch deck, and pick a free AI presentation maker.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "EXdeck Blog — AI Presentation Guides",
    description:
      "Guides on making presentations with AI — text to PowerPoint, pitch decks, and more.",
    url: `${SITE_URL}/blog`,
    type: "website",
  },
};

export default function BlogIndex() {
  const posts = [...BLOG_POSTS].sort((a, b) =>
    b.datePublished.localeCompare(a.datePublished),
  );

  return (
    <ContentShell>
      <main className="mx-auto max-w-3xl px-6 pb-16 pt-12">
        <h1 className="text-[34px] font-bold leading-[1.1] tracking-tight text-white sm:text-[40px]">
          Guides for better presentations
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-white/70">
          How to make presentations faster with AI — turning text into a
          PowerPoint, building pitch decks, and getting more out of a free AI
          presentation maker.
        </p>

        <div className="mt-10 space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2 text-[11.5px] text-white/45">
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
              <h2 className="mt-2 text-[19px] font-semibold tracking-tight text-white">
                {post.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                {post.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-cyan-300">
                Read <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </ContentShell>
  );
}
