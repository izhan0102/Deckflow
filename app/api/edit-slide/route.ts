import { NextRequest, NextResponse } from "next/server";
import type { Deck, Slide, Annotation, Anchor, ElementId, TableData, Reference, UploadedImage } from "@/lib/types";
import { withGroqClient } from "@/lib/groqClient";
import { getDecoration, DECORATIONS } from "@/lib/decorations";
import { searchIconify } from "@/lib/iconify";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_ANCHORS: Anchor[] = [
  "top-left","top-center","top-right",
  "middle-left","middle-center","middle-right",
  "bottom-left","bottom-center","bottom-right",
];
const VALID_ELEMENTS: ElementId[] = ["title", "subtitle", "bullets", "body", "table", "quote"];

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const PAD = 0.6;

const DECORATION_NAMES = DECORATIONS.map((d) => `"${d.id}" (${d.name})`).join(", ");

const SYSTEM_PROMPT = `You are SlideGen's slide editor.
You edit ONE slide at a time, with full deck context for coherent edits.
Output ONLY a JSON patch object. No prose, no markdown.

Patch schema (all fields OPTIONAL):
{
  "title": string,
  "subtitle": string,
  "bullets": string[],
  "addBullets": string[],
  "removeBullets": number[],
  "body": string,
  "notes": string,

  "table": { "headers": string[], "rows": [string[]], "source": string },

  "layout": "title-hero" | "bullets" | "table" | "two-column" | "quote" | "section" | "closing",

  // Slide-wide style
  "titleScale": number,
  "bodyScale":  number,
  "fontOverride": "sans" | "serif" | "mono",
  "textColorOverride": string,
  "accentColorOverride": string,
  "backgroundColorOverride": string,

  // Element controls (text containers)
  "hideElements": ["title" | "subtitle" | "bullets" | "body" | "table" | "quote"],
  "showElements": ["title" | "subtitle" | "bullets" | "body" | "table" | "quote"],
  "resetPositions": boolean,

  // Free-floating text labels (corner annotations)
  "addAnnotations": [
    { "text": string, "anchor": "...", "fontSize": number, "color": string,
      "bold": boolean, "italic": boolean, "align": "left"|"center"|"right" }
  ],
  "removeAnnotations": number[],
  "clearAnnotations": boolean,
  // Edit annotations that already exist (e.g. resize a team-name label, recolor it,
  // move it to another corner). Either pass "index" (from context) or a "match.text"
  // that fuzzy-matches the existing annotation's text. Any field in "patch" is optional.
  "updateAnnotations": [
    {
      "index": number,
      "match": { "text": string },
      "patch": {
        "text": string, "anchor": "top-left"|"...",
        "fontSize": number,                          // 8..96
        "fontSizeDelta": number,                     // +6 / -4 to nudge from current
        "color": string, "bold": boolean, "italic": boolean,
        "align": "left"|"center"|"right"
      }
    }
  ],

  // ===== GRAPHICS & ICONS (the new powers) =====
  "addElements": [
    {
      "kind": "decoration" | "icon",
      "decorationId": string,    // for kind="decoration", one of the catalog ids
      "iconQuery":   string,     // for kind="icon", a 1-2 word query like "rocket" or "calendar check"
      "position":    "top-left" | "top-right" | "bottom-left" | "bottom-right" |
                     "center"   | "left"      | "right"       | "top"          | "bottom",
      "size":        "small" | "medium" | "large",
      "color":       string,     // hex like "#DC2626"; omit to use theme accent
      "opacity":     number      // 0..1; omit for fully opaque
    }
  ],
  "removeElements": [string],    // image ids to remove. Use "*" to clear all elements on the slide.
  "updateElements": [
    {
      "id":    string,           // image id from the slide context (preferred)
      "match": {                 // OR a fuzzy match if the model can't see the id
        "kind": "decoration" | "icon",
        "decorationId": string,
        "iconContains": string   // substring of the iconId
      },
      "patch": {
        "position": "...",       // same vocabulary as addElements
        "size":     "small"|"medium"|"large",
        "sizeDelta": number,     // +1 to bump up one step, -1 to shrink one step
        "color":    string,      // hex
        "opacity":  number,      // 0..1
        "x": number, "y": number, "w": number, "h": number   // raw inches if needed
      }
    }
  ],

  "explanation": string
}

CRITICAL — content authoring rules:
- For "bullets" and "two-column": put content in "bullets". NEVER in "body".
- For "table": put data in "table" with headers, rows, and a "source" line.
- For "quote": put quote in "body", attribution in "subtitle".
- For "section": put lead-in in "body".
- For numeric/comparative content, switch layout to "table" if not already.
- If user says "actually write the X" / "fill in", use deck topic from context to write concrete content. No placeholders.

CRITICAL — REMOVAL semantics. Read the user's instruction carefully:
- "remove X" / "delete X" / "get rid of X" / "no X" / "without X" -> you MUST output a REMOVAL field, never an additive one. Specifically:
  * Removing slide title: \`{ "title": "" }\`
  * Removing slide subtitle: \`{ "subtitle": "" }\`
  * Removing the body / a quote / a section lead-in: \`{ "body": "" }\`
  * Removing all bullets: \`{ "bullets": [] }\`
  * Removing specific bullets: \`removeBullets\` with their indices
  * Removing a corner annotation (e.g. "Get in touch", a tagline): use \`removeAnnotations\` with its index from context, or \`clearAnnotations: true\` to remove all
  * Removing a graphic / icon / chart: \`removeElements\` with the element's id from context, or \`["*"]\` to clear all elements
- If the user says "remove X" and X is not present in the current slide, return \`{ "explanation": "X is not on this slide; no change made." }\` and DO NOT add it. NEVER hallucinate that something exists in order to "remove" it, and NEVER respond by adding it.

Closing slide rules:
- A closing slide normally only contains a thank-you title and an optional one-line subtitle.
- If the user says "remove get in touch / contact / cta" from the closing slide, that text usually lives in the subtitle, the body, or in annotations. Clear the relevant field(s).

Graphics & icons:
- Use addElements for "add a chart", "add an icon", "add a donut on the right", "add a rocket top-right in red".
- Decorations are layout shapes, charts, infographics. Available decorationId values: ${DECORATION_NAMES}.
- Icons are single-color symbols from a global library. Use kind="icon" with a short iconQuery like "rocket", "calendar", "trending up", "linkedin", "shield". The server will resolve it.
- For "remove the icon" / "remove the chart" use removeElements with an id from context, or use "*" to clear all.
- For "make the chart red" / "move the icon to the bottom right" use updateElements.
- For "make it bigger" / "make it smaller" / "scale it up" on an existing graphic, use updateElements with sizeDelta (+1 / -1) or set "size" to small | medium | large directly.
- For "make it 50% transparent" / "fade the icon" / "more subtle background", use updateElements with opacity (0..1). 0.5 = half transparent.
- DEFAULT POSITION when unspecified: "right" for charts/infographics, "top-right" for icons.
- DEFAULT SIZE when unspecified: "medium".
- ALWAYS pick the most relevant icon for the topic. If user says "use icons for the bullets", emit one addElements icon per bullet, lined up along the left edge or in a row.

Editing things you already added (memory + follow-ups):
- The user often asks follow-up edits like "make the team name bigger", "now move it to the top", "make it red". You can SEE the current slide's annotations and elements in the context with their indices and ids. Find the most likely target by text content (annotations) or by kind/icon name (elements) and edit it.
- "increase size of <text>" / "make <text> bigger" / "<text> bigger by 4pt" -> use updateAnnotations matching by text. Use fontSizeDelta to bump (+6 typical) or fontSize for an absolute value.
- "make <text> red" / "color the team name blue" -> updateAnnotations match by text, set color hex.
- "move <text> to the bottom" -> updateAnnotations match by text, set anchor.
- If the current slide has NO annotation/element matching what the user is talking about (e.g. "team name is not on this slide"), check whether the slide ALSO contains that text in subtitle / title / body — if so, edit those fields instead. Do not silently skip.

Recent history (memory):
- The "Recent edits" section below shows the last few instructions the user has issued and what changed. Use it to interpret pronouns ("it", "that", "the icon I added") and to avoid duplicating recent work.

Positioning (annotations - text labels at corners):
- "bottom left" -> anchor "bottom-left"
- Multiple lines at same corner: separate annotations, same anchor — they stack.

Color rules:
- "match other slides background" -> backgroundColorOverride to deck.themeBg
- 6-character hex with # prefix.

Always include "explanation".`;

const FEW_SHOT = [
  /* example 1: write advantages on a bullets slide */
  {
    role: "user" as const,
    content: `Deck context: { topic: "NGO monitoring", themeAccent: "#1E3A8A" }
Current slide: { layout: "bullets", title: "Key Advantages", bullets: [], elements: [] }
Instruction: "actually write the advantages"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      bullets: [
        "Real-time visibility into field volunteer activity",
        "Centralized donor reporting cuts admin time by half",
        "Offline-capable mobile app works in low-connectivity regions",
        "Role-based dashboards for staff, donors, and partners",
      ],
      explanation: "Wrote four concrete advantages tailored to the NGO monitoring topic.",
    }),
  },

  /* example 2: add a graphic */
  {
    role: "user" as const,
    content: `Deck context: { themeAccent: "#0E7490" }
Current slide: { layout: "bullets", title: "Quarterly results", elements: [] }
Instruction: "add a donut chart on the right"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      addElements: [
        { kind: "decoration", decorationId: "donut", position: "right", size: "medium" },
      ],
      explanation: "Placed a donut chart on the right side using the theme accent.",
    }),
  },

  /* example 3: add an icon with color */
  {
    role: "user" as const,
    content: `Deck context: { themeAccent: "#1E3A8A" }
Current slide: { layout: "title-hero", title: "Project Apollo", elements: [] }
Instruction: "add a rocket icon at top-right in red"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      addElements: [
        { kind: "icon", iconQuery: "rocket", position: "top-right", size: "small", color: "#DC2626" },
      ],
      explanation: "Added a red rocket icon in the top-right.",
    }),
  },

  /* example 4: update existing element */
  {
    role: "user" as const,
    content: `Deck context: { themeAccent: "#0E7490" }
Current slide: {
  layout: "bullets",
  title: "Q3",
  elements: [
    { id: "dec_abc", kind: "decoration", decorationId: "donut" },
    { id: "icon_xyz", kind: "icon", iconId: "tabler:rocket" }
  ]
}
Instruction: "make the rocket bigger and move it to the bottom right"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      updateElements: [
        { id: "icon_xyz", patch: { position: "bottom-right", size: "large" } },
      ],
      explanation: "Moved the rocket icon to the bottom-right and made it larger.",
    }),
  },

  /* example 5: REMOVE annotation that exists */
  {
    role: "user" as const,
    content: `Deck context: { topic: "investor update" }
Current slide: {
  layout: "closing",
  title: "Thank you",
  subtitle: "Get in touch — hello@example.com",
  annotations: [{ index: 0, text: "Get in touch", anchor: "bottom-center" }]
}
Instruction: "remove the get in touch from the last slide"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      subtitle: "",
      removeAnnotations: [0],
      explanation: "Removed the 'Get in touch' subtitle and corner annotation from the closing slide.",
    }),
  },

  /* example 6: REMOVE something that DOES NOT exist on the slide */
  {
    role: "user" as const,
    content: `Deck context: { topic: "lecture" }
Current slide: {
  layout: "bullets",
  title: "Methodology",
  bullets: ["Sample size n=240", "Mixed-methods design", "IRB-approved protocol"],
  annotations: []
}
Instruction: "remove the get in touch"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      explanation: "There is no 'Get in touch' element on this slide; no change made.",
    }),
  },

  /* example 7: empty slide, user asks to add relevant content */
  {
    role: "user" as const,
    content: `Deck context: { topic: "Phishing awareness training", deckTitle: "Phishing 101", themeAccent: "#0E7490" }
Current slide: {
  layout: "bullets",
  title: "",
  bullets: []
}
Instruction: "add content relevant to the deck"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      title: "Spotting a phishing email",
      bullets: [
        "Sender address looks close but not exact (paypa1.com instead of paypal.com)",
        "Urgent or threatening language pushing immediate action",
        "Generic greeting like 'Dear customer' instead of your name",
        "Hover over links — the URL doesn't match the real domain",
      ],
      notes: "Cover the four most common signals first; demo a real example next.",
      explanation: "Filled the empty slide with four phishing-spot signals tailored to the deck topic.",
    }),
  },

  /* example 8: resize an existing annotation by matching text */
  {
    role: "user" as const,
    content: `Deck context: { themeAccent: "#1E3A8A" }
Current slide: {
  layout: "title-hero",
  title: "Project Apollo",
  annotations: [
    { index: 0, text: "Hilfmunters", anchor: "bottom-right", fontSize: 12, color: "#1E3A8A" }
  ]
}
Recent edits:
  1. "add a team name: hilfmunters" -> added 'Hilfmunters' as a corner annotation (bottom-right).
Instruction: "increase size of team name"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      updateAnnotations: [
        { match: { text: "Hilfmunters" }, patch: { fontSizeDelta: 8 } },
      ],
      explanation: "Bumped the team name annotation up by 8pt.",
    }),
  },

  /* example 9: opacity / transparency on an icon */
  {
    role: "user" as const,
    content: `Deck context: { themeAccent: "#0E7490" }
Current slide: {
  layout: "bullets",
  title: "Q3",
  elements: [
    { id: "icon_xyz", kind: "icon", iconId: "tabler:rocket" }
  ]
}
Instruction: "make the rocket 40% transparent"
Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      updateElements: [
        { id: "icon_xyz", patch: { opacity: 0.6 } },
      ],
      explanation: "Set the rocket icon to 60% opacity.",
    }),
  },
];

/* --------------------------------- helpers -------------------------------- */

function extractJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1);
  return s;
}

function cleanText(s: any): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001F\u007F\u200B-\u200F\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}
function cleanList(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => cleanText(x))
    .map((s) => s.replace(/[.,;:!?\s]+$/g, "").trim())
    .filter((s) => s.length > 0 && s.length < 400);
}
function isHex(s: any): s is string {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());
}
function uid(prefix = "el") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
function cleanTable(t: any): TableData | undefined {
  if (!t || typeof t !== "object") return undefined;
  const headers = Array.isArray(t.headers) ? t.headers.map(cleanText).filter(Boolean) : [];
  if (headers.length === 0) return undefined;
  const rows = Array.isArray(t.rows)
    ? t.rows
        .map((r: any) => Array.isArray(r) ? r.map(cleanText) : [])
        .filter((r: string[]) => r.length > 0)
        .map((r: string[]) => {
          const out = [...r];
          while (out.length < headers.length) out.push("");
          return out.slice(0, headers.length);
        })
    : [];
  if (rows.length === 0) return undefined;
  const source = cleanText(t.source);
  return { headers, rows, source: source || undefined };
}

/* ----------------------- graphic / icon helpers --------------------------- */

type PositionKey =
  | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  | "center" | "left" | "right" | "top" | "bottom";

function isPosition(s: any): s is PositionKey {
  return [
    "top-left","top-right","bottom-left","bottom-right",
    "center","left","right","top","bottom",
  ].includes(s);
}

function defaultSizeFor(kind: "decoration" | "icon", decorationId?: string): { w: number; h: number } {
  if (kind === "icon") return { w: 1.6, h: 1.6 };
  const dec = decorationId ? getDecoration(decorationId) : undefined;
  return { w: dec?.defaultW ?? 4, h: dec?.defaultH ?? 3 };
}

function sizeFromKeyword(
  kind: "decoration" | "icon",
  size: "small" | "medium" | "large",
  decorationId?: string,
): { w: number; h: number } {
  const base = defaultSizeFor(kind, decorationId);
  const factor = size === "small" ? 0.7 : size === "large" ? 1.4 : 1;
  return { w: clamp(base.w * factor, 0.6, SLIDE_W - 1), h: clamp(base.h * factor, 0.6, SLIDE_H - 1) };
}

function positionToXY(pos: PositionKey, w: number, h: number): { x: number; y: number } {
  // Inches from origin. Account for slide padding.
  const cx = (SLIDE_W - w) / 2;
  const cy = (SLIDE_H - h) / 2;
  const top = PAD;
  const bottom = SLIDE_H - h - PAD;
  const left = PAD;
  const right = SLIDE_W - w - PAD;

  switch (pos) {
    case "top-left":     return { x: left,   y: top };
    case "top-right":    return { x: right,  y: top };
    case "bottom-left":  return { x: left,   y: bottom };
    case "bottom-right": return { x: right,  y: bottom };
    case "left":         return { x: left,   y: cy };
    case "right":        return { x: right,  y: cy };
    case "top":          return { x: cx,     y: top };
    case "bottom":       return { x: cx,     y: bottom };
    case "center":
    default:             return { x: cx,     y: cy };
  }
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

async function resolveIconQuery(query: string): Promise<string | null> {
  const q = cleanText(query);
  if (!q) return null;
  try {
    const hits = await searchIconify(q, 1);
    return hits[0]?.id || null;
  } catch {
    return null;
  }
}

function findElement(
  slide: Slide,
  ref: { id?: string; match?: { kind?: string; decorationId?: string; iconContains?: string } },
): UploadedImage | undefined {
  const list = slide.uploadedImages || [];
  if (ref.id) {
    const exact = list.find((x) => x.id === ref.id);
    if (exact) return exact;
  }
  if (ref.match) {
    const m = ref.match;
    return list.find((x) => {
      if (m.kind && x.kind !== m.kind) return false;
      if (m.decorationId && x.decorationId !== m.decorationId) return false;
      if (m.iconContains && !(x.iconId || "").toLowerCase().includes(m.iconContains.toLowerCase())) return false;
      return true;
    });
  }
  return undefined;
}

/* ------------------------------ patch reducer ----------------------------- */

async function applyPatch(slide: Slide, patch: any): Promise<Slide> {
  const next: Slide = { ...slide };

  if (typeof patch.title === "string") next.title = cleanText(patch.title);
  if (typeof patch.subtitle === "string") next.subtitle = cleanText(patch.subtitle);
  if (typeof patch.body === "string") next.body = cleanText(patch.body);
  if (typeof patch.notes === "string") next.notes = cleanText(patch.notes);
  if (typeof patch.layout === "string") next.layout = patch.layout;
  if (typeof patch.fontOverride === "string") next.fontOverride = patch.fontOverride;
  if (isHex(patch.textColorOverride)) next.textColorOverride = patch.textColorOverride;
  if (isHex(patch.accentColorOverride)) next.accentColorOverride = patch.accentColorOverride;
  if (isHex(patch.backgroundColorOverride)) next.backgroundColorOverride = patch.backgroundColorOverride;

  if (typeof patch.titleScale === "number" && isFinite(patch.titleScale)) {
    next.titleScale = Math.max(0.5, Math.min(1.8, patch.titleScale));
  }
  if (typeof patch.bodyScale === "number" && isFinite(patch.bodyScale)) {
    next.bodyScale = Math.max(0.5, Math.min(1.8, patch.bodyScale));
  }

  // Bullets
  if (Array.isArray(patch.bullets)) {
    next.bullets = cleanList(patch.bullets);
  } else {
    let arr = [...(next.bullets || [])];
    if (Array.isArray(patch.removeBullets)) {
      const drop = new Set<number>(patch.removeBullets.filter((n: any) => typeof n === "number"));
      arr = arr.filter((_, i) => !drop.has(i));
    }
    if (Array.isArray(patch.addBullets)) {
      arr.push(...cleanList(patch.addBullets));
    }
    if (Array.isArray(patch.removeBullets) || Array.isArray(patch.addBullets)) {
      next.bullets = arr;
    }
  }

  if (patch.table !== undefined) {
    const t = cleanTable(patch.table);
    if (t) next.table = t;
  }

  // Element visibility (text containers)
  if (Array.isArray(patch.hideElements)) {
    const map = { ...(next.elementHidden || {}) };
    for (const id of patch.hideElements) if (VALID_ELEMENTS.includes(id)) map[id as ElementId] = true;
    next.elementHidden = map;
  }
  if (Array.isArray(patch.showElements)) {
    const map = { ...(next.elementHidden || {}) };
    for (const id of patch.showElements) if (VALID_ELEMENTS.includes(id)) map[id as ElementId] = false;
    next.elementHidden = map;
  }
  if (patch.resetPositions === true) {
    next.elementOffsets = {};
  }

  // Annotations
  let annotations = [...(next.annotations || [])];
  if (patch.clearAnnotations === true) annotations = [];
  if (Array.isArray(patch.removeAnnotations)) {
    const drop = new Set<number>(patch.removeAnnotations.filter((n: any) => typeof n === "number"));
    annotations = annotations.filter((_, i) => !drop.has(i));
  }
  if (Array.isArray(patch.updateAnnotations)) {
    for (const u of patch.updateAnnotations) {
      if (!u || typeof u !== "object") continue;
      // Resolve target by index, or by fuzzy text match.
      let idx = -1;
      if (typeof u.index === "number" && u.index >= 0 && u.index < annotations.length) {
        idx = u.index;
      } else if (u.match && typeof u.match.text === "string") {
        const needle = u.match.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (needle) {
          idx = annotations.findIndex((a) =>
            a.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().includes(needle),
          );
        }
      }
      if (idx < 0) continue;
      const cur = { ...annotations[idx] };
      const p = u.patch || {};
      if (typeof p.text === "string" && p.text.trim()) cur.text = cleanText(p.text);
      if (VALID_ANCHORS.includes(p.anchor)) cur.anchor = p.anchor;
      if (typeof p.fontSize === "number" && isFinite(p.fontSize)) {
        cur.fontSize = Math.max(8, Math.min(96, p.fontSize));
      }
      if (typeof p.fontSizeDelta === "number" && isFinite(p.fontSizeDelta)) {
        const base = typeof cur.fontSize === "number" ? cur.fontSize : 14;
        cur.fontSize = Math.max(8, Math.min(96, base + p.fontSizeDelta));
      }
      if (isHex(p.color)) cur.color = p.color;
      if (typeof p.bold === "boolean") cur.bold = p.bold;
      if (typeof p.italic === "boolean") cur.italic = p.italic;
      if (p.align === "left" || p.align === "center" || p.align === "right") cur.align = p.align;
      annotations[idx] = cur;
    }
  }
  if (Array.isArray(patch.addAnnotations)) {
    for (const a of patch.addAnnotations) {
      if (!a || typeof a !== "object") continue;
      const text = cleanText(a.text);
      if (!text) continue;
      const anchor: Anchor = VALID_ANCHORS.includes(a.anchor) ? a.anchor : "bottom-left";
      annotations.push({
        id: uid("a"),
        text,
        anchor,
        fontSize: typeof a.fontSize === "number" && isFinite(a.fontSize)
          ? Math.max(8, Math.min(48, a.fontSize)) : 12,
        color: isHex(a.color) ? a.color : undefined,
        bold: a.bold === true,
        italic: a.italic === true,
        align: a.align === "left" || a.align === "center" || a.align === "right" ? a.align : undefined,
      });
    }
  }
  next.annotations = annotations;

  /* ------------ NEW: graphics & icons ------------ */

  let images = [...(next.uploadedImages || [])];

  // Removals first.
  if (Array.isArray(patch.removeElements)) {
    if (patch.removeElements.includes("*")) {
      images = [];
    } else {
      const drop = new Set<string>(patch.removeElements.filter((x: any) => typeof x === "string"));
      images = images.filter((img) => !drop.has(img.id));
    }
  }

  // Updates: position / size / color / explicit dims.
  if (Array.isArray(patch.updateElements)) {
    for (const u of patch.updateElements) {
      if (!u || typeof u !== "object") continue;
      const target = findElement({ ...next, uploadedImages: images } as Slide, u);
      if (!target) continue;
      const idx = images.findIndex((x) => x.id === target.id);
      if (idx < 0) continue;
      const cur = { ...images[idx] };
      const p = u.patch || {};

      // Color
      if (isHex(p.color)) {
        cur.colorOverrides = { ...(cur.colorOverrides || {}), accent: p.color };
      }
      // Opacity (0..1)
      if (typeof p.opacity === "number" && isFinite(p.opacity)) {
        cur.opacity = Math.max(0, Math.min(1, p.opacity));
      }
      // Size keyword
      if (p.size === "small" || p.size === "medium" || p.size === "large") {
        const kind = (cur.kind === "icon" ? "icon" : "decoration") as "icon" | "decoration";
        const dim = sizeFromKeyword(kind, p.size, cur.decorationId);
        cur.w = dim.w; cur.h = dim.h;
      }
      // Size delta — bump up/down a step relative to current size.
      if (typeof p.sizeDelta === "number" && isFinite(p.sizeDelta)) {
        const factor = Math.pow(1.4, p.sizeDelta);
        cur.w = clamp(cur.w * factor, 0.4, SLIDE_W);
        cur.h = clamp(cur.h * factor, 0.4, SLIDE_H);
      }
      // Position
      if (isPosition(p.position)) {
        const xy = positionToXY(p.position, cur.w, cur.h);
        cur.x = xy.x; cur.y = xy.y;
      }
      // Raw dims (fallback)
      if (typeof p.x === "number") cur.x = clamp(p.x, -cur.w / 2, SLIDE_W - cur.w / 2);
      if (typeof p.y === "number") cur.y = clamp(p.y, -cur.h / 2, SLIDE_H - cur.h / 2);
      if (typeof p.w === "number") cur.w = clamp(p.w, 0.4, SLIDE_W);
      if (typeof p.h === "number") cur.h = clamp(p.h, 0.4, SLIDE_H);

      images[idx] = cur;
    }
  }

  // Additions: resolve sizes, positions, icon queries.
  if (Array.isArray(patch.addElements)) {
    for (const a of patch.addElements) {
      if (!a || typeof a !== "object") continue;
      const kind: "decoration" | "icon" =
        a.kind === "icon" ? "icon" :
        a.kind === "decoration" ? "decoration" : "decoration";

      let decorationId: string | undefined;
      let iconId: string | undefined;

      if (kind === "decoration") {
        if (typeof a.decorationId !== "string") continue;
        if (!getDecoration(a.decorationId)) continue;
        decorationId = a.decorationId;
      } else {
        if (typeof a.iconQuery !== "string" || !a.iconQuery.trim()) continue;
        const resolved = await resolveIconQuery(a.iconQuery);
        if (!resolved) continue; // skip icon if no hit
        iconId = resolved;
      }

      const sizeKey = a.size === "small" || a.size === "large" ? a.size : "medium";
      const dim = sizeFromKeyword(kind, sizeKey, decorationId);
      const positionKey: PositionKey = isPosition(a.position) ? a.position
        : kind === "icon" ? "top-right" : "right";
      const xy = positionToXY(positionKey, dim.w, dim.h);

      const newImage: UploadedImage = {
        id: uid(kind === "icon" ? "icon" : "dec"),
        kind,
        decorationId,
        iconId,
        dataUrl: "",
        x: xy.x, y: xy.y, w: dim.w, h: dim.h,
        colorOverrides: isHex(a.color) ? { accent: a.color } : undefined,
        opacity: typeof a.opacity === "number" && isFinite(a.opacity)
          ? Math.max(0, Math.min(1, a.opacity)) : undefined,
      };
      images.push(newImage);
    }
  }

  next.uploadedImages = images;
  return next;
}

/* ------------------------------- POST handler ------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const uid = await authenticateRequest(req);
    const { deck, theme, slideIndex, instruction, history } = (await req.json()) as {
      deck: Deck;
      theme?: { bg?: string; fg?: string; accent?: string };
      slideIndex: number;
      instruction: string;
      /** Compact recent edits, oldest -> newest. Used by the model as memory. */
      history?: { user: string; explanation?: string; scope?: "slide" | "deck" }[];
    };

    if (!deck || typeof slideIndex !== "number" || !instruction) {
      return NextResponse.json({ error: "deck + slideIndex + instruction required" }, { status: 400 });
    }
    if (instruction.length > 2000) {
      return NextResponse.json({ error: "Instruction too long (max 2000 characters)" }, { status: 400 });
    }
    // Prevent breaking out of the quoted prompt or confusing the LLM's JSON parsing
    const safeInstruction = instruction.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

    const slide = deck.slides[slideIndex];
    if (!slide) return NextResponse.json({ error: "slide not found" }, { status: 400 });

    const deckContext = {
      topic: deck.topic || "",
      audience: deck.audience || "",
      tone: deck.tone || "",
      density: deck.density || "balanced",
      deckTitle: deck.title,
      themeBg: theme?.bg || "#0B0B0F",
      themeFg: theme?.fg || "#FAFAFA",
      themeAccent: theme?.accent || "#7C5CFF",
      slideMap: deck.slides.map((s, i) => ({
        i, layout: s.layout, title: s.title, active: i === slideIndex,
      })),
      hasReferences: (deck.references || []).length > 0,
    };

    const compactSlide = {
      layout: slide.layout,
      title: slide.title,
      subtitle: slide.subtitle,
      bullets: slide.bullets,
      body: slide.body,
      table: slide.table,
      titleScale: slide.titleScale,
      bodyScale: slide.bodyScale,
      fontOverride: slide.fontOverride,
      textColorOverride: slide.textColorOverride,
      accentColorOverride: slide.accentColorOverride,
      backgroundColorOverride: slide.backgroundColorOverride,
      hiddenElements: slide.elementHidden ? Object.keys(slide.elementHidden).filter(k => slide.elementHidden![k as ElementId]) : [],
      annotations: (slide.annotations || []).map((a, i) => ({
        index: i, text: a.text, anchor: a.anchor, fontSize: a.fontSize, color: a.color,
      })),
      // The model needs to see existing elements so it can reference them
      // by id when the user says "the chart" or "the rocket".
      elements: (slide.uploadedImages || []).map((img) => ({
        id: img.id,
        kind: img.kind,
        decorationId: img.decorationId,
        iconId: img.iconId,
        position: { x: round(img.x), y: round(img.y), w: round(img.w), h: round(img.h) },
        color: img.colorOverrides?.accent,
        opacity: img.opacity,
      })),
    };

    const recentBlock = (Array.isArray(history) && history.length > 0)
      ? `Recent edits (oldest -> newest, your memory of what just happened):\n${history
          .slice(-6)
          .map((h, i) => `  ${i + 1}. [${h.scope || "slide"}] "${(h.user || "").slice(0, 200)}" -> ${(h.explanation || "(applied)").slice(0, 200)}`)
          .join("\n")}\n\n`
      : "";

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        model: "openai/gpt-oss-120b",
        temperature: 0.15,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...FEW_SHOT,
          {
            role: "user",
            content: `Deck context:
${JSON.stringify(deckContext, null, 2)}

Current slide (index ${slideIndex}):
${JSON.stringify(compactSlide, null, 2)}

${recentBlock}Instruction:
"${safeInstruction}"

Return ONLY the JSON patch.`,
          },
        ],
      }),
    );

    const raw = completion.choices[0]?.message?.content || "{}";
    const patch = JSON.parse(extractJson(raw));
    const updated = await applyPatch(slide, patch);

    return NextResponse.json({
      slide: updated,
      explanation: typeof patch.explanation === "string" ? patch.explanation : "Slide updated.",
    });
  } catch (err: any) {
    console.error("[/api/edit-slide] error:", err);
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Edit failed." }, { status });
  }
}

function round(n: number): number { return Math.round(n * 100) / 100; }
