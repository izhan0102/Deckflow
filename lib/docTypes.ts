/**
 * EXdeck Docs — data model for the AI Document Maker.
 *
 * A document is an ordered list of typed blocks (like Notion/Word), rendered
 * onto a portrait A4 canvas and exported to PDF. Inline emphasis (bold /
 * italic / underline) is stored as light HTML inside text fields.
 */

export type DocAlign = "left" | "center" | "right" | "justify";
export type CalloutTone = "info" | "success" | "warning" | "neutral";
export type DocPattern = "none" | "dots" | "grid" | "lines" | "diagonal";
export type DocWatermark = { url: string; opacity: number; size: number /* px tile */ };

export type DocBlock =
  | { id: string; type: "heading"; level: 1 | 2 | 3; text: string; align?: DocAlign; fontSize?: number }
  | { id: string; type: "paragraph"; text: string; align?: DocAlign; fontSize?: number }
  | { id: string; type: "bullets"; items: string[]; fontSize?: number }
  | { id: string; type: "numbered"; items: string[]; fontSize?: number }
  | { id: string; type: "table"; headers: string[]; rows: string[][]; fontSize?: number }
  | { id: string; type: "quote"; text: string; cite?: string; fontSize?: number }
  | { id: string; type: "callout"; tone: CalloutTone; text: string; fontSize?: number }
  | { id: string; type: "chart"; chart: import("./charts").ChartSpec; caption?: string }
  | { id: string; type: "image"; url: string; caption?: string; width?: number /* % 20-100 */; align?: DocAlign }
  | { id: string; type: "divider" };

export type DocBlockType = DocBlock["type"];

export type DocTheme = {
  /** Body font id (see lib/docFonts). */
  fontId: string;
  /** Heading font id; falls back to body font. */
  headingFontId?: string;
  accent: string;   // hex with '#'
  fg: string;       // body text color
  bg: string;       // page background
  lineHeight: number;   // 1.3 – 2.0
  fontScale: number;    // 0.85 – 1.3 multiplier on base sizes
  marginIn: number;     // page margin in inches
  pageNumbers: boolean;
  cover: boolean;       // render a title cover block
  justify: boolean;     // justify body paragraphs
  pattern: DocPattern;  // subtle page background pattern
  watermark?: DocWatermark; // faint background logo on every page
};

export type ExDoc = {
  title: string;
  subtitle?: string;
  author?: string;
  topic?: string;
  theme: DocTheme;
  blocks: DocBlock[];
};

export type DocDensity = "concise" | "balanced" | "detailed" | "comprehensive";

export const DEFAULT_DOC_THEME: DocTheme = {
  fontId: "inter",
  headingFontId: "poppins",
  accent: "#7C5CFF",
  fg: "#1A1A1A",
  bg: "#FFFFFF",
  lineHeight: 1.6,
  fontScale: 1,
  marginIn: 1,
  pageNumbers: true,
  cover: true,
  justify: false,
  pattern: "none",
};

let _id = 0;
export function blockId(): string {
  _id += 1;
  return `b_${Date.now().toString(36)}_${_id}`;
}

/** A4 portrait, in CSS px at 96dpi (210 × 297 mm). */
export const A4 = { wPx: 794, hPx: 1123, wIn: 8.27, hIn: 11.69 };
