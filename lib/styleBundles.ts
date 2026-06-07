/**
 * Style bundles: curated, self-consistent sets of per-layout variants the
 * user picks AFTER the clarify questions, just before generation. Unlike
 * templates (which also bundle theme + font + graphic), a style bundle is
 * ONLY the visual styling of each layout — it rides on top of whatever
 * theme / font / graphic the user already chose, so every bundle preview
 * shows the SAME theme, just a different look.
 *
 * Each bundle defines exactly one variant per layout: one intro style,
 * one bullet style, one table style, one closing ("thank you") style, etc.
 * There's one bundle built around each distinct variant family so users
 * can see every style we offer. The choice is non-destructive: every slide
 * remains editable on the deck page via the Style Variants panel.
 */

import type { Slide } from "./types";
import type { TemplateVariantDefaults } from "./templates";
import type { ChartSpec } from "./charts";

export type StyleBundle = {
  id: string;
  name: string;
  /** One-line, benefit-focused description of the vibe. */
  tagline: string;
  /** Lucide icon key, mapped to a component in the picker UI. */
  icon: "briefcase" | "mic" | "graduation" | "notebook" | "feather" | "palette";
  variants: Required<TemplateVariantDefaults>;
};

/**
 * Six audience-tuned bundles. Each maps to a real use-case and uses a
 * distinct, internally-consistent set of variants so no two look alike.
 * There's one variant per layout, so picking a bundle gives a fully
 * coherent deck (one intro style, one bullet style, one table style, one
 * thank-you style, etc.).
 */
export const STYLE_BUNDLES: StyleBundle[] = [
  {
    id: "professional",
    name: "Professional",
    tagline: "Polished and corporate. Ideal for business and client decks.",
    icon: "briefcase",
    variants: {
      titleVariant: "underlined",
      bulletsVariant: "icon-check",
      twoColumnVariant: "numbered",
      tableVariant: "accent-header",
      quoteVariant: "card",
      sectionVariant: "split",
      closingVariant: "contact",
    },
  },
  {
    id: "keynote",
    name: "Keynote",
    tagline: "Bold and cinematic. Made for talks and big-stage moments.",
    icon: "mic",
    variants: {
      titleVariant: "big-initial",
      bulletsVariant: "cards",
      twoColumnVariant: "cards",
      tableVariant: "bordered",
      quoteVariant: "stacked",
      sectionVariant: "kicker-hero",
      closingVariant: "cta",
    },
  },
  {
    id: "teacher",
    name: "Teacher",
    tagline: "Clear and structured. Great for lessons and lectures.",
    icon: "graduation",
    variants: {
      titleVariant: "centered",
      bulletsVariant: "standard",
      twoColumnVariant: "classic",
      tableVariant: "zebra",
      quoteVariant: "centered",
      sectionVariant: "chapter",
      closingVariant: "qa",
    },
  },
  {
    id: "student",
    name: "Student",
    tagline: "Simple and friendly. Perfect for projects and assignments.",
    icon: "notebook",
    variants: {
      titleVariant: "numbered",
      bulletsVariant: "numbered",
      twoColumnVariant: "divider",
      tableVariant: "compact",
      quoteVariant: "card",
      sectionVariant: "minimal",
      closingVariant: "centered",
    },
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Refined and literary. A magazine-style reading feel.",
    icon: "feather",
    variants: {
      titleVariant: "editorial-serif",
      bulletsVariant: "dashed",
      twoColumnVariant: "divider",
      tableVariant: "minimal",
      quoteVariant: "editorial",
      sectionVariant: "chapter",
      closingVariant: "signature",
    },
  },
  {
    id: "creative",
    name: "Creative",
    tagline: "Expressive and modern. For brand, design, and pitch decks.",
    icon: "palette",
    variants: {
      titleVariant: "asymmetric",
      bulletsVariant: "cards",
      twoColumnVariant: "cards",
      tableVariant: "accent-header",
      quoteVariant: "stacked",
      sectionVariant: "panel",
      closingVariant: "qa",
    },
  },
];

export function getStyleBundle(id?: string | null): StyleBundle | undefined {
  return STYLE_BUNDLES.find((b) => b.id === id);
}

/**
 * Apply a bundle's variants to a slide, OVERRIDING any variant the AI may
 * have chosen. Unlike applyTemplateToSlide (which only fills empty slots),
 * an explicit bundle pick is a deliberate user choice, so it must win —
 * otherwise the user picks "Keynote" and still sees the AI's defaults.
 * Content fields are untouched; only the per-layout style is forced.
 */
export function applyBundleToSlide(slide: Slide, b: StyleBundle): Slide {
  return {
    ...slide,
    titleVariant: b.variants.titleVariant,
    bulletsVariant: b.variants.bulletsVariant,
    twoColumnVariant: b.variants.twoColumnVariant,
    tableVariant: b.variants.tableVariant,
    quoteVariant: b.variants.quoteVariant,
    sectionVariant: b.variants.sectionVariant,
    closingVariant: b.variants.closingVariant,
  };
}

/* ---------------------------- sample slides ---------------------------- */

/**
 * Representative sample slides used to render bundle previews. The bundle's
 * variants get layered on at render time, so the same content shows in
 * every bundle's look. These are display-only placeholders.
 */
const SAMPLE_CHART: ChartSpec = {
  type: "bar",
  title: "Quarterly growth",
  unit: "%",
  data: [
    { label: "Q1", value: 24 },
    { label: "Q2", value: 38 },
    { label: "Q3", value: 53 },
    { label: "Q4", value: 71 },
  ],
};

export type BundlePreviewKind = "intro" | "bullets" | "chart" | "table" | "closing";

export const BUNDLE_PREVIEW_ORDER: { kind: BundlePreviewKind; label: string }[] = [
  { kind: "intro",   label: "Intro" },
  { kind: "bullets", label: "Bullets" },
  { kind: "chart",   label: "Chart" },
  { kind: "table",   label: "Table" },
  { kind: "closing", label: "Thank you" },
];

/** Build the base sample slide for a given preview kind (no variant set yet). */
export function sampleSlide(kind: BundlePreviewKind): Slide {
  switch (kind) {
    case "intro":
      return {
        layout: "title-hero",
        title: "Your Big Idea",
        subtitle: "A clear, one-line promise for the audience.",
        kicker: "PRESENTATION",
      };
    case "bullets":
      return {
        layout: "bullets",
        title: "Key points",
        bullets: [
          "A first clear, scannable point",
          "A second supporting idea",
          "A third memorable takeaway",
        ],
      };
    case "chart":
      return {
        layout: "chart",
        title: "Growth over the year",
        subtitle: "Revenue, quarter by quarter",
        chart: SAMPLE_CHART,
      };
    case "table":
      return {
        layout: "table",
        title: "At a glance",
        table: {
          headers: ["Plan", "Speed", "Price"],
          rows: [
            ["Basic", "Fast", "$"],
            ["Pro", "Faster", "$$"],
            ["Max", "Fastest", "$$$"],
          ],
          source: "",
        },
      };
    case "closing":
      return {
        layout: "closing",
        title: "Thank you",
        subtitle: "Questions?",
      };
  }
}
