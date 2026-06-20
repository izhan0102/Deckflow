import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt, generated at /robots.txt.
 *
 * Allow crawling of everything public. Disallow the API, the logged-in
 * editor, account pages, and one-off success/verify pages that have no
 * search value (and shouldn't show up in results). Point crawlers at the
 * sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/app",
          "/app/",
          "/auth",
          "/verify-email",
          "/preview/",
          "/reviews",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    
  };
}
