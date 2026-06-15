import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import type { Deck, Slide, Annotation, Anchor, ElementId, ElementOffset, TableData, Reference } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import {
  titleSize, subtitleSize, bulletSize, quoteSize,
  tableFontSize, effectiveFont, isHidden,
} from "@/lib/layoutMath";
import { getGraphic, svgToDataUri } from "@/lib/graphics";
import { getPattern, PATTERN_OPACITY } from "@/lib/patterns";
import { decorationDataUri, applyDecorationOverrides } from "@/lib/decorations";
import { iconifySvgUrl } from "@/lib/iconify";
import { stripHtml } from "@/lib/richText";
import { renderChartSvg } from "@/lib/charts";
import { rateLimitResponse } from "@/lib/rateLimit";
import { authenticateRequest } from "@/lib/firebaseAdmin";
import { getUserPlanServer } from "@/lib/planServer";
import { planShowsWatermark } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

const W = 13.333;
const H = 7.5;
const PAD = 0.6;

function hex(c: string) { return c.replace("#", ""); }

function effectiveTheme(theme: Theme, slide: Slide): Theme {
  return {
    ...theme,
    fg: slide.textColorOverride || theme.fg,
    accent: slide.accentColorOverride || theme.accent,
    bg: slide.backgroundColorOverride || theme.bg,
  };
}

function fontFor(theme: Theme, slide?: Slide): string {
  const f = effectiveFont(theme.font, slide);
  if (f === "serif") return "Georgia";
  if (f === "mono") return "Consolas";
  return "Calibri";
}

function offset(slide: Slide, id: ElementId): ElementOffset {
  return slide.elementOffsets?.[id] || { dx: 0, dy: 0 };
}

function addAccentBar(s: PptxGenJS.Slide, theme: Theme, slide?: Slide) {
  const ov = slide?.deco?.accentBar;
  if (ov?.hidden) return;
  const color = ov?.color || theme.accent;
  const scale = ov?.scale ?? 1;
  s.addShape("rect", {
    x: (ov?.dx || 0), y: (ov?.dy || 0), w: 0.18 * scale, h: H,
    fill: { color: hex(color) },
    line: { color: hex(color), width: 0 },
  });
}

function addFooter(
  s: PptxGenJS.Slide, theme: Theme, deckTitle: string, idx: number, total: number,
) {
  s.addText(deckTitle, {
    x: PAD, y: H - 0.4, w: W - 2 * PAD - 1.5, h: 0.3,
    fontSize: 9, color: hex(theme.muted), fontFace: fontFor(theme),
  });
  s.addText(`${idx + 1} / ${total}`, {
    x: W - PAD - 1.0, y: H - 0.4, w: 1.0, h: 0.3,
    fontSize: 9, color: hex(theme.muted), fontFace: fontFor(theme), align: "right",
  });
}

function addContentTitle(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  if (!isHidden(slide, "title")) {
    const o = offset(slide, "title");
    const tab = slide.deco?.titleTab;
    if (!tab?.hidden) {
      const tabColor = tab?.color || theme.accent;
      const tabScale = tab?.scale ?? 1;
      s.addShape("rect", {
        x: PAD + (tab?.dx || 0), y: 0.85 + (tab?.dy || 0), w: 0.6 * tabScale, h: 0.06,
        fill: { color: hex(tabColor) }, line: { color: hex(tabColor), width: 0 },
      });
    }
    s.addText(slide.title, {
      x: PAD + o.dx, y: 1.0 + o.dy, w: W - 2 * PAD, h: 0.9,
      fontSize: titleSize(slide.title, slide.layout, slide), bold: true,
      color: hex(theme.fg), fontFace: fontFor(theme, slide),
    });
  }
  if (slide.subtitle && !isHidden(slide, "subtitle")) {
    const o = offset(slide, "subtitle");
    s.addText(slide.subtitle, {
      x: PAD + o.dx, y: 1.85 + o.dy, w: W - 2 * PAD, h: 0.5,
      fontSize: subtitleSize(slide.subtitle, slide.layout, slide),
      color: hex(theme.muted), fontFace: fontFor(theme, slide),
    });
  }
}

/* --------------------------------- Layouts -------------------------------- */

function applyGraphicBg(s: PptxGenJS.Slide, theme: Theme, deck: Deck, slide?: Slide) {
  // Per-slide background pattern sits beneath the graphic and content.
  if (slide?.pattern?.id) {
    const pat = getPattern(slide.pattern.id);
    if (pat) {
      const color = slide.pattern.color || theme.fg;
      const op = slide.pattern.opacity ?? PATTERN_OPACITY;
      // Bake the opacity into the SVG via a wrapping group so it matches the
      // editor's low-opacity look (pptx addImage has no opacity option).
      const raw = pat.render(color).replace(/^<svg([^>]*)>/, `<svg$1><g opacity="${op}">`).replace(/<\/svg>$/, "</g></svg>");
      s.addImage({ data: svgToDataUri(raw), x: 0, y: 0, w: W, h: H });
    }
  }
  const graphic = getGraphic(deck.graphic);
  if (graphic.id === "none") return;
  const graphicTheme: Theme = deck.graphicAccent
    ? { ...theme, accent: deck.graphicAccent }
    : theme;
  const dataUri = svgToDataUri(graphic.render(graphicTheme));
  s.addImage({ data: dataUri, x: 0, y: 0, w: W, h: H });
}

async function renderTitleHero(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const variant = slide.titleVariant || "centered";
  if (variant === "asymmetric")  return renderTitleAsymmetric(pptx, deck, slide, theme);
  if (variant === "big-initial") return renderTitleBigInitial(pptx, deck, slide, theme);
  if (variant === "numbered")    return renderTitleNumbered(pptx, deck, slide, theme);
  if (variant === "underlined")  return renderTitleUnderlined(pptx, deck, slide, theme);
  if (variant === "editorial-serif") return renderTitleEditorial(pptx, deck, slide, theme);
  return renderTitleCentered(pptx, deck, slide, theme);
}

async function renderTitleCentered(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);

  const title = slide.title || deck.title;
  const sub = slide.subtitle || deck.subtitle || "";

  if (slide.kicker) {
    s.addText(slide.kicker, {
      x: PAD, y: 2.2, w: W - 2 * PAD, h: 0.4,
      fontSize: 11, bold: true, color: hex(theme.accent),
      charSpacing: 4, fontFace: fontFor(theme, slide), align: "center",
    });
  }
  if (!isHidden(slide, "title")) {
    const o = offset(slide, "title");
    s.addText(title, {
      x: PAD + o.dx, y: H / 2 - 1.0 + o.dy, w: W - 2 * PAD, h: 1.6,
      fontSize: titleSize(title, "title-hero", slide), bold: true,
      color: hex(theme.accent), fontFace: fontFor(theme, slide),
      align: "center", valign: "middle",
    });
  }
  if (sub && !isHidden(slide, "subtitle")) {
    const o = offset(slide, "subtitle");
    s.addText(sub, {
      x: PAD + o.dx, y: H / 2 + 0.6 + o.dy, w: W - 2 * PAD, h: 0.8,
      fontSize: subtitleSize(sub, "title-hero", slide),
      color: hex(theme.muted),
      fontFace: fontFor(theme, slide), align: "center", valign: "top",
    });
  }
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderTitleAsymmetric(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);

  const panelW = W * 0.42;
  s.addShape("rect", {
    x: 0, y: 0, w: panelW, h: H,
    fill: { color: hex(theme.accent) }, line: { color: hex(theme.accent), width: 0 },
  });

  const title = slide.title || deck.title;
  const sub = slide.subtitle || deck.subtitle || "";
  const textX = panelW + 0.4;
  const textW = W - textX - PAD;

  if (slide.kicker) {
    s.addText(slide.kicker, {
      x: textX, y: 0.6, w: textW, h: 0.4,
      fontSize: 10, bold: true, color: hex(theme.muted),
      charSpacing: 5, fontFace: fontFor(theme, slide),
    });
  }
  s.addText(title, {
    x: textX, y: H * 0.30, w: textW, h: 2.4,
    fontSize: titleSize(title, "title-hero", slide), bold: true,
    color: hex(theme.fg), fontFace: fontFor(theme, slide),
    valign: "top",
  });
  if (sub) {
    s.addText(sub, {
      x: textX, y: H * 0.62, w: textW, h: 1.2,
      fontSize: subtitleSize(sub, "title-hero", slide),
      color: hex(theme.muted), fontFace: fontFor(theme, slide),
      valign: "top",
    });
  }
  s.addText("EXDECK", {
    x: 0.6, y: H - 0.7, w: panelW - 1, h: 0.4,
    fontSize: 10, bold: true, color: hex(theme.bg),
    charSpacing: 5, fontFace: fontFor(theme, slide),
  });
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderTitleBigInitial(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);

  const title = slide.title || deck.title;
  const sub = slide.subtitle || deck.subtitle || "";
  const initial = (title || "D").trim().charAt(0).toUpperCase();

  s.addText(initial, {
    x: 0.4, y: -0.6, w: 7, h: 7.6,
    fontSize: 360, bold: true, color: hex(theme.accent),
    transparency: 82, fontFace: fontFor(theme, slide),
  } as any);

  if (slide.kicker) {
    s.addText(slide.kicker, {
      x: PAD, y: 2.4, w: W - 2 * PAD, h: 0.4,
      fontSize: 10, bold: true, color: hex(theme.accent),
      charSpacing: 6, fontFace: fontFor(theme, slide),
    });
  }
  s.addText(title, {
    x: PAD, y: 3.0, w: W - 2 * PAD, h: 2.0,
    fontSize: titleSize(title, "title-hero", slide), bold: true,
    color: hex(theme.fg), fontFace: fontFor(theme, slide),
    valign: "top",
  });
  if (sub) {
    s.addText(sub, {
      x: PAD, y: 5.2, w: W - 2 * PAD, h: 1.2,
      fontSize: subtitleSize(sub, "title-hero", slide),
      color: hex(theme.muted), fontFace: fontFor(theme, slide),
    });
  }
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderTitleNumbered(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);

  const title = slide.title || deck.title;
  const sub = slide.subtitle || deck.subtitle || "";
  const numMatch = (slide.kicker || "").match(/\b(20\d{2}|Q[1-4]|\d{2,4})\b/);
  const big = numMatch?.[0] || "01";
  const restKicker = (slide.kicker || "").replace(big, "").trim();

  s.addText(big, {
    x: PAD, y: 1.5, w: 6, h: 2,
    fontSize: 120, bold: true, color: hex(theme.accent),
    fontFace: fontFor(theme, slide),
  });
  if (restKicker) {
    s.addText(restKicker.toUpperCase(), {
      x: PAD, y: 3.6, w: W - 2 * PAD, h: 0.4,
      fontSize: 11, bold: true, color: hex(theme.muted),
      charSpacing: 5, fontFace: fontFor(theme, slide),
    });
  }
  s.addText(title, {
    x: PAD, y: 4.2, w: W - 2 * PAD, h: 1.6,
    fontSize: titleSize(title, "title-hero", slide), bold: true,
    color: hex(theme.fg), fontFace: fontFor(theme, slide),
  });
  if (sub) {
    s.addText(sub, {
      x: PAD, y: 6.1, w: W - 2 * PAD, h: 0.8,
      fontSize: subtitleSize(sub, "title-hero", slide),
      color: hex(theme.muted), fontFace: fontFor(theme, slide),
    });
  }
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderTitleUnderlined(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);

  const title = slide.title || deck.title;
  const sub = slide.subtitle || deck.subtitle || "";

  if (slide.kicker) {
    s.addText(slide.kicker, {
      x: PAD, y: 2.0, w: W - 2 * PAD, h: 0.4,
      fontSize: 11, bold: true, color: hex(theme.accent),
      charSpacing: 6, fontFace: fontFor(theme, slide),
    });
  }
  s.addText(title, {
    x: PAD, y: 2.6, w: W - 2 * PAD, h: 1.8,
    fontSize: titleSize(title, "title-hero", slide), bold: true,
    color: hex(theme.fg), fontFace: fontFor(theme, slide),
  });
  // Heavy accent underline
  s.addShape("rect", {
    x: PAD, y: 4.7, w: 2.5, h: 0.12,
    fill: { color: hex(theme.accent) }, line: { color: hex(theme.accent), width: 0 },
  });
  if (sub) {
    s.addText(sub, {
      x: PAD, y: 5.0, w: W * 0.7, h: 1.6,
      fontSize: subtitleSize(sub, "title-hero", slide),
      color: hex(theme.muted), fontFace: fontFor(theme, slide),
    });
  }
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderTitleEditorial(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);

  const title = slide.title || deck.title;
  const sub = slide.subtitle || deck.subtitle || "";
  const ruleX = W * 0.08;
  const ruleW = W * 0.84;

  // Top framing rule (matches the editor's editorial masthead look).
  s.addShape("rect", {
    x: ruleX, y: H * 0.2, w: ruleW, h: 0.025,
    fill: { color: hex(theme.fg), transparency: 45 }, line: { type: "none" },
  } as any);

  if (slide.kicker) {
    s.addText(slide.kicker.toUpperCase(), {
      x: ruleX, y: H * 0.24, w: ruleW, h: 0.4,
      fontSize: 11, bold: true, color: hex(theme.muted),
      charSpacing: 6, align: "center", fontFace: fontFor(theme, slide),
    });
  }

  // Large italic, centered, accent-colored serif title.
  s.addText(title, {
    x: ruleX, y: H * 0.34, w: ruleW, h: 1.8,
    fontSize: titleSize(title, "title-hero", slide), bold: true, italic: true,
    color: hex(theme.accent), fontFace: "Georgia",
    align: "center", valign: "top",
  });

  if (sub) {
    s.addText(sub, {
      x: W * 0.16, y: H * 0.62, w: W * 0.68, h: 1.2,
      fontSize: subtitleSize(sub, "title-hero", slide),
      color: hex(theme.muted), align: "center", valign: "top",
      fontFace: fontFor(theme, slide),
    });
  }

  // Bottom framing rule.
  s.addShape("rect", {
    x: ruleX, y: H * 0.8, w: ruleW, h: 0.025,
    fill: { color: hex(theme.fg), transparency: 45 }, line: { type: "none" },
  } as any);

  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderBullets(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);
  addAccentBar(s, theme, slide);
  addContentTitle(s, slide, theme);

  const variant = slide.bulletsVariant;
  if (!isHidden(slide, "bullets") && (slide.bullets || []).length > 0 &&
      (variant === "bands" || variant === "chevron" || variant === "numbered-cards" ||
       variant === "timeline" || variant === "concept-cards" || variant === "cards")) {
    if (variant === "bands")          await drawBandsPptx(s, slide, theme);
    else if (variant === "chevron")   await drawChevronPptx(s, slide, theme);
    else if (variant === "numbered-cards") await drawNumberedCardsPptx(s, slide, theme);
    else if (variant === "timeline")  await drawTimelinePptx(s, slide, theme);
    else                              await drawConceptCardsPptx(s, slide, theme); // concept-cards / cards
  } else if (!isHidden(slide, "bullets")) {
    const o = offset(slide, "bullets");
    const bullets = (slide.bullets || []).map((b) => ({
      text: b,
      options: { bullet: { code: "25CF" }, color: hex(theme.fg) },
    }));
    s.addText(bullets as any, {
      x: PAD + o.dx, y: 2.6 + o.dy, w: W - 2 * PAD, h: H - 3.4,
      fontSize: bulletSize(slide.bullets?.length || 0, slide),
      color: hex(theme.fg), fontFace: fontFor(theme, slide),
      paraSpaceAfter: 12,
    });
  }

  addFooter(s, theme, deck.title, idx, total);
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

/** Fetch a recolored Iconify SVG and inline it as a data URI for embedding. */
async function iconDataUri(iconId: string | undefined, color: string): Promise<string | null> {
  if (!iconId) return null;
  try {
    const url = iconifySvgUrl(iconId, color);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const svg = await res.text();
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
}

const CONTENT_TOP = 2.7;
const CONTENT_BOTTOM = 6.85;
const RAINBOW = ["8B5CF6", "E5645A", "2BB3A3", "E0A82E", "EC4899", "3B82F6", "10B981", "F97316"];
const CARD_PALETTE = ["F97316", "C026D3", "7C3AED", "2563EB", "E5645A", "0D9488", "DB2777", "CA8A04"];

/** Full-width stacked accent-gradient bands with number/icon + white text. */
async function drawBandsPptx(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const bullets = slide.bullets || [];
  const n = bullets.length || 1;
  const top = slide.subtitle ? 2.85 : CONTENT_TOP;
  const bandH = (CONTENT_BOTTOM - top) / n;
  const Wc = W - 2 * PAD;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? (i / (n - 1)) * 0.42 : 0;
    const color = hex(mix(theme.accent, "#ffffff", t));
    const y = top + i * bandH;
    s.addShape("rect", { x: PAD, y, w: Wc, h: bandH - 0.07, fill: { color }, line: { type: "none" } } as any);
    const bs = Math.min(0.42, bandH - 0.4);
    const by = y + (bandH - 0.07 - bs) / 2;
    const icon = await iconDataUri(slide.bulletIcons?.[i], "FFFFFF");
    if (icon) {
      s.addImage({ data: icon, x: PAD + 0.22, y: by, w: bs, h: bs });
    } else {
      s.addShape("roundRect", { x: PAD + 0.22, y: by, w: bs, h: bs, rectRadius: 0.08, fill: { color: "FFFFFF", transparency: 78 }, line: { type: "none" } } as any);
      s.addText(String(i + 1).padStart(2, "0"), { x: PAD + 0.22, y: by, w: bs, h: bs, align: "center", valign: "middle", fontSize: 12, bold: true, color: "FFFFFF" });
    }
    s.addText(bullets[i], {
      x: PAD + 0.9, y, w: Wc - 1.2, h: bandH - 0.07, valign: "middle",
      fontSize: Math.max(11, bulletSize(n, slide) - 1), bold: true, color: "FFFFFF", fontFace: fontFor(theme, slide),
    });
  }
}

/** Horizontal chevron arrows for a short ordered process. */
async function drawChevronPptx(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const bullets = slide.bullets || [];
  const n = bullets.length || 1;
  const top = slide.subtitle ? 3.3 : 2.9;
  const h = 1.9;
  const Wc = W - 2 * PAD;
  const cw = Wc / n;
  for (let i = 0; i < n; i++) {
    const color = hex(mix(theme.accent, "#ffffff", n > 1 ? (i / (n - 1)) * 0.4 : 0));
    const x = PAD + i * cw;
    s.addShape("chevron", { x, y: top, w: cw - 0.04, h, fill: { color }, line: { type: "none" } } as any);
    const inset = i === 0 ? 0.2 : 0.5;
    const icon = await iconDataUri(slide.bulletIcons?.[i], "FFFFFF");
    if (icon) s.addImage({ data: icon, x: x + cw / 2 - 0.18, y: top + 0.25, w: 0.36, h: 0.36 });
    s.addText([
      { text: `STEP ${i + 1}`, options: { fontSize: 9, bold: true, charSpacing: 2, color: "FFFFFF", breakLine: true } },
      { text: bullets[i], options: { fontSize: 11, bold: true, color: "FFFFFF" } },
    ] as any, { x: x + inset, y: top + (icon ? 0.65 : 0.2), w: cw - inset - 0.35, h: h - (icon ? 0.85 : 0.4), align: "center", valign: "middle", fontFace: fontFor(theme, slide) });
  }
}

/** Row of solid colored cards with a big numeral + white text. */
async function drawNumberedCardsPptx(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const bullets = slide.bullets || [];
  const n = bullets.length || 1;
  const top = slide.subtitle ? 3.2 : 2.9;
  const h = 2.4;
  const gap = 0.22;
  const Wc = W - 2 * PAD;
  const cw = Math.min(2.4, (Wc - (n - 1) * gap) / n);
  const totalW = cw * n + gap * (n - 1);
  const startX = (W - totalW) / 2;
  for (let i = 0; i < n; i++) {
    const color = CARD_PALETTE[i % CARD_PALETTE.length];
    const x = startX + i * (cw + gap);
    s.addShape("roundRect", { x, y: top, w: cw, h, rectRadius: 0.14, fill: { color }, line: { type: "none" } } as any);
    s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.18, y: top + 0.14, w: cw - 0.36, h: 0.7, fontSize: 30, bold: true, color: "FFFFFF", transparency: 55, fontFace: fontFor(theme, slide) } as any);
    const icon = await iconDataUri(slide.bulletIcons?.[i], "FFFFFF");
    if (icon) s.addImage({ data: icon, x: x + cw - 0.5, y: top + 0.2, w: 0.32, h: 0.32 });
    s.addText(bullets[i], { x: x + 0.18, y: top + 0.85, w: cw - 0.36, h: h - 1.0, fontSize: 11, bold: true, color: "FFFFFF", valign: "top", fontFace: fontFor(theme, slide) });
  }
}

/** Vertical timeline: numbered/icon nodes on a connecting line + title/detail. */
async function drawTimelinePptx(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const bullets = slide.bullets || [];
  const n = bullets.length || 1;
  const top = slide.subtitle ? 2.9 : CONTENT_TOP;
  const rowH = (CONTENT_BOTTOM - top) / n;
  const node = 0.46;
  const nodeX = PAD + 0.1;
  for (let i = 0; i < n; i++) {
    const y = top + i * rowH;
    const color = hex(mix(theme.accent, "#ffffff", n > 1 ? (i / (n - 1)) * 0.38 : 0));
    // Connecting line to the next node.
    if (i < n - 1) {
      s.addShape("line", { x: nodeX + node / 2 - 0.01, y: y + node, w: 0, h: rowH - node, line: { color: hex(theme.fg), width: 1.5, transparency: 80 } } as any);
    }
    s.addShape("ellipse", { x: nodeX, y, w: node, h: node, fill: { color }, line: { type: "none" } } as any);
    const icon = await iconDataUri(slide.bulletIcons?.[i], "FFFFFF");
    if (icon) s.addImage({ data: icon, x: nodeX + 0.1, y: y + 0.1, w: node - 0.2, h: node - 0.2 });
    else s.addText(String(i + 1), { x: nodeX, y, w: node, h: node, align: "center", valign: "middle", fontSize: 13, bold: true, color: "FFFFFF" });
    const m = bullets[i].match(/^(.{2,42}?)\s*[—–-]\s+(.*)$/);
    const titleText = m ? m[1] : bullets[i];
    const detailText = m ? m[2] : "";
    const tx = nodeX + node + 0.3;
    const tw = W - tx - PAD;
    s.addText(titleText, { x: tx, y: y - 0.04, w: tw, h: 0.4, fontSize: 14, bold: true, color: hex(theme.fg), valign: "top", fontFace: fontFor(theme, slide) });
    if (detailText) s.addText(detailText, { x: tx, y: y + 0.36, w: tw, h: rowH - 0.4, fontSize: 11, color: hex(theme.fg), transparency: 22, valign: "top", fontFace: fontFor(theme, slide) } as any);
  }
}

/** Colorful numbered cards (concept / cards) as full-width rounded rows. */
async function drawConceptCardsPptx(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const bullets = slide.bullets || [];
  const n = bullets.length || 1;
  const top = CONTENT_TOP;
  const gap = 0.16;
  const rowH = (CONTENT_BOTTOM - top - (n - 1) * gap) / n;
  const Wc = W - 2 * PAD;
  const badge = Math.min(0.5, rowH - 0.2);
  for (let i = 0; i < n; i++) {
    const color = RAINBOW[i % RAINBOW.length];
    const y = top + i * (rowH + gap);
    s.addShape("roundRect", { x: PAD, y, w: Wc, h: rowH, rectRadius: 0.1, fill: { color, transparency: 86 }, line: { type: "none" } } as any);
    const by = y + (rowH - badge) / 2;
    s.addShape("ellipse", { x: PAD + 0.2, y: by, w: badge, h: badge, fill: { color }, line: { type: "none" } } as any);
    const icon = await iconDataUri(slide.bulletIcons?.[i], "FFFFFF");
    if (icon) s.addImage({ data: icon, x: PAD + 0.2 + badge * 0.22, y: by + badge * 0.22, w: badge * 0.56, h: badge * 0.56 });
    else s.addText(String(i + 1).padStart(2, "0"), { x: PAD + 0.2, y: by, w: badge, h: badge, align: "center", valign: "middle", fontSize: 13, bold: true, color: "FFFFFF" });
    s.addText(bullets[i], { x: PAD + 0.2 + badge + 0.25, y, w: Wc - badge - 0.7, h: rowH, valign: "middle", fontSize: Math.max(11, bulletSize(n, slide) - 1), color: hex(theme.fg), fontFace: fontFor(theme, slide) });
  }
}

async function renderTwoColumn(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);
  addAccentBar(s, theme, slide);
  addContentTitle(s, slide, theme);

  if (!isHidden(slide, "bullets")) {
    const o = offset(slide, "bullets");
    const all = slide.bullets || [];
    const half = Math.ceil(all.length / 2);
    const colW = (W - 3 * PAD) / 2;
    const labels = slide.columnLabels;
    const headerH = labels ? 0.5 : 0;
    const listY = 2.6 + headerH;

    if (labels) {
      s.addText(labels.left.toUpperCase(), {
        x: PAD + o.dx, y: 2.55 + o.dy, w: colW, h: 0.4,
        fontSize: 12, bold: true, color: hex(theme.accent),
        charSpacing: 2, fontFace: fontFor(theme, slide), align: "center",
        fill: { color: hex(mix(theme.accent, theme.bg, 0.12)) },
      });
      s.addText(labels.right.toUpperCase(), {
        x: PAD + colW + PAD + o.dx, y: 2.55 + o.dy, w: colW, h: 0.4,
        fontSize: 12, bold: true, color: hex(theme.accent),
        charSpacing: 2, fontFace: fontFor(theme, slide), align: "center",
        fill: { color: hex(mix(theme.accent, theme.bg, 0.12)) },
      });
    }

    const left = all.slice(0, half).map((b) => ({ text: b, options: { bullet: { code: "25CF" }, color: hex(theme.fg) } }));
    const right = all.slice(half).map((b) => ({ text: b, options: { bullet: { code: "25CF" }, color: hex(theme.fg) } }));

    s.addText(left as any, {
      x: PAD + o.dx, y: listY + o.dy, w: colW, h: H - 3.4 - headerH,
      fontSize: bulletSize(all.length, slide), color: hex(theme.fg),
      fontFace: fontFor(theme, slide), paraSpaceAfter: 10,
    });
    s.addText(right as any, {
      x: PAD + colW + PAD + o.dx, y: listY + o.dy, w: colW, h: H - 3.4 - headerH,
      fontSize: bulletSize(all.length, slide), color: hex(theme.fg),
      fontFace: fontFor(theme, slide), paraSpaceAfter: 10,
    });
  }

  addFooter(s, theme, deck.title, idx, total);
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderTable(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);
  addAccentBar(s, theme, slide);
  addContentTitle(s, slide, theme);

  if (!isHidden(slide, "table") && slide.table) {
    const t: TableData = slide.table;
    const o = offset(slide, "table");
    const fontSize = tableFontSize(t.rows.length, t.headers.length, slide);
    const fontFace = fontFor(theme, slide);

    const header = t.headers.map((h) => ({
      text: h,
      options: {
        bold: true, color: hex(theme.accent), fontFace, fontSize,
        align: "left" as const, valign: "middle" as const,
        fill: { color: hex(theme.bg) },
        border: [
          { type: "none" as const }, { type: "none" as const },
          { type: "solid" as const, pt: 1, color: hex(theme.accent) },
          { type: "none" as const },
        ],
        margin: 0.06,
      },
    }));

    const rows = t.rows.map((row, ri) => row.map((c) => ({
      text: c,
      options: {
        color: hex(theme.fg), fontFace, fontSize,
        align: "left" as const, valign: "middle" as const,
        fill: { color: hex(ri % 2 === 1 ? mix(theme.accent, theme.bg, 0.06) : theme.bg) },
        border: [
          { type: "none" as const }, { type: "none" as const },
          { type: "solid" as const, pt: 0.5, color: hex(theme.muted) },
          { type: "none" as const },
        ],
        margin: 0.06,
      },
    })));

    s.addTable([header, ...rows] as any, {
      x: PAD + o.dx, y: 2.7 + o.dy,
      w: W - 2 * PAD,
      colW: Array(t.headers.length).fill((W - 2 * PAD) / t.headers.length),
    } as any);

    if (t.source) {
      s.addText(`Source: ${t.source}`, {
        x: PAD + o.dx, y: H - 0.95 + o.dy, w: W - 2 * PAD, h: 0.3,
        fontSize: 10, italic: true,
        color: hex(theme.muted), fontFace,
      });
    }
  }

  addFooter(s, theme, deck.title, idx, total);
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderChart(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);
  addAccentBar(s, theme, slide);
  addContentTitle(s, slide, theme);

  if (!isHidden(slide, "chart") && slide.chart) {
    const o = offset(slide, "chart");
    const svg = renderChartSvg(slide.chart, theme);
    const data = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    // Chart SVG is authored on a 480x300 (1.6:1) viewBox. Fit it inside the
    // content area below the title, centered, scaled by chartScale.
    const scale = typeof slide.chartScale === "number"
      ? Math.max(0.6, Math.min(1.6, slide.chartScale)) : 1;
    const maxW = 9.2, maxH = 4.4;
    const cw = maxW * scale;
    const ch = maxH * scale;
    const cx = (W - cw) / 2;
    const cy = 2.6 + (maxH - ch) / 2; // keep vertically centered in the band
    s.addImage({ data, x: cx + o.dx, y: cy + o.dy, w: cw, h: ch });
  }

  addFooter(s, theme, deck.title, idx, total);
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderQuote(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);

  s.addText("\u201C", {
    x: PAD, y: 0.6, w: 2.0, h: 2.0,
    fontSize: 220, bold: true,
    color: hex(theme.accent), fontFace: fontFor(theme, slide),
  });

  if (!isHidden(slide, "quote")) {
    const o = offset(slide, "quote");
    const quote = slide.body || slide.title;
    s.addText(quote, {
      x: 1.6 + o.dx, y: 2.0 + o.dy, w: W - 3.2, h: 3.2,
      fontSize: quoteSize(quote, slide), italic: true, bold: true,
      color: hex(theme.fg), fontFace: fontFor(theme, slide),
      align: "left", valign: "middle",
    });
    if (slide.subtitle) {
      s.addText(`\u2014 ${slide.subtitle}`, {
        x: 1.6 + o.dx, y: H - 1.5 + o.dy, w: W - 3.2, h: 0.5,
        fontSize: 16, color: hex(theme.muted),
        fontFace: fontFor(theme, slide),
      });
    }
  }

  addFooter(s, theme, deck.title, idx, total);
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderSection(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  const overridden = !!slide.backgroundColorOverride;
  const panel = overridden ? theme.bg : theme.accent;
  const textCol = overridden ? theme.fg : theme.bg;
  s.background = { color: hex(panel) };
  applyGraphicBg(s, theme, deck, slide);

  if (!isHidden(slide, "title")) {
    const o = offset(slide, "title");
    s.addText(slide.title, {
      x: PAD + o.dx, y: H / 2 - 0.9 + o.dy, w: W - 2 * PAD, h: 1.4,
      fontSize: titleSize(slide.title, "section", slide), bold: true,
      color: hex(textCol), fontFace: fontFor(theme, slide),
      align: "center", valign: "middle",
    });
  }
  if (slide.body && !isHidden(slide, "body")) {
    const o = offset(slide, "body");
    s.addText(slide.body, {
      x: PAD + o.dx, y: H / 2 + 0.6 + o.dy, w: W - 2 * PAD, h: 0.8,
      fontSize: 18, color: hex(textCol),
      fontFace: fontFor(theme, slide), align: "center",
    });
  }
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderReferences(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);
  addAccentBar(s, theme, slide);
  addContentTitle(s, { ...slide, title: slide.title || "References" }, theme);

  const refs: Reference[] = deck.references || [];
  if (!isHidden(slide, "bullets") && refs.length > 0) {
    const o = offset(slide, "bullets");
    const items = refs.map((r, i) => ({
      text: `${i + 1}. ${r.text}${r.url ? "  —  " + r.url : ""}`,
      options: { color: hex(theme.fg) },
    }));
    s.addText(items as any, {
      x: PAD + o.dx, y: 2.6 + o.dy, w: W - 2 * PAD, h: H - 3.4,
      fontSize: refs.length > 6 ? 12 : 14,
      color: hex(theme.fg), fontFace: fontFor(theme, slide),
      paraSpaceAfter: 8,
    });
  }

  addFooter(s, theme, deck.title, idx, total);
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderClosing(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  applyGraphicBg(s, theme, deck, slide);
  addAccentBar(s, theme, slide);

  if (!isHidden(slide, "title")) {
    const o = offset(slide, "title");
    s.addText(slide.title || "Thank you", {
      x: PAD + o.dx, y: H / 2 - 0.9 + o.dy, w: W - 2 * PAD, h: 1.6,
      fontSize: titleSize(slide.title || "Thank you", "closing", slide), bold: true,
      color: hex(theme.accent),
      fontFace: fontFor(theme, slide), align: "center", valign: "middle",
    });
  }
  if (slide.subtitle && !isHidden(slide, "subtitle")) {
    const o = offset(slide, "subtitle");
    s.addText(slide.subtitle, {
      x: PAD + o.dx, y: H / 2 + 0.7 + o.dy, w: W - 2 * PAD, h: 0.6,
      fontSize: 18, color: hex(theme.muted),
      fontFace: fontFor(theme, slide), align: "center",
    });
  }
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

/* ----------------------------- Annotation rendering ---------------------------- */

function annotationPosition(anchor: Anchor, height: number, width: number) {
  const pad = 0.45;
  let x = pad, y = pad;
  let align: "left" | "center" | "right" = "left";

  const [v, h] = anchor.split("-");
  if (v === "top")    y = pad;
  if (v === "middle") y = (H - height) / 2;
  if (v === "bottom") y = H - pad - height;

  if (h === "left")   { x = pad;             align = "left"; }
  if (h === "center") { x = (W - width) / 2; align = "center"; }
  if (h === "right")  { x = W - pad - width; align = "right"; }

  return { x, y, align };
}

function drawAnnotations(s: PptxGenJS.Slide, theme: Theme, slide: Slide) {
  const list = slide.annotations || [];
  if (list.length === 0) return;

  const groups = new Map<string, Annotation[]>();
  for (const a of list) {
    const arr = groups.get(a.anchor) || [];
    arr.push(a);
    groups.set(a.anchor, arr);
  }

  for (const [anchor, items] of groups) {
    const blockW = 6.0;
    const lineH = 0.35;
    const totalH = items.length * lineH;
    const pos = annotationPosition(anchor as Anchor, totalH, blockW);
    let yOffset = 0;
    for (const a of items) {
      const colorHex = (a.color || theme.fg).replace("#", "");
      s.addText(a.text, {
        x: pos.x, y: pos.y + yOffset, w: blockW, h: lineH,
        fontSize: a.fontSize ?? 12, color: colorHex,
        bold: !!a.bold, italic: !!a.italic,
        align: a.align || pos.align, valign: "top",
        fontFace: fontFor(theme, slide),
      });
      yOffset += lineH;
    }
  }
}

/* ------------------------------ Color helper ------------------------------ */
function mix(a: string, b: string, t: number): string {
  // simple hex blend
  const pa = parseHex(a), pb = parseHex(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function parseHex(s: string) {
  const c = s.replace("#", "");
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

/* ----------------------------------- POST ---------------------------------- */

/** Bold "Made with EXdeck" badge baked into the bottom-right of free-plan
 *  exports. Drawn as a filled rounded shape with text on top. */
function drawWatermark(s: PptxGenJS.Slide) {
  const wmW = 2.45, wmH = 0.4;
  const x = W - wmW - 0.3, y = H - wmH - 0.3;
  s.addShape("roundRect", {
    x, y, w: wmW, h: wmH,
    rectRadius: 0.2,
    fill: { color: "000000", transparency: 35 },
    line: { type: "none" },
  } as any);
  s.addText("\u2726 Made with EXdeck", {
    x, y, w: wmW, h: wmH,
    align: "center", valign: "middle",
    fontSize: 11, bold: true, color: "FFFFFF",
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("export");
  if (limited) return limited;
  try {
    // Resolve the user's plan (optional auth). Free plans get a watermark
    // baked into every slide; paid plans export clean.
    let showWatermark = true;
    try {
      const uid = await authenticateRequest(req);
      showWatermark = planShowsWatermark(await getUserPlanServer(uid));
    } catch {
      // No/invalid token — treat as free (watermarked).
      showWatermark = true;
    }

    const { deck, theme } = (await req.json()) as { deck: Deck; theme: Theme };
    if (!deck || !theme) {
      return NextResponse.json({ error: "Missing deck or theme." }, { status: 400 });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = deck.title;

    const total = deck.slides.length;
    const graphic = getGraphic(deck.graphic);
    for (let i = 0; i < total; i++) {
      // Strip inline HTML before handing to pptxgenjs. Long-term we
      // could parse the rich-text spans into pptx text-runs; for now
      // export is plain text so the slide doesn't ship literal "<b>" tags.
      const raw = deck.slides[i];
      const slide: Slide = {
        ...raw,
        title:    stripHtml(raw.title || ""),
        subtitle: raw.subtitle != null ? stripHtml(raw.subtitle) : raw.subtitle,
        body:     raw.body     != null ? stripHtml(raw.body)     : raw.body,
        kicker:   raw.kicker   != null ? stripHtml(raw.kicker)   : raw.kicker,
        bullets:  raw.bullets  ? raw.bullets.map((b) => stripHtml(b || "")) : raw.bullets,
        annotations: raw.annotations
          ? raw.annotations.map((a) => ({ ...a, text: stripHtml(a.text || "") }))
          : raw.annotations,
      };
      const eff = effectiveTheme(theme, slide);
      let s: PptxGenJS.Slide;
      switch (slide.layout) {
        case "title-hero": s = await renderTitleHero(pptx, deck, slide, eff); break;
        case "two-column": s = await renderTwoColumn(pptx, deck, slide, eff, i, total); break;
        case "table":      s = await renderTable(pptx, deck, slide, eff, i, total); break;
        case "chart":      s = await renderChart(pptx, deck, slide, eff, i, total); break;
        case "quote":      s = await renderQuote(pptx, deck, slide, eff, i, total); break;
        case "section":    s = await renderSection(pptx, deck, slide, eff); break;
        case "references": s = await renderReferences(pptx, deck, slide, eff, i, total); break;
        case "closing":    s = await renderClosing(pptx, deck, slide, eff); break;
        case "bullets":
        default:           s = await renderBullets(pptx, deck, slide, eff, i, total); break;
      }
      // Apply graphic LAST so the image sits at the highest z-order, but mark
      // as background so it doesn't cover content. pptxgenjs has no
      // "send-to-back" so we apply via background image fallback below.
      await drawUploadedImages(s, slide, eff);
      drawAnnotations(s, eff, slide);
      drawTextBoxes(s, raw, eff);
      if (showWatermark) drawWatermark(s);
    }

    const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    const body = new Uint8Array(buf);
    const safe = (deck.title || "deck").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${safe}.pptx"`,
      },
    });
  } catch (err: any) {
    console.error("[/api/export] error:", err);
    return NextResponse.json({ error: err?.message || "Export failed." }, { status: 500 });
  }
}


/**
 * Render user-added free text boxes. Position/size are in slide inches,
 * matching the editor's coordinate space. Inline HTML is stripped to plain
 * text; whole-element style (size/bold/italic/underline/color) is read off
 * the box fields plus the wrapping span the sidebar may have written.
 */
function drawTextBoxes(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const boxes = slide.textBoxes || [];
  for (const tb of boxes) {
    const text = stripHtml(tb.text || "");
    if (!text.trim()) continue;
    s.addText(text, {
      x: tb.x, y: tb.y, w: tb.w, h: 1,
      valign: "top",
      align: tb.align || "left",
      fontSize: tb.fontSize || 18,
      bold: !!tb.bold,
      italic: !!tb.italic,
      underline: tb.underline ? { style: "sng" } : undefined,
      color: hex(tb.color || theme.fg),
      fontFace: fontFaceForFontId(tb.fontId) || fontFor(theme, slide),
    });
  }
}

/** Map a font preset id to a PowerPoint-safe font face name. */
function fontFaceForFontId(id?: string): string | undefined {
  if (!id) return undefined;
  // The preset id is a slug; the human name is the actual font family.
  const map: Record<string, string> = {
    inter: "Inter", manrope: "Manrope", "dm-sans": "DM Sans", "work-sans": "Work Sans",
    "plus-jakarta": "Plus Jakarta Sans", outfit: "Outfit", "space-grotesk": "Space Grotesk",
    "ibm-plex-sans": "IBM Plex Sans", figtree: "Figtree", playfair: "Playfair Display",
    lora: "Lora", merriweather: "Merriweather", fraunces: "Fraunces", "source-serif": "Source Serif Pro",
    bricolage: "Bricolage Grotesque", syne: "Syne", archivo: "Archivo", jetbrains: "JetBrains Mono",
    roboto: "Roboto", "open-sans": "Open Sans", lato: "Lato", montserrat: "Montserrat",
    poppins: "Poppins", raleway: "Raleway", nunito: "Nunito", "pt-sans": "PT Sans",
    oswald: "Oswald", "roboto-slab": "Roboto Slab",
  };
  return map[id];
}

async function drawUploadedImages(s: PptxGenJS.Slide, slide: Slide, theme: Theme) {
  const imgs = slide.uploadedImages || [];
  for (const img of imgs) {
    let data: string;
    if (img.kind === "decoration" && img.decorationId) {
      const eff = applyDecorationOverrides(theme, img.colorOverrides);
      data = decorationDataUri(img.decorationId, eff);
    } else if (img.kind === "icon" && img.iconId) {
      // Pull the recolored SVG from Iconify and embed as data URI.
      const color = img.colorOverrides?.accent || theme.accent;
      try {
        const url = iconifySvgUrl(img.iconId, color);
        const res = await fetch(url);
        if (!res.ok) continue;
        const svg = await res.text();
        data = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      } catch {
        continue;
      }
    } else {
      data = img.dataUrl;
    }
    if (!data) continue;
    // Uploaded photos are base64 data: URIs (pass straight through). Stock
    // photos (AI-placed or added from the image search) are remote URLs —
    // fetch and inline them as a data URI so pptxgenjs embeds them reliably.
    if (/^https?:\/\//i.test(data)) {
      try {
        const res = await fetch(data);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get("content-type") || "image/jpeg";
        data = `data:${ct};base64,${buf.toString("base64")}`;
      } catch {
        continue;
      }
    }
    s.addImage({ data, x: img.x, y: img.y, w: img.w, h: img.h });
  }
}


