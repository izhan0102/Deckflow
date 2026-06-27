/**
 * Central SEO configuration.
 *
 * One source of truth for the site URL, brand, keywords, and the copy
 * used across <head> metadata, sitemap, robots, manifest, and JSON-LD
 * structured data.
 *
 * When you buy a domain, set NEXT_PUBLIC_SITE_URL in the environment
 * (e.g. NEXT_PUBLIC_SITE_URL=https://exdeck.xyz) and EVERYTHING — canonical
 * URLs, sitemap, OpenGraph, structured data — updates automatically. No
 * code change needed.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://exdeck.xyz"
).replace(/\/$/, "");

export const BRAND = "EXdeck";

/**
 * The terms real users type. People do NOT search "deck builder" — they
 * search "ppt maker", "free ppt", "ai ppt", "powerpoint from text". These
 * drive the title, description, and keyword surfaces site-wide.
 */
export const KEYWORDS = [
  // head terms people actually type
  "ppt maker",
  "free ppt maker",
  "ai ppt maker",
  "ppt generator",
  "ppt maker free",
  "ai ppt generator",
  "powerpoint ai",
  "ai powerpoint generator",
  "presentation maker",
  "free presentation maker",
  "ai presentation maker",
  "make ppt online",
  "create ppt from text",
  "ppt from text",
  "ai slides generator",
  "pptx generator",
  "online ppt maker free",
  "presentation generator",
  "slide maker",
  "ai slide maker",
  "powerpoint generator free",
  "text to ppt",
  "text to presentation",
  "ppt creator",
  "free pptx maker",
  // brand terms + common misspellings/variants (so brand searches always land here)
  "exdeck",
  "exdeck ai",
  "exdeck ppt",
  "exdeck ppt maker",
  "exdeck ai ppt maker",
  "exdeck presentation maker",
  "xdeck",
  "xdeck ai",
  "xdeck ppt",
  "xdeck ppt maker",
  "ex deck",
  "ex deck ai",
  "exdec",
  "exdeck spreadsheet",
  "exdeck app",
  // other AI tools on the platform (whole-site coverage)
  "ai spreadsheet",
  "ai excel generator",
  "ai document generator",
  "ai resume builder",
  "ai resume maker",
  "ai document analyser",
  "ai document analyzer",
  "analyse document with ai",
  "ai pdf analyzer",
  "compare documents ai",
  "pdf to ppt",
  "pdf to powerpoint",
  "pdf presenter",
  "present pdf",
  "present pdf full screen",
  "present pdf without powerpoint",
  "file converter online",
  "gamma alternative",
  "free gamma alternative",
];

/** Brand name variants — fed to JSON-LD `alternateName` so search engines
 *  associate misspellings and shorthand (xdeck, exdeck ai, ex deck) with the
 *  brand and surface this site for those queries. */
export const BRAND_ALIASES = [
  "EXdeck",
  "EXdeck AI",
  "EXdeck AI PPT Maker",
  "EXdeck Presentation Maker",
  "EXdeck Spreadsheet",
  "Exdeck",
  "Ex deck",
  "Xdeck",
  "Xdeck AI",
  "Xdeck PPT",
  "exdeck.xyz",
];

export const DEFAULT_TITLE =
  "EXdeck — Free AI PPT Maker | Make PowerPoint Presentations from Text";

export const TITLE_TEMPLATE = "%s | EXdeck — AI PPT Maker";

export const DEFAULT_DESCRIPTION =
  "AI PPT maker with a free plan. Type a topic and get an editable PowerPoint presentation in seconds — real charts, themes, and one-click PPTX and PDF export. The fastest online AI presentation generator. No template wrestling, free to start.";

export const SHORT_DESCRIPTION =
  "Make PowerPoint presentations from text for free with AI. Editable slides in seconds, real PPTX & PDF export.";

/** FAQ pairs — surfaced visibly on the landing AND as FAQPage JSON-LD.
 *  Written around the exact questions people search. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is EXdeck free to use?",
    a: "Yes, there's a free plan. You get 40 AI credits every month to generate and edit decks, documents, spreadsheets, and resumes, and you can preview, present, and export to PowerPoint (.pptx) and PDF (free exports carry a small watermark). Pro gives you 1,500 credits per day and unlocks every feature, with Team and Organisation plans for shared seats.",
  },
  {
    q: "How do I make a PowerPoint presentation from text?",
    a: "Type a one-line brief describing your topic, answer a few quick questions about what you want, and EXdeck's AI writes and designs a full slide deck in seconds. You can then edit every slide and export it to PowerPoint or PDF.",
  },
  {
    q: "Can I export to real PowerPoint (PPTX)?",
    a: "Yes. EXdeck exports a real Microsoft PowerPoint (.pptx) file that opens and edits in PowerPoint, Keynote, and Google Slides, plus a high-resolution PDF. Your text, charts, themes, and images are preserved.",
  },
  {
    q: "Does the AI create charts and graphs?",
    a: "Yes. When your topic has real data, EXdeck generates clean bar, line, pie, and donut charts directly on the slides, colored to match your theme. If a topic has no real numbers, it stays text-only instead of inventing data.",
  },
  {
    q: "Is EXdeck better than other AI presentation makers?",
    a: "EXdeck gives you a real inline editor (not a one-shot generator), genuine PowerPoint and PDF export with no lock-in, a free plan plus affordable Pro plans, and an AI that asks what you want before building. Generation takes about ten seconds.",
  },
  {
    q: "How long does it take to make a presentation?",
    a: "About ten seconds to generate the first draft. From a blank brief to a finished, exported deck, most people are done in under a minute.",
  },
];

/** Global JSON-LD: the app itself, the brand, and the website. */
export function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "EXdeck",
    alternateName: BRAND_ALIASES,
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: DEFAULT_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free to generate, edit, and present. Pay once per file to download.",
    },
    featureList: [
      "AI PowerPoint generation from a text prompt",
      "Editable slides with drag-and-drop",
      "Real PPTX and PDF export",
      "AI-generated charts and diagrams",
      "AI spreadsheets with live formulas (Excel export)",
      "AI documents and resume builder",
      "AI document analyser (any format, multi-doc synthesis)",
      "Free file converters (PDF, images, and more)",
      "Present any PDF full-screen (PDF presenter)",
      "200,000+ icons",
      "45 themes and 28 fonts",
    ],
    browserRequirements: "Requires a modern web browser.",
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    alternateName: BRAND_ALIASES,
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    sameAs: ["https://github.com/izhan0102/Deckflow"],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    alternateName: BRAND_ALIASES,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  Structured-data helpers for content pages (landing + blog).               */
/* -------------------------------------------------------------------------- */

/** Breadcrumb trail — improves how the URL renders in search results. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

/** FAQPage JSON-LD from an arbitrary list (used by landing pages). */
export function faqListJsonLd(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Article JSON-LD for a blog post. */
export function articleJsonLd(post: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    url: `${SITE_URL}${post.path}`,
    mainEntityOfPage: `${SITE_URL}${post.path}`,
    datePublished: post.datePublished,
    dateModified: post.dateModified || post.datePublished,
    author: { "@type": "Person", name: "Muhammad Izhan" },
    publisher: {
      "@type": "Organization",
      name: BRAND,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon` },
    },
  };
}

/** HowTo JSON-LD — eligible for the rich "steps" result in Google. */
export function howToJsonLd(input: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    step: input.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

/** SoftwareApplication JSON-LD scoped to a specific landing keyword. */
export function landingSoftwareJsonLd(name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    url: `${SITE_URL}${path}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}
