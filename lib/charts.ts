/**
 * Data-driven chart rendering as pure SVG.
 *
 * Why SVG and not HTML/Canvas/Chart.js?
 *   - It renders identically in all three of our output targets:
 *       1. On screen  -> <img src={dataUri}>
 *       2. PDF export -> html2canvas captures the <img>
 *       3. PPTX export -> pptxgenjs addImage(dataUri)
 *     An HTML/JS chart library would only work on screen + PDF, never in
 *     the PowerPoint file.
 *   - It's deterministic: same spec + theme always produces the same
 *     bytes, so exports are reproducible.
 *
 * The AI emits a ChartSpec (type + labelled data points, optional colors).
 * We turn it into an SVG string, then a data URI.
 */

import type { Theme } from "./themes";

export type ChartType = "bar" | "line" | "area" | "pie" | "donut";

export type ChartDatum = {
  label: string;
  value: number;
  /** Optional explicit hex (e.g. "#DC2626"). Falls back to a theme palette. */
  color?: string;
};

export type ChartSpec = {
  type: ChartType;
  data: ChartDatum[];
  /** Optional caption shown above the plot. */
  title?: string;
  /** Optional unit suffix appended to value labels, e.g. "%", "M", "k". */
  unit?: string;
  /** Honest one-line basis/source caption shown under the chart, e.g.
   *  "World Bank · through 2021 · 2022–25 projected". */
  note?: string;
  /** Data provenance: actual (known facts), estimated (illustrative
   *  placeholders), projected (forecast beyond knowledge), or mixed. */
  dataQuality?: "actual" | "estimated" | "projected" | "mixed";
};

const VW = 480;
const VH = 300;

/* ------------------------------ color utils ------------------------------ */

function parseHex(s: string): { r: number; g: number; b: number } {
  const c = (s || "#000000").replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}
function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
/** Blend a toward b by t (0..1). t=0 -> a, t=1 -> b. */
function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a), pb = parseHex(b);
  return toHex({
    r: pa.r + (pb.r - pa.r) * t,
    g: pa.g + (pb.g - pa.g) * t,
    b: pa.b + (pb.b - pa.b) * t,
  });
}
function alpha(hex: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
  return `${hex}${v}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360 / 360;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return toHex({ r: r * 255, g: g * 255, b: b * 255 });
}

/**
 * Build a palette of n visually distinct, VISIBLE colors derived from the
 * theme accent. We rotate the hue around the color wheel and keep
 * saturation and lightness clamped to a band that stays legible on the
 * slide background (whether the bg is dark or light). This guarantees the
 * series are theme-relevant (anchored on the accent hue) but never muddy
 * or low-contrast — the problem with the old mix()-based palette.
 */
function palette(theme: Theme, n: number): string[] {
  const a = parseHex(theme.accent);
  const [h0, s0] = rgbToHsl(a.r, a.g, a.b);
  const bg = parseHex(theme.bg);
  const [, , bgL] = rgbToHsl(bg.r, bg.g, bg.b);
  const darkBg = bgL < 0.5;

  // Saturation kept high enough to read; lightness tuned to contrast the bg.
  const sat = Math.min(0.78, Math.max(0.55, s0 || 0.65));
  const light = darkBg ? 0.62 : 0.46;

  // Spread hues across the wheel starting from the accent hue. For small n
  // we take wider steps so colors stay distinct.
  const step = n <= 2 ? 150 : n <= 4 ? 95 : 360 / n;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const h = h0 + step * i;
    // Alternate lightness slightly so adjacent slices/bars separate.
    const l = light + (i % 2 === 0 ? 0 : darkBg ? -0.1 : 0.08);
    out.push(hslToHex(h, sat, l));
  }
  return out;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Trim a label so it doesn't overflow its slot. */
function clip(s: string, max: number): string {
  const t = (s || "").trim();
  return t.length > max ? t.slice(0, max - 1) + "\u2026" : t;
}

function fmt(v: number, unit?: string): string {
  let s: string;
  if (Math.abs(v) >= 1000) s = (Math.round(v / 100) / 10).toString() + "k";
  else s = (Math.round(v * 10) / 10).toString();
  return unit ? `${s}${esc(unit)}` : s;
}

/* ------------------------------ normalization ----------------------------- */

function normalize(spec: ChartSpec): ChartSpec {
  const data = (Array.isArray(spec.data) ? spec.data : [])
    .map((d) => ({
      label: typeof d?.label === "string" ? d.label : "",
      value: Number.isFinite(d?.value) ? Number(d.value) : 0,
      color: typeof d?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : undefined,
    }))
    .slice(0, 8); // cap so charts never get unreadable
  return { ...spec, data };
}

/* -------------------------------- renderers ------------------------------- */

function svgWrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">${inner}</svg>`;
}

function titleBlock(spec: ChartSpec, theme: Theme): { svg: string; top: number } {
  if (!spec.title) return { svg: "", top: 18 };
  const svg = `<text x="${VW / 2}" y="26" text-anchor="middle" font-size="20" font-weight="700" fill="${theme.fg}">${esc(clip(spec.title, 46))}</text>`;
  return { svg, top: 50 };
}

/** Honest provenance/source caption rendered at the very bottom. */
function noteBlock(spec: ChartSpec, theme: Theme): string {
  if (!spec.note) return "";
  return `<text x="${VW / 2}" y="${VH - 6}" text-anchor="middle" font-size="11" fill="${alpha(theme.fg, 0.5)}">${esc(clip(spec.note, 78))}</text>`;
}

function renderBarOrLine(spec: ChartSpec, theme: Theme, mode: "bar" | "line" | "area"): string {
  const { data } = spec;
  const cols = palette(theme, data.length);
  const { svg: tSvg, top } = titleBlock(spec, theme);

  const left = 54, right = 24, bottom = 52;
  const plotW = VW - left - right;
  const plotH = VH - top - bottom;
  const baseY = top + plotH;
  const maxV = Math.max(1, ...data.map((d) => d.value));
  const niceMax = maxV * 1.1;

  // gridlines + y labels (3 ticks)
  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const y = top + (plotH * i) / 3;
    const val = niceMax * (1 - i / 3);
    grid += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${left + plotW}" y2="${y.toFixed(1)}" stroke="${alpha(theme.fg, 0.14)}" stroke-width="1"/>`;
    grid += `<text x="${left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="13" fill="${alpha(theme.fg, 0.6)}">${fmt(val, spec.unit)}</text>`;
  }

  const n = data.length || 1;
  const slot = plotW / n;

  let body = "";
  let labels = "";

  if (mode === "bar") {
    const bw = Math.min(slot * 0.62, 64);
    data.forEach((d, i) => {
      const h = (d.value / niceMax) * plotH;
      const x = left + slot * i + (slot - bw) / 2;
      const y = baseY - h;
      const c = d.color || cols[i];
      body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="4" fill="${c}"/>`;
      body += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="${theme.fg}">${fmt(d.value, spec.unit)}</text>`;
      labels += `<text x="${(left + slot * i + slot / 2).toFixed(1)}" y="${(baseY + 20).toFixed(1)}" text-anchor="middle" font-size="13" fill="${alpha(theme.fg, 0.75)}">${esc(clip(d.label, 11))}</text>`;
    });
  } else {
    // line / area
    const pts = data.map((d, i) => {
      const x = left + slot * i + slot / 2;
      const y = baseY - (d.value / niceMax) * plotH;
      return [x, y] as [number, number];
    });
    const poly = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    if (mode === "area") {
      const area = `${left + slot / 2},${baseY} ${poly} ${left + slot * (n - 1) + slot / 2},${baseY}`;
      body += `<polygon points="${area}" fill="${alpha(theme.accent, 0.22)}"/>`;
    }
    body += `<polyline points="${poly}" fill="none" stroke="${theme.accent}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach(([x, y], i) => {
      body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${data[i].color || theme.accent}"/>`;
      body += `<text x="${x.toFixed(1)}" y="${(y - 11).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${theme.fg}">${fmt(data[i].value, spec.unit)}</text>`;
      labels += `<text x="${x.toFixed(1)}" y="${(baseY + 20).toFixed(1)}" text-anchor="middle" font-size="13" fill="${alpha(theme.fg, 0.75)}">${esc(clip(data[i].label, 11))}</text>`;
    });
  }

  const axis = `<line x1="${left}" y1="${baseY}" x2="${left + plotW}" y2="${baseY}" stroke="${alpha(theme.fg, 0.4)}" stroke-width="1.5"/>`;
  return svgWrap(tSvg + grid + axis + body + labels + noteBlock(spec, theme));
}

function renderPieOrDonut(spec: ChartSpec, theme: Theme, mode: "pie" | "donut"): string {
  const { data } = spec;
  const cols = palette(theme, data.length);
  const { svg: tSvg, top } = titleBlock(spec, theme);

  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
  const cx = 150, cy = top + (VH - top) / 2 - 4;
  const r = Math.min(112, (VH - top) / 2 - 14);
  const rIn = mode === "donut" ? r * 0.56 : 0;

  let acc = 0;
  let segs = "";
  data.forEach((d, i) => {
    const frac = Math.max(0, d.value) / total;
    const a1 = acc * Math.PI * 2 - Math.PI / 2;
    const a2 = (acc + frac) * Math.PI * 2 - Math.PI / 2;
    acc += frac;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const c = d.color || cols[i];
    if (mode === "donut") {
      const xi1 = cx + rIn * Math.cos(a1), yi1 = cy + rIn * Math.sin(a1);
      const xi2 = cx + rIn * Math.cos(a2), yi2 = cy + rIn * Math.sin(a2);
      segs += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${xi2.toFixed(1)} ${yi2.toFixed(1)} A ${rIn} ${rIn} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)} Z" fill="${c}"/>`;
    } else {
      segs += `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${c}"/>`;
    }
  });

  // legend on the right
  let legend = "";
  const lx = 300;
  const lh = 26;
  const startY = cy - (data.length * lh) / 2 + 8;
  data.forEach((d, i) => {
    const y = startY + i * lh;
    const pct = Math.round((Math.max(0, d.value) / total) * 100);
    legend += `<rect x="${lx}" y="${(y - 11).toFixed(1)}" width="14" height="14" rx="3" fill="${d.color || cols[i]}"/>`;
    legend += `<text x="${lx + 22}" y="${y.toFixed(1)}" font-size="14" fill="${theme.fg}">${esc(clip(d.label, 14))} <tspan fill="${alpha(theme.fg, 0.6)}" font-weight="700">${pct}%</tspan></text>`;
  });

  return svgWrap(tSvg + segs + legend + noteBlock(spec, theme));
}

/* -------------------------------- public API ------------------------------ */

export function renderChartSvg(spec: ChartSpec, theme: Theme): string {
  const s = normalize(spec);
  if (s.data.length === 0) {
    return svgWrap(`<text x="${VW / 2}" y="${VH / 2}" text-anchor="middle" font-size="13" fill="${alpha(theme.fg, 0.5)}">No data</text>`);
  }
  switch (s.type) {
    case "pie":   return renderPieOrDonut(s, theme, "pie");
    case "donut": return renderPieOrDonut(s, theme, "donut");
    case "line":  return renderBarOrLine(s, theme, "line");
    case "area":  return renderBarOrLine(s, theme, "area");
    case "bar":
    default:      return renderBarOrLine(s, theme, "bar");
  }
}

export function chartDataUri(spec: ChartSpec, theme: Theme): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(renderChartSvg(spec, theme))}`;
}

const VALID_TYPES: ChartType[] = ["bar", "line", "area", "pie", "donut"];

/** Validate + clean an AI-emitted chart spec. Returns undefined if unusable. */
export function cleanChartSpec(raw: any): ChartSpec | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const type: ChartType = VALID_TYPES.includes(raw.type) ? raw.type : "bar";
  const data: ChartDatum[] = Array.isArray(raw.data)
    ? raw.data
        .map((d: any) => ({
          label: typeof d?.label === "string" ? d.label.slice(0, 40) : "",
          value: Number.isFinite(Number(d?.value)) ? Number(d.value) : NaN,
          color: typeof d?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : undefined,
        }))
        .filter((d: ChartDatum) => Number.isFinite(d.value))
        .slice(0, 8)
    : [];
  if (data.length < 2) return undefined; // a chart needs at least 2 points
  const unit = typeof raw.unit === "string" ? raw.unit.slice(0, 6) : undefined;
  const title = typeof raw.title === "string" ? raw.title.slice(0, 60) : undefined;
  const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, 160) : undefined;
  const dataQuality = ["actual", "estimated", "projected", "mixed"].includes(raw.dataQuality)
    ? raw.dataQuality as ChartSpec["dataQuality"]
    : undefined;
  return { type, data, unit, title, note, dataQuality };
}
