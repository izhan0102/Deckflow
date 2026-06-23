/**
 * Build-time static sitemap generator.
 *
 * Writes public/sitemap.xml from the same content data the app uses, so the
 * sitemap is served as a plain static file from the CDN (clean headers, no
 * Next.js RSC `Vary` header) while still staying in sync on every build.
 *
 * Run via `npm run sitemap` or automatically before `next build`.
 */
import fs from "node:fs";
import path from "node:path";
import { LANDING_PAGES } from "../lib/content";
import { BLOG_POSTS } from "../lib/blog";
import { CONVERTERS } from "../lib/converters";
import { HOWTO_GUIDES } from "../lib/howto";
import { SITE_URL } from "../lib/seo";

type Freq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

function urlEntry(loc: string, priority: number, changefreq: Freq, lastmod: string): string {
  return [
    "  <url>",
    `    <loc>${SITE_URL}${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    "  </url>",
  ].join("\n");
}

function build(): string {
  const now = new Date().toISOString();
  const entries: string[] = [];

  entries.push(urlEntry("/", 1.0, "weekly", now));

  // High-intent keyword + competitor landing pages.
  for (const p of LANDING_PAGES) {
    entries.push(urlEntry(`/${p.slug}`, 0.9, "weekly", now));
  }

  // Blog index + posts.
  entries.push(urlEntry("/blog", 0.7, "weekly", now));
  for (const p of BLOG_POSTS) {
    const lm = new Date(p.dateModified || p.datePublished).toISOString();
    entries.push(urlEntry(`/blog/${p.slug}`, 0.7, "monthly", lm));
  }

  // Feature landing pages (high SEO priority).
  entries.push(urlEntry("/presentations", 1.0, "weekly", now));
  entries.push(urlEntry("/documents", 1.0, "weekly", now));
  entries.push(urlEntry("/resumes", 1.0, "weekly", now));
  entries.push(urlEntry("/pdf-presenter", 1.0, "weekly", now));

  // Evergreen / legal.
  entries.push(urlEntry("/pdf-to-ppt", 0.9, "monthly", now));
  entries.push(urlEntry("/spreadsheet", 0.9, "weekly", now));
  entries.push(urlEntry("/converter", 0.9, "weekly", now));
  for (const c of CONVERTERS) {
    entries.push(urlEntry(`/converter/${c.slug}`, 0.8, "monthly", now));
  }

  // How-to guides hub + pages (HowTo rich-result eligible).
  entries.push(urlEntry("/how-to", 0.8, "weekly", now));
  for (const g of HOWTO_GUIDES) {
    entries.push(urlEntry(`/how-to/${g.slug}`, 0.8, "monthly", now));
  }
  entries.push(urlEntry("/about", 0.6, "monthly", now));
  entries.push(urlEntry("/changelog", 0.5, "weekly", now));
  entries.push(urlEntry("/contact", 0.4, "monthly", now));
  for (const p of ["/privacy", "/terms", "/refund", "/shipping"]) {
    entries.push(urlEntry(p, 0.3, "yearly", now));
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") +
    `\n</urlset>\n`
  );
}

const xml = build();
const out = path.join(process.cwd(), "public", "sitemap.xml");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, xml, "utf8");
const count = (xml.match(/<url>/g) || []).length;
console.log(`[sitemap] wrote ${out} with ${count} URLs`);
