import type { Slide, ElementId } from "./types";

export const SLIDE_W_IN = 13.333;
export const SLIDE_H_IN = 7.5;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function tScale(s?: Slide) { return clamp(s?.titleScale ?? 1, 0.5, 1.8); }
function bScale(s?: Slide) { return clamp(s?.bodyScale ?? 1, 0.5, 1.8); }

export function elScale(slide: Slide | undefined, id: ElementId): number {
  const v = slide?.elementScales?.[id];
  return clamp(typeof v === "number" && isFinite(v) ? v : 1, 0.6, 1.6);
}

export function isHidden(slide: Slide | undefined, id: ElementId): boolean {
  return !!slide?.elementHidden?.[id];
}

/** Returns the explicit pt override if set; otherwise undefined. */
export function explicitFontSize(slide: Slide | undefined, id: ElementId): number | undefined {
  const v = slide?.elementFontSizes?.[id];
  if (typeof v === "number" && isFinite(v) && v >= 6 && v <= 200) return Math.round(v);
  return undefined;
}

export function titleSize(text: string, layout: Slide["layout"], slide?: Slide): number {
  const explicit = explicitFontSize(slide, "title");
  if (explicit) return explicit;

  const len = (text || "").length;
  const hero = layout === "title-hero" || layout === "section" || layout === "closing";

  let base: number;
  if (hero) {
    if (len <= 20) base = 64;
    else if (len <= 40) base = 54;
    else if (len <= 70) base = 44;
    else base = 36;
  } else {
    if (len <= 25) base = 40;
    else if (len <= 45) base = 34;
    else if (len <= 70) base = 28;
    else base = 24;
  }
  return Math.round(base * tScale(slide) * elScale(slide, "title"));
}

export function subtitleSize(text: string | undefined, layout: Slide["layout"], slide?: Slide): number {
  if (!text) return 0;
  const explicit = explicitFontSize(slide, "subtitle");
  if (explicit) return explicit;
  const hero = layout === "title-hero" || layout === "section" || layout === "closing";
  return Math.round((hero ? 22 : 16) * tScale(slide) * elScale(slide, "subtitle"));
}

export function bulletSize(count: number, slide?: Slide): number {
  const explicit = explicitFontSize(slide, "bullets");
  if (explicit) return explicit;
  let base: number;
  if (count <= 3) base = 22;
  else if (count <= 4) base = 20;
  else if (count <= 5) base = 18;
  else base = 16;
  return Math.round(base * bScale(slide) * elScale(slide, "bullets"));
}

export function quoteSize(text: string, slide?: Slide): number {
  const explicit = explicitFontSize(slide, "quote");
  if (explicit) return explicit;
  const words = (text || "").split(/\s+/).length;
  let base: number;
  if (words <= 8)  base = 54;
  else if (words <= 16) base = 42;
  else if (words <= 28) base = 32;
  else base = 26;
  return Math.round(base * tScale(slide) * elScale(slide, "quote"));
}

export function bodySize(slide?: Slide): number {
  const explicit = explicitFontSize(slide, "body");
  if (explicit) return explicit;
  return Math.round(18 * bScale(slide) * elScale(slide, "body"));
}

export function tableFontSize(rows: number, cols: number, slide?: Slide): number {
  const explicit = explicitFontSize(slide, "table");
  if (explicit) return explicit;
  const denom = Math.max(rows * cols, 4);
  let base = denom <= 8 ? 18 : denom <= 14 ? 16 : 14;
  return Math.round(base * bScale(slide) * elScale(slide, "table"));
}

export function effectiveFont(themeFont: "sans" | "serif" | "mono", slide?: Slide): "sans" | "serif" | "mono" {
  return slide?.fontOverride || themeFont;
}

/** Standard PowerPoint-like font size choices. */
export const FONT_SIZE_PRESETS = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 54, 72];
