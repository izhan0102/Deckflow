import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import type { Deck, Slide, Annotation, Anchor, ElementId, ElementOffset, TableData, Reference } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import {
  titleSize, subtitleSize, bulletSize, quoteSize,
  tableFontSize, effectiveFont, isHidden,
} from "@/lib/layoutMath";

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

function addAccentBar(s: PptxGenJS.Slide, theme: Theme) {
  s.addShape("rect", {
    x: 0, y: 0, w: 0.18, h: H,
    fill: { color: hex(theme.accent) },
    line: { color: hex(theme.accent), width: 0 },
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
    s.addShape("rect", {
      x: PAD, y: 0.85, w: 0.6, h: 0.06,
      fill: { color: hex(theme.accent) }, line: { color: hex(theme.accent), width: 0 },
    });
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

async function renderTitleHero(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };

  const title = slide.title || deck.title;
  const sub = slide.subtitle || deck.subtitle || "";

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
      color: hex(theme.muted), fontFace: fontFor(theme, slide),
      align: "center", valign: "top",
    });
  }
  if (slide.notes) s.addNotes(slide.notes);
  return s;
}

async function renderBullets(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  addAccentBar(s, theme);
  addContentTitle(s, slide, theme);

  if (!isHidden(slide, "bullets")) {
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

async function renderTwoColumn(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  addAccentBar(s, theme);
  addContentTitle(s, slide, theme);

  if (!isHidden(slide, "bullets")) {
    const o = offset(slide, "bullets");
    const all = slide.bullets || [];
    const half = Math.ceil(all.length / 2);
    const colW = (W - 3 * PAD) / 2;

    const left = all.slice(0, half).map((b) => ({ text: b, options: { bullet: { code: "25CF" }, color: hex(theme.fg) } }));
    const right = all.slice(half).map((b) => ({ text: b, options: { bullet: { code: "25CF" }, color: hex(theme.fg) } }));

    s.addText(left as any, {
      x: PAD + o.dx, y: 2.6 + o.dy, w: colW, h: H - 3.4,
      fontSize: bulletSize(all.length, slide), color: hex(theme.fg),
      fontFace: fontFor(theme, slide), paraSpaceAfter: 10,
    });
    s.addText(right as any, {
      x: PAD + colW + PAD + o.dx, y: 2.6 + o.dy, w: colW, h: H - 3.4,
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
  addAccentBar(s, theme);
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

async function renderQuote(
  pptx: PptxGenJS, deck: Deck, slide: Slide, theme: Theme, idx: number, total: number,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };

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
  pptx: PptxGenJS, _deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  const overridden = !!slide.backgroundColorOverride;
  const panel = overridden ? theme.bg : theme.accent;
  const textCol = overridden ? theme.fg : theme.bg;
  s.background = { color: hex(panel) };

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
  addAccentBar(s, theme);
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
  pptx: PptxGenJS, _deck: Deck, slide: Slide, theme: Theme,
): Promise<PptxGenJS.Slide> {
  const s = pptx.addSlide();
  s.background = { color: hex(theme.bg) };
  addAccentBar(s, theme);

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
  const r = Math.round(pa.r + (pb.r - pa.r) * (1 - t));
  const g = Math.round(pa.g + (pb.g - pa.g) * (1 - t));
  const bl = Math.round(pa.b + (pb.b - pa.b) * (1 - t));
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

export async function POST(req: NextRequest) {
  try {
    const { deck, theme } = (await req.json()) as { deck: Deck; theme: Theme };
    if (!deck || !theme) {
      return NextResponse.json({ error: "Missing deck or theme." }, { status: 400 });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = deck.title;

    const total = deck.slides.length;
    for (let i = 0; i < total; i++) {
      const slide = deck.slides[i];
      const eff = effectiveTheme(theme, slide);
      let s: PptxGenJS.Slide;
      switch (slide.layout) {
        case "title-hero": s = await renderTitleHero(pptx, deck, slide, eff); break;
        case "two-column": s = await renderTwoColumn(pptx, deck, slide, eff, i, total); break;
        case "table":      s = await renderTable(pptx, deck, slide, eff, i, total); break;
        case "quote":      s = await renderQuote(pptx, deck, slide, eff, i, total); break;
        case "section":    s = await renderSection(pptx, deck, slide, eff); break;
        case "references": s = await renderReferences(pptx, deck, slide, eff, i, total); break;
        case "closing":    s = await renderClosing(pptx, deck, slide, eff); break;
        case "bullets":
        default:           s = await renderBullets(pptx, deck, slide, eff, i, total); break;
      }
      drawUploadedImages(s, slide);
      drawAnnotations(s, eff, slide);
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


function drawUploadedImages(s: PptxGenJS.Slide, slide: Slide) {
  const imgs = slide.uploadedImages || [];
  for (const img of imgs) {
    s.addImage({
      data: img.dataUrl,
      x: img.x, y: img.y, w: img.w, h: img.h,
    });
  }
}
