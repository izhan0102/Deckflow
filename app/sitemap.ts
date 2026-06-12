import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { LANDING_PAGES } from "@/lib/content";
import { BLOG_POSTS } from "@/lib/blog";

/**
 * XML sitemap, generated at /sitemap.xml.
 *
 * Lists every public, indexable page with a priority that reflects how
 * much we want it ranked. The editor (/app), auth, and account pages are
 * intentionally excluded — they're behind login and have no SEO value.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    lastModified: Date = now,
  ) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });

  // High-intent keyword landing pages — the pages we most want ranked.
  const landing = LANDING_PAGES.map((p) => page(`/${p.slug}`, 0.9, "weekly"));

  // Blog index + posts.
  const blog = [
    page("/blog", 0.7, "weekly"),
    ...BLOG_POSTS.map((p) =>
      page(`/blog/${p.slug}`, 0.7, "monthly", new Date(p.dateModified || p.datePublished)),
    ),
  ];

  return [
    page("/", 1.0, "weekly"),
    ...landing,
    ...blog,
    page("/about", 0.6, "monthly"),
    page("/changelog", 0.5, "weekly"),
    page("/contact", 0.4, "monthly"),
    page("/privacy", 0.3, "yearly"),
    page("/terms", 0.3, "yearly"),
    page("/refund", 0.3, "yearly"),
    page("/shipping", 0.3, "yearly"),
  ];
}
