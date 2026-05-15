import { NextRequest, NextResponse } from "next/server";
import type { Deck, Slide, Annotation, Anchor, ElementId, TableData, Reference } from "@/lib/types";
import { withGroqClient } from "@/lib/groqClient";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_ANCHORS: Anchor[] = [
  "top-left","top-center","top-right",
  "middle-left","middle-center","middle-right",
  "bottom-left","bottom-center","bottom-right",
];
const VALID_ELEMENTS: ElementId[] = ["title", "subtitle", "bullets", "body", "table", "quote"];

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

  "table": {
    "headers": string[],
    "rows": [ string[] ],
    "source": string
  },

  "layout": "title-hero" | "bullets" | "table" | "two-column" | "quote" | "section" | "closing",

  // Slide-wide style
  "titleScale": number,            // 0.5 - 1.8
  "bodyScale":  number,
  "fontOverride": "sans" | "serif" | "mono",
  "textColorOverride": string,
  "accentColorOverride": string,
  "backgroundColorOverride": string,

  // Element controls (for "delete the title", "hide bullets", "make table bigger")
  "hideElements": ["title" | "subtitle" | "bullets" | "body" | "table" | "quote"],
  "showElements": ["title" | "subtitle" | "bullets" | "body" | "table" | "quote"],
  "resetPositions": boolean,        // clears all per-element drag offsets

  // Free-floating text boxes for "add X at bottom left", etc.
  "addAnnotations": [
    { "text": string, "anchor": "...", "fontSize": number, "color": string, "bold": boolean, "italic": boolean, "align": "left"|"center"|"right" }
  ],
  "removeAnnotations": number[],
  "clearAnnotations": boolean,

  "explanation": string
}

CRITICAL — content authoring rules:
- For "bullets" and "two-column": put content in "bullets". NEVER in "body".
- For "table": put data in "table" with headers, rows, and a "source" line.
- For "quote": put quote in "body", attribution in "subtitle".
- For "section": put lead-in in "body".
- For numeric/comparative content, switch layout to "table" if not already, then provide table data.
- If user says "actually write the X" / "fill in", use deck topic from context to write concrete content. No placeholders.

Positioning (annotations):
- "bottom left" -> anchor "bottom-left"
- "small font" -> fontSize 10-11. "tiny" -> 9. "large" -> 22. "huge" -> 32.

Deletion:
- "remove/hide/delete the title" -> hideElements: ["title"]
- "delete bullets" -> hideElements: ["bullets"]
- "bring back the title" -> showElements: ["title"]
- "reset positions" / "put everything back" -> resetPositions: true

Color rules:
- "match other slides background" / "page color is wrong" / "color of bg like other slides" -> backgroundColorOverride MUST equal deck.themeBg (a real hex value provided in context).
- "text white" -> textColorOverride: "#FFFFFF"
- "accent red" -> accentColorOverride: "#DC2626"
- 6-character hex with # prefix.

Always include "explanation".`;

const FEW_SHOT = [
  {
    role: "user" as const,
    content: `Deck context:
- topic: "NGO monitoring system for tracking field volunteers"
- this slide layout: "bullets"

Current slide:
{ "layout": "bullets", "title": "Key Advantages", "bullets": [], "body": "" }

Instruction:
"actually write the advantages"

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
  {
    role: "user" as const,
    content: `Deck context:
- topic: "Climate report"

Current slide:
{ "layout": "bullets", "title": "Glacier Retreat Metrics", "bullets": ["Glacier area loss since 1980: 15%", "Average retreat rate: 30 m/yr"] }

Instruction:
"convert this to a table with sources"

Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      layout: "table",
      bullets: [],
      table: {
        headers: ["Metric", "Value", "Period"],
        rows: [
          ["Glacier area loss", "15%", "Since 1980"],
          ["Average retreat rate", "30 m/yr", "1980-2020"],
          ["Ice volume reduction", "25%", "1980-2020"],
          ["Projected area loss", "40%", "By 2050"],
        ],
        source: "IPCC AR6 Working Group I, 2021",
      },
      explanation: "Converted the metrics into a four-row table with an IPCC source line.",
    }),
  },
  {
    role: "user" as const,
    content: `Current slide:
{ "layout": "bullets", "title": "Roadmap", "bullets": ["Q1", "Q2"] }

Instruction:
"delete the title"

Return ONLY the JSON patch.`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      hideElements: ["title"],
      explanation: "Hid the title element.",
    }),
  },
];

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

function uid() {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

function applyPatch(slide: Slide, patch: any): Slide {
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

  // Element visibility
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

  let annotations = [...(next.annotations || [])];
  if (patch.clearAnnotations === true) annotations = [];
  if (Array.isArray(patch.removeAnnotations)) {
    const drop = new Set<number>(patch.removeAnnotations.filter((n: any) => typeof n === "number"));
    annotations = annotations.filter((_, i) => !drop.has(i));
  }
  if (Array.isArray(patch.addAnnotations)) {
    for (const a of patch.addAnnotations) {
      if (!a || typeof a !== "object") continue;
      const text = cleanText(a.text);
      if (!text) continue;
      const anchor: Anchor = VALID_ANCHORS.includes(a.anchor) ? a.anchor : "bottom-left";
      const ann: Annotation = {
        id: uid(),
        text,
        anchor,
        fontSize: typeof a.fontSize === "number" && isFinite(a.fontSize)
          ? Math.max(8, Math.min(48, a.fontSize)) : 12,
        color: isHex(a.color) ? a.color : undefined,
        bold: a.bold === true,
        italic: a.italic === true,
        align: a.align === "left" || a.align === "center" || a.align === "right"
          ? a.align : undefined,
      };
      annotations.push(ann);
    }
  }
  next.annotations = annotations;

  return next;
}

export async function POST(req: NextRequest) {
  try {
    const { deck, theme, slideIndex, instruction } = (await req.json()) as {
      deck: Deck; theme?: { bg?: string; fg?: string; accent?: string }; slideIndex: number; instruction: string;
    };

    if (!deck || typeof slideIndex !== "number" || !instruction) {
      return NextResponse.json({ error: "deck + slideIndex + instruction required" }, { status: 400 });
    }
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
    };

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        model: "openai/gpt-oss-120b",
        temperature: 0.3,
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

Instruction:
"${instruction}"

Return ONLY the JSON patch.`,
          },
        ],
      }),
    );

    const raw = completion.choices[0]?.message?.content || "{}";
    const patch = JSON.parse(extractJson(raw));
    const updated = applyPatch(slide, patch);

    return NextResponse.json({
      slide: updated,
      explanation: typeof patch.explanation === "string" ? patch.explanation : "Slide updated.",
    });
  } catch (err: any) {
    console.error("[/api/edit-slide] error:", err);
    return NextResponse.json({ error: err?.message || "Edit failed." }, { status: 500 });
  }
}
