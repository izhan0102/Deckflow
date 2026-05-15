import Groq from "groq-sdk";
import type { Deck, Slide, SlideLayout, ContentDensity, Reference, TableData } from "./types";
import { withGroqClient } from "./groqClient";

const VALID_LAYOUTS: SlideLayout[] = [
  "title-hero",
  "bullets",
  "table",
  "two-column",
  "quote",
  "section",
  "references",
  "closing",
];

const DENSITY_GUIDE: Record<ContentDensity, string> = {
  concise: `Density: CONCISE.\n- 3 bullets per content slide.\n- Each bullet 4-8 words.`,
  balanced: `Density: BALANCED.\n- 4 bullets per content slide.\n- Each bullet 8-14 words.`,
  detailed: `Density: DETAILED.\n- 5 bullets per content slide.\n- Each bullet 14-22 words. Real sentences.`,
  comprehensive: `Density: COMPREHENSIVE.\n- 5-6 bullets per content slide.\n- Each bullet 20-32 words.\n- Substance and specificity matter.`,
};

const SYSTEM_PROMPT = `You are SlideGen, a senior presentation designer.
Output ONLY valid JSON matching the schema. No prose, no markdown.

Schema:
{
  "title": string,
  "subtitle": string,
  "references": [
    { "text": string, "url": string }
  ],
  "slides": [
    {
      "layout": "title-hero" | "bullets" | "table" | "two-column" | "quote" | "section" | "closing",
      "title": string,
      "subtitle": string,
      "bullets": string[],
      "body": string,
      "table": { "headers": string[], "rows": [ string[] ], "source": string },
      "notes": string
    }
  ]
}

Layout rules — pick the layout that fits the content:
- "title-hero":  opening slide.
- "bullets":     3-6 bullets. Default content slide. NEVER leave bullets empty.
- "table":       data, metrics, comparisons, numbers. Always include "source".
- "two-column":  qualitative comparison without numbers.
- "quote":       use ONLY when the user's prompt explicitly asks for a quote, testimonial, or famous saying. NEVER auto-insert a quote slide for "rhythm" or "variety". If you have no real quote relevant to the topic, do not output this layout.
- "section":     chapter divider between major themes. Use sparingly (max 1 per deck) and only when the deck has clearly separable sections.
- "closing":     thank you / Q&A.

Composition rules:
- First slide MUST be "title-hero".
- Last slide MUST be "closing".
- DO NOT use "references" layout — added automatically.
- For numeric/comparative content, use "table" — never invent stat cards.
- Vary layouts among bullets / table / two-column. Don't repeat the same layout 3+ times in a row.
- Do NOT add "rhythm" slides (quote, section dividers) unless the topic genuinely benefits. Most decks should have 0 quote slides and 0-1 section slides.

CRITICAL completeness rules:
- EVERY content slide MUST be filled in fully. If layout is "bullets" or "two-column", "bullets" must contain at least 3 items.
- If layout is "table", "table.rows" must contain at least 2 rows and "table.headers" must not be empty.
- If layout is "quote", "body" must contain a real, accurate quote relevant to the topic.
- NEVER output empty arrays or empty bodies. If you cannot think of content, write fewer slides instead.

Tables:
- Headers short (1-3 words). Cells short (1-4 words).
- "source" is one line: "Author/Org, Year".

References:
- Provide 4-8 references in top-level "references" array.
- Format: "Author (Year). Title. Publisher/Outlet."
- Include "url" only if highly confident it's real.

Text:
- Titles <= 70 chars, subtitles <= 110 chars.
- Notes 2-4 sentences per slide.
- No emojis unless topic invites them.`;

function buildUserMessage(opts: {
  prompt: string;
  slideCount: number;
  audience?: string;
  tone?: string;
  density: ContentDensity;
  includeReferences: boolean;
}) {
  const refLine = opts.includeReferences
    ? `Provide a "references" array with 4-8 plausible scholarly or industry sources for the topic.`
    : `Set "references" to an empty array — the user does not want a references slide.`;

  return `Create a ${opts.slideCount}-slide presentation.

${DENSITY_GUIDE[opts.density]}

${refLine}

Topic / brief:
"""
${opts.prompt}
"""

Audience: ${opts.audience || "general"}
Tone: ${opts.tone || "professional, clear, engaging"}

Return ONLY the JSON object.`;
}

function extractJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
}

function clean(s: any): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001F\u007F\u200B-\u200F\uFEFF]/g, "").trim();
}

function cleanTable(t: any): TableData | undefined {
  if (!t || typeof t !== "object") return undefined;
  const headers = Array.isArray(t.headers) ? t.headers.map(clean).filter(Boolean) : [];
  if (headers.length === 0) return undefined;
  const rows = Array.isArray(t.rows)
    ? t.rows
        .map((r: any) => Array.isArray(r) ? r.map(clean) : [])
        .filter((r: string[]) => r.length > 0)
        .map((r: string[]) => {
          const out = [...r];
          while (out.length < headers.length) out.push("");
          return out.slice(0, headers.length);
        })
    : [];
  if (rows.length === 0) return undefined;
  const source = clean(t.source);
  return { headers, rows, source: source || undefined };
}

function cleanRefs(arr: any): Reference[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r: any): Reference | null => {
      if (!r) return null;
      if (typeof r === "string") {
        const t = clean(r);
        return t ? { text: t } : null;
      }
      const text = clean(r.text);
      if (!text) return null;
      const url = typeof r.url === "string" && r.url.startsWith("http") ? r.url.trim() : undefined;
      return { text, url };
    })
    .filter((x): x is Reference => !!x)
    .slice(0, 12);
}

/** A slide is empty if its layout-specific content field is missing. */
function isEmptySlide(s: Slide): boolean {
  if (s.layout === "title-hero" || s.layout === "closing") return !s.title;
  if (s.layout === "section") return !s.title || !s.body;
  if (s.layout === "quote") return !s.body;
  if (s.layout === "table") return !s.table || s.table.rows.length === 0;
  if (s.layout === "bullets" || s.layout === "two-column") {
    return !s.bullets || s.bullets.length < 2;
  }
  return false;
}

async function fillEmptySlides(
  deck: Deck,
  emptyIndices: number[],
): Promise<Slide[]> {
  // Ask the model for content for just these slide indices.
  const targets = emptyIndices.map((i) => ({
    index: i,
    layout: deck.slides[i].layout,
    title: deck.slides[i].title,
  }));

  const sys = `You fill in missing content for specific slides of an existing deck.
Output ONLY a JSON object: { "fills": [ { "index": number, "bullets"?: string[], "body"?: string, "table"?: {headers, rows, source} } ] }.
For each target slide, provide the right content for its layout. NEVER return empty arrays.`;

  const user = `Deck topic: "${deck.topic || deck.title}"
Audience: ${deck.audience || "general"}
Tone: ${deck.tone || "professional"}
Density: ${deck.density || "balanced"}

Slides needing content:
${JSON.stringify(targets, null, 2)}

Rules per layout:
- bullets / two-column: produce 3-5 concrete bullets (8-18 words each). Use the deck topic.
- table: 3-5 rows with appropriate headers and a real-sounding source line.
- quote: a relevant quote in "body" and attribution in subtitle (you can also include subtitle).
- section: a short body line.
- title-hero / closing: not expected here; skip.

Return ONLY the JSON.`;

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      temperature: 0.5,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(extractJson(raw));
  const fills: any[] = Array.isArray(parsed?.fills) ? parsed.fills : [];

  const next = deck.slides.map((s, i) => {
    const fill = fills.find((f) => f.index === i);
    if (!fill) return s;
    const updated: Slide = { ...s };
    if (Array.isArray(fill.bullets)) updated.bullets = fill.bullets.map(clean).filter(Boolean);
    if (typeof fill.body === "string") updated.body = clean(fill.body);
    if (fill.table) updated.table = cleanTable(fill.table) || updated.table;
    if (typeof fill.subtitle === "string") updated.subtitle = clean(fill.subtitle);
    return updated;
  });

  return next;
}

export async function generateDeck(opts: {
  prompt: string;
  slideCount: number;
  audience?: string;
  tone?: string;
  density?: ContentDensity;
  includeReferences?: boolean;
}): Promise<Deck> {
  const density: ContentDensity = opts.density || "balanced";
  const includeReferences = opts.includeReferences !== false;

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      temperature: 0.7,
      max_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage({ ...opts, density, includeReferences }) },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "";
  const parsed = JSON.parse(extractJson(raw));

  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error("Model returned no slides.");
  }

  const slides: Slide[] = parsed.slides.map((s: any, i: number) => {
    const rawLayout = s.layout;
    const layout: SlideLayout = VALID_LAYOUTS.includes(rawLayout)
      ? rawLayout
      : i === 0 ? "title-hero"
      : i === parsed.slides.length - 1 ? "closing"
      : "bullets";

    return {
      layout: layout === "references" ? ("bullets" as SlideLayout) : layout,
      title: clean(s.title),
      subtitle: s.subtitle ? clean(s.subtitle) : undefined,
      bullets: Array.isArray(s.bullets) ? s.bullets.map(clean).filter(Boolean) : [],
      body: s.body ? clean(s.body) : undefined,
      table: cleanTable(s.table),
      notes: s.notes ? clean(s.notes) : undefined,
      annotations: [],
    };
  });

  if (slides[0]) slides[0].layout = "title-hero";
  if (slides.length > 1) slides[slides.length - 1].layout = "closing";

  // Drop quote slides whose body is missing, too short, or looks like noise.
  // Better to lose a slide than ship "asdfasdf" content.
  for (let i = slides.length - 2; i > 0; i--) {
    const s = slides[i];
    if (s.layout === "quote") {
      const body = (s.body || "").trim();
      const looksReal = body.length >= 12 && /[a-zA-Z]/.test(body) && !/^[a-z]{8,}$/.test(body);
      if (!looksReal) slides.splice(i, 1);
    }
  }

  // Build a tentative deck so the fill pass has full context.
  const tentative: Deck = {
    title: clean(parsed.title) || "Untitled Deck",
    subtitle: parsed.subtitle ? clean(parsed.subtitle) : undefined,
    slides,
    topic: opts.prompt,
    audience: opts.audience,
    tone: opts.tone,
    density,
  };

  // Find empty slides (excluding hero/closing) and fill them in one extra call.
  const emptyIndices = slides
    .map((s, i) => (i === 0 || i === slides.length - 1 ? -1 : isEmptySlide(s) ? i : -1))
    .filter((i) => i >= 0);

  let filledSlides = slides;
  if (emptyIndices.length > 0) {
    try {
      filledSlides = await fillEmptySlides(tentative, emptyIndices);
    } catch (e) {
      console.warn("[generateDeck] fill pass failed:", e);
    }
  }

  // Insert references slide if requested.
  const references = cleanRefs(parsed.references);
  if (includeReferences && references.length > 0 && filledSlides.length > 1) {
    filledSlides = [
      ...filledSlides.slice(0, filledSlides.length - 1),
      {
        layout: "references" as SlideLayout,
        title: "References",
        subtitle: undefined,
        bullets: [],
        body: undefined,
        table: undefined,
        notes: "Cite the sources below where relevant during the talk.",
        annotations: [],
      },
      filledSlides[filledSlides.length - 1],
    ];
  }

  const deck: Deck = {
    title: tentative.title,
    subtitle: tentative.subtitle,
    slides: filledSlides,
    references: includeReferences ? references : [],
    includeReferences,
  };

  return deck;
}
