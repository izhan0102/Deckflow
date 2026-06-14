import type { Theme } from "./themes";
import type { ChartSpec } from "./charts";

export type SlideLayout =
  | "title-hero"
  | "bullets"
  | "table"
  | "chart"
  | "two-column"
  | "quote"
  | "section"
  | "references"
  | "closing";

export type Anchor =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type Annotation = {
  id: string;
  text: string;
  anchor: Anchor;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
};

export type ContentDensity = "concise" | "balanced" | "detailed" | "comprehensive";

export type ElementId =
  | "title" | "subtitle" | "bullets" | "body" | "table" | "quote" | "chart" | "kicker"
  // Decorative elements that can be moved / resized / recolored / removed.
  | "bigInitial" | "accentBar" | "titleRule" | "kickerTick";
export type ElementOffset = { dx: number; dy: number };

/** Override for a generic decorative element (line, bar, shape). All fields
 *  optional — only what the user changed is stored. */
export type DecoOverride = {
  dx?: number;       // drag offset in slide inches
  dy?: number;
  scale?: number;    // size multiplier (default 1)
  color?: string;    // override color
  hidden?: boolean;  // removed by the user
};

export type TableData = {
  headers: string[];
  rows: string[][];
  source?: string;
};

export type Reference = {
  id?: string;
  text: string;
  url?: string;
};

export type UploadedImage = {
  id: string;
  /** "user" = uploaded photo. "decoration" = SVG decoration. "icon" = Iconify icon. "templateBg" = full-bleed template background. "chart" = data chart rendered from chartSpec. */
  kind?: "user" | "decoration" | "icon" | "templateBg" | "chart";
  dataUrl: string;     // for "user": base64 data: URL. Empty for decoration/icon/chart.
  decorationId?: string;
  /** Iconify id like "tabler:rocket" or "mdi:home" — used when kind === "icon". */
  iconId?: string;
  /** Chart spec — used when kind === "chart". Rendered live so it recolors
   *  with the theme and stays editable (data, type, colors). */
  chartSpec?: ChartSpec;
  /** Per-element color overrides applied on top of the slide theme. */
  colorOverrides?: { accent?: string; muted?: string; fg?: string };
  /** Optional opacity, 0..1. When undefined the element is fully opaque. */
  opacity?: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Slide = {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  notes?: string;
  table?: TableData;
  /** Optional labels for the two columns of a two-column slide (e.g.
   *  ["Challenges", "Opportunities"]). When absent, the "compare" variant
   *  falls back to generic Pros/Cons, and other variants show no header. */
  columnLabels?: { left: string; right: string };
  /** Optional data chart rendered as the slide's main visual (bar/line/pie/donut/area).
   *  Used by the "chart" layout. The AI emits this only when the content is
   *  genuinely numeric/quantitative — never decoratively. */
  chart?: ChartSpec;
  references?: Reference[];
  /** Optional variant for the title-hero layout. */
  titleVariant?: "centered" | "asymmetric" | "big-initial" | "numbered" | "underlined" | "editorial-serif" | "concept-hero" | "grain-sphere" | "editorial-classic" | "display-serif" | "stacked-bold" | "centered-serif";
  /** Bullets layout style. */
  bulletsVariant?: "standard" | "numbered" | "cards" | "icon-check" | "dashed" | "concept-cards";
  /** Two-column layout style. */
  twoColumnVariant?: "classic" | "divider" | "cards" | "numbered" | "compare";
  /** Table layout style. */
  tableVariant?: "zebra" | "bordered" | "minimal" | "accent-header" | "compact";
  /** Quote layout style. */
  quoteVariant?: "giant-mark" | "centered" | "card" | "editorial" | "stacked";
  /** Section divider style. */
  sectionVariant?: "panel" | "split" | "minimal" | "chapter" | "kicker-hero";
  /** Closing slide style. */
  closingVariant?: "centered" | "qa" | "contact" | "cta" | "signature";
  /** Small uppercase line shown above the title (e.g. "Q3 INVESTOR UPDATE"). */
  kicker?: string;

  // Per-slide style overrides set via the chat box.
  titleScale?: number;
  bodyScale?: number;
  /** Chart size multiplier (0.6 .. 1.6). Applied to the chart layout's plot area. */
  chartScale?: number;
  fontOverride?: "sans" | "serif" | "mono";
  textColorOverride?: string;
  accentColorOverride?: string;
  backgroundColorOverride?: string;

  // Per-element offsets (drag), scales (size menu), and hidden flags
  elementOffsets?: Partial<Record<ElementId, ElementOffset>>;
  elementScales?: Partial<Record<ElementId, number>>;       // multiplier (legacy)
  elementFontSizes?: Partial<Record<ElementId, number>>;     // absolute pt size override
  elementHidden?: Partial<Record<ElementId, boolean>>;
  /** Per-element color overrides (used by decorative bars/rules/big initial). */
  elementColors?: Partial<Record<ElementId, string>>;
  /** Per-element size multipliers for decorative elements (bars/rules/initial). */
  elementSizeScale?: Partial<Record<ElementId, number>>;
  /** Generic decorative-element overrides, keyed by an arbitrary string id
   *  (e.g. "accentBar", "contentRule", "sectionDivider"). Lets ANY line /
   *  bar / shape on ANY layout be moved, resized, recolored, or removed. */
  deco?: Record<string, DecoOverride>;

  annotations?: Annotation[];
  uploadedImages?: UploadedImage[];
  /** Optional per-slide background pattern (see lib/patterns.ts). */
  pattern?: { id: string; color?: string; opacity?: number };
  /** Per-role font preset ids from a custom template (title/subtitle/kicker/body). */
  templateFonts?: { title?: string; subtitle?: string; kicker?: string; body?: string };
  /** Free-floating text boxes the user adds via the side panel. */
  textBoxes?: TextBox[];
  /** Speaker notes split by presenter (group presentations). When present,
   *  `notes` holds the flattened "Speaker: line" version for export, and this
   *  holds the structured per-speaker breakdown for display. */
  noteSegments?: SpeakerNote[];
};

/** One presenter's spoken portion of a slide's speaker notes. */
export type SpeakerNote = {
  speaker: string;
  text: string;
};

/** A user-added, freely positioned text element. Position/size in slide inches. */
export type TextBox = {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  fontSize: number;   // pt
  fontId?: string;    // google-font preset id (see lib/fonts.ts)
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
};

export type Deck = {
  title: string;
  subtitle?: string;
  slides: Slide[];
  topic?: string;
  audience?: string;
  tone?: string;
  density?: ContentDensity;
  references?: Reference[];
  includeReferences?: boolean;
  /** Background graphic id (see lib/graphics.ts). "none" for no graphic. */
  graphic?: string;
  /** Optional accent override for the graphic. Hex like "#DC2626". */
  graphicAccent?: string;
  /** Selected font preset id (see lib/fonts.ts). Falls back to theme.font. */
  fontId?: string;
  /** True once the user has generated speaker notes via the "Generate notes"
   *  feature. Distinguishes them from the short draft notes the deck ships
   *  with at creation, so the editor shows "Generate notes" vs "Show notes". */
  speakerNotesGenerated?: boolean;
};

export type GenerateRequest = {
  prompt: string;
  theme: Theme;
  slideCount: number;
  audience?: string;
  tone?: string;
  density?: ContentDensity;
  includeReferences?: boolean;
};
