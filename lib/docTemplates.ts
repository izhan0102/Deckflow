import type { DocTheme } from "./docTypes";

/** A document template = a named set of theme overrides applied after generation. */
export type DocTemplate = {
  id: string;
  name: string;
  blurb: string;
  theme: Partial<DocTheme>;
};

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "clean", name: "Clean", blurb: "Crisp white, modern sans",
    theme: { fontId: "inter", headingFontId: "poppins", accent: "#7C5CFF", bg: "#FFFFFF", fg: "#1A1A1A", pattern: "none", justify: false },
  },
  {
    id: "crimson", name: "Crimson Report", blurb: "White page, bold red accent",
    theme: { fontId: "source-serif", headingFontId: "playfair", accent: "#DC2626", bg: "#FFFFFF", fg: "#1A1A1A", pattern: "none", justify: true },
  },
  {
    id: "slate-grid", name: "Slate Grid", blurb: "Subtle grid, technical feel",
    theme: { fontId: "ibm-plex-sans", headingFontId: "ibm-plex-sans", accent: "#0F766E", bg: "#FFFFFF", fg: "#111827", pattern: "grid", justify: false },
  },
  {
    id: "soft-dots", name: "Soft Dots", blurb: "Off-white with a dotted field",
    theme: { fontId: "dm-sans", headingFontId: "dm-sans", accent: "#7C3AED", bg: "#FBFAFF", fg: "#1F2937", pattern: "dots", justify: false },
  },
  {
    id: "editorial", name: "Editorial", blurb: "Warm cream, classic serif",
    theme: { fontId: "lora", headingFontId: "playfair", accent: "#B45309", bg: "#FBF7EF", fg: "#1C1917", pattern: "none", justify: true },
  },
  {
    id: "corporate", name: "Corporate Blue", blurb: "Professional, navy accent",
    theme: { fontId: "work-sans", headingFontId: "montserrat", accent: "#1D4ED8", bg: "#FFFFFF", fg: "#0F172A", pattern: "lines", justify: false },
  },
  {
    id: "mono", name: "Minimal Mono", blurb: "Black & white, restrained",
    theme: { fontId: "inter", headingFontId: "inter", accent: "#111111", bg: "#FFFFFF", fg: "#111111", pattern: "none", justify: false },
  },
  {
    id: "forest", name: "Diagonal Green", blurb: "Earthy green, diagonal lines",
    theme: { fontId: "nunito", headingFontId: "poppins", accent: "#15803D", bg: "#FCFEFC", fg: "#14271B", pattern: "diagonal", justify: false },
  },
];

export function applyDocTemplate(theme: DocTheme, tpl: DocTemplate): DocTheme {
  return { ...theme, ...tpl.theme };
}
