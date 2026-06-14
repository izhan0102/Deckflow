import Groq from "groq-sdk";
import type { Deck, Slide, SlideLayout, ContentDensity, Reference, TableData } from "./types";
import { withGroqClient } from "./groqClient";
import { cleanChartSpec, type ChartType, type ChartSpec } from "./charts";

const VALID_LAYOUTS: SlideLayout[] = [
  "title-hero",
  "bullets",
  "table",
  "chart",
  "two-column",
  "quote",
  "section",
  "references",
  "closing",
];

const DENSITY_GUIDE: Record<ContentDensity, string> = {
  concise:        `Density: CONCISE. Keep it tight.\n- 3 bullets per content slide.\n- Each bullet 4-8 words. Short, scannable phrases.`,
  balanced:       `Density: BALANCED.\n- 4 bullets per content slide.\n- Each bullet 8-14 words. A clear, complete thought each.`,
  detailed:       `Density: DETAILED. The user wants substance — fill the slide.\n- 4 to 5 bullets per content slide.\n- Each bullet is a full, informative sentence of 14-24 words that actually teaches something. Do NOT write short fragments.\n- Aim to use the whole slide. A near-empty detailed slide is a failure.\n- Cap each bullet at ~150 characters so it still fits on one line or two.`,
  comprehensive:  `Density: COMPREHENSIVE. Pack the slide with real depth.\n- 5 substantial bullets per content slide.\n- Each bullet is a rich, specific sentence of 18-30 words with concrete detail, examples, or reasoning — not a vague one-liner.\n- Use the full slide. Thin content here is wrong.\n- Cap each bullet at ~180 characters so it fits the slide without overflowing.`,
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
      "layout": "title-hero" | "bullets" | "table" | "chart" | "two-column" | "quote" | "section" | "closing",
      "title": string,
      "subtitle": string,
      "bullets": string[],
      "body": string,
      "table": { "headers": string[], "rows": [ string[] ], "source": string },
      "chart": {
        "type": "bar" | "line" | "area" | "pie" | "donut",
        "title": string,                 // short caption for the chart
        "unit": string,                  // OPTIONAL suffix like "%", "M", "k"
        "data": [ { "label": string, "value": number, "color": string } ]  // 2-7 points; "color" optional hex
      },
      "columnLabels": { "left": string, "right": string },  // ONLY for "two-column". Whatever the two sides actually are for this topic. Pick labels that fit the content; do not default to any fixed pairing.
      "kicker": string,         // OPTIONAL. ONLY for the first "title-hero" slide. Short uppercase context line shown above the title (e.g. "Q3 INVESTOR UPDATE", "INTRO LECTURE"). 2-5 words, always uppercase.
      "titleVariant": "centered" | "asymmetric" | "big-initial" | "numbered" | "underlined",  // OPTIONAL. ONLY for "title-hero".
      "bulletsVariant": "standard" | "numbered" | "cards" | "icon-check" | "dashed",  // OPTIONAL. ONLY for "bullets". Choose by content: "cards" for distinct features/pillars, "icon-check" for benefits/advantages, "numbered" for ordered steps, "standard"/"dashed" for plain points.
      "twoColumnVariant": "classic" | "divider" | "cards" | "numbered" | "compare",  // OPTIONAL. ONLY for "two-column". Use "compare" ONLY for genuine pros/cons.
      "notes": string
    }
  ]
}

YOUR JOB: design a deck that fits THIS topic. Every deck must feel different.
You have FULL freedom over slide titles, structure, and which layouts appear.
Write whatever titles are most relevant to the topic — there are no required
slides, no required comparison, no template to follow. Do not reuse the same
structure across topics. Choose each slide's layout based on what the content
on that slide actually is. Two decks on different topics should look visibly
different in their layout sequence and their titles.

TRUTH AND ACCURACY (non-negotiable):
- Everything in the deck must be true or clearly framed as illustrative. NEVER
  fabricate statistics, percentages, dates, data series, quotes, citations, or
  URLs. Inventing a number to fill a chart, or a fake reference to look credible,
  is the worst thing you can do here.
- If you do not have real data, present the idea qualitatively in words. If you
  do not have real sources, return an empty references array. A clean, honest
  deck with no chart and no references beats one padded with fabrications.
- This is what makes the output trustworthy and lets it stand out. Polished AND
  accurate.

Layout palette — pick the BEST fit for each slide's content:
- "title-hero":  opening slide ONLY. This is the FIRST impression — make it fit
  the SPECIFIC topic, never generic. ALWAYS set a "kicker" that names the real
  context (e.g. "Q3 2024 INVESTOR UPDATE", "CS101 LECTURE 4", "SERIES A PITCH"),
  and ALWAYS choose a "titleVariant" that suits the topic and tone. VARY IT —
  do not default to "centered" every time:
    * "asymmetric"  -> pitches, brand/product launches, marketing
    * "numbered"    -> reports, quarterly updates, anything with a date/figure
    * "big-initial" -> stories, keynotes, narrative or personal talks
    * "underlined"  -> a single bold statement or manifesto
    * "centered"    -> formal/academic/government only
  Two decks on different topics must NOT have identical-looking title slides.
- "bullets":     a list of points, ideas, steps, features. 3-6 bullets. The most
  common content layout, but DO NOT make every slide this.
- "chart":       a data chart, when the slide is genuinely about numbers that
  compare or trend AND you know the real figures AND the user hasn't asked for
  a text-only deck. Types: "bar" (compare categories), "line"/"area" (trend over
  time), "pie"/"donut" (parts of a whole). 2-7 real data points. If the user
  chose text-only or no visuals, do NOT use this layout at all.
- "table":       precise tabular data where you ACTUALLY KNOW every value.
  Use only when you can fill EVERY cell with a real, specific entry (feature
  matrix, pricing tiers, spec comparison). If a column would be numbers you
  don't genuinely know (e.g. "Unemployment Rate" with no real figures), DO NOT
  use a table and DO NOT leave cells blank — describe it in bullets instead, or
  use a chart only if you know the real numbers. Never ship a table with an
  empty column or placeholder cells. Always include a real "source".
- "two-column":  a genuine side-by-side comparison of two things that the
  topic NATURALLY splits into. Only use it when the content is actually two
  parallel sets — otherwise use bullets. When you do use it, set "columnLabels"
  to whatever the two sides actually are for THIS topic. Do NOT default to any
  fixed pairing. Pick labels that fit the content. Set
  "twoColumnVariant":"compare" ONLY when it is genuinely upsides vs downsides,
  and only then set columnLabels to {"left":"Pros","right":"Cons"}.
- "quote":       ONLY when the user's prompt explicitly asks for a quote,
  testimonial, or famous saying, and you have a real one. Never insert a quote
  for "variety".
- "section":     a chapter divider with just a short title and an optional one
  line lead-in. Use 0 or 1 per deck, ONLY when the deck has clearly separable
  parts. NEVER put bullets, pros/cons, or lists on a section slide. A section
  slide is a transition, not content.
- "closing":     final slide. Thank-you / Q&A.

HARD RULES on layout choice (this is what makes decks feel custom):
- Vary the layouts. Do NOT use "bullets" for every middle slide. A good 8-slide
  deck might be: hero, bullets, chart, two-column, bullets, table, section?,
  closing — but YOU decide based on the actual content.
- Pros and cons / advantages and disadvantages -> "two-column" with
  twoColumnVariant "compare" and columnLabels {"left":"Pros","right":"Cons"}.
  Use this ONLY when the slide genuinely weighs upsides against downsides AND
  the topic actually calls for it. Most decks need NO comparison slide at all.
  Do not invent one for filler.
- Do NOT lean on any one layout as a habit. A two-column comparison is only
  right when the topic truly has two parallel sides. If it doesn't, use bullets,
  a chart, or a table. There is no requirement to include a comparison slide.
- Numbers that compare or trend can be a chart — but only if you know the real
  figures and the user allows visuals. Otherwise state them in words.
- A "section" slide must contain ONLY a title (+ optional one-line body). If you
  find yourself wanting to put points on it, it should be a "bullets" slide.

Visual variety and meaning (NO random decoration):
- Pick the "bulletsVariant" that matches the content, don't leave everything
  "standard". Use "cards" for a set of distinct pillars/features, "icon-check"
  for benefits or a checklist, "numbered" ONLY for genuinely ordered steps. The
  "cards" and "icon-check" variants read as visual blocks with markers rather
  than a plain numeric list — prefer them over a bare "1. 2. 3." when the points
  aren't strictly sequential.
- For "two-column", set "twoColumnVariant": use "compare" for pros/cons,
  "cards" for two sets of grouped points, "numbered" for paired ordered items.
- Every visual choice must be MEANINGFUL. Never add a chart, card grid, or
  variant just for decoration. If plain bullets communicate best, use them.
- Keep content aligned and tight: short parallel bullets, consistent
  capitalization, no overflowing lines.

Composition rules:
- First slide MUST be "title-hero". Last slide MUST be "closing".
- DO NOT use a "references" layout — it's added automatically.
- Don't repeat the same layout 3+ times in a row.
- Insert "chart"/"table"/"two-column" only where the content earns it. When in
  doubt for generic prose points, use "bullets".

CRITICAL completeness rules:
- EVERY content slide MUST be filled in fully.
- "bullets" / "two-column": "bullets" has at least 3 items.
- "table": "table.rows" has at least 2 rows, "table.headers" not empty, and
  EVERY cell in every row is filled with a real value. No blank cells, no
  empty columns, no "TBD". If you can't fill the whole table with real data,
  don't use a table.
- "chart": "chart.data" has at least 2 points with real numeric values. NEVER
  emit a chart with made-up-looking placeholder numbers; if you don't have
  plausible figures for the topic, use a different layout.
- "quote": "body" has a real relevant quote.
- NEVER output empty arrays or empty bodies. Write fewer slides instead.

Charts — REAL DATA ONLY. This is critical:
- A chart is a factual claim. Only create one when you actually KNOW real,
  verifiable figures for the topic (well-known statistics, widely reported
  market numbers, standard reference values). Examples of acceptable: "global
  smartphone OS market share" (Android ~70%, iOS ~28%), "US GDP by year".
- DO NOT fabricate numbers. Never invent a value, percentage, year-by-year
  series, or "Glacier Mass Loss 2000-2020: 140%" type data. If you are not
  confident the numbers are real and approximately correct, DO NOT make a chart.
  Use bullets to describe the trend qualitatively instead.
- A pie/donut whose slices conveniently sum to 100, or a smooth made-up trend
  line, is almost always fabricated. Do not produce these unless the figures are
  genuinely known.
- When you do chart real data, keep 2-7 points, short labels (1-2 words), plain
  numbers (use "unit" for "%", "M", "k"), and match the type to the data shape
  (bar=categories, line/area=time trend, pie/donut=parts of a whole).
- If a slide's concept is non-numeric (stages, types, principles, steps), it is
  NOT a chart. Use bullets, cards, or two-column.
- It is completely fine to produce a deck with ZERO charts. Most decks should.

Tables:
- Use a table only for real, structured information you are confident about.
- Headers short (1-3 words). Cells short (1-4 words).
- "source" must be a REAL, identifiable source ("World Bank, 2023", "company
  filings"). If you can't name a real source, either leave it out or don't use a
  table. Never write a fake citation.

References — REAL OR NONE:
- Only include references you are genuinely confident are real publications.
  Format: "Author (Year). Title. Publisher/Outlet."
- Include a "url" ONLY if you are confident it is a real, correct link.
  A fabricated or guessed URL is worse than no URL — omit it when unsure.
- If you cannot produce real references for the topic, return an EMPTY
  "references" array. Do NOT invent plausible-looking but fake citations,
  authors, years, or DOIs. Empty is better than fake.
- Quality over quantity: 3 real references beat 8 invented ones.

Text — HARD LIMITS so nothing overflows the 16:9 canvas (13.33 x 7.5in, ~0.6in padding):
- Title: <= 60 characters. Subtitle: <= 100 characters. Split into two slides if needed.
- Body (quote / section lead-in): <= 240 characters.
- Bullets: see density guide. Strict caps. The model often overshoots — DO NOT.
- Notes 2-4 sentences per slide.
- No emojis unless the topic invites them.

Closing slide — strict:
- Title only ("Thank you", "Questions", a short sign-off). Optional subtitle <= 80 chars.
- DO NOT auto-add "Get in touch", emails, phone, social, or CTAs unless the prompt explicitly asks.

Match tone to topic and audience: a startup pitch, a college lecture, a wedding
speech, and an investor update should each feel distinct in layout, language, and
rhythm. Read the user's brief in full. If they specified a structure or named
slides, follow it exactly. Do not paste generic content.`;

/* ============================================================
 * IMPORT MODE
 *
 * Different job from the brief-based generator above. Here the user
 * hands us content they ALREADY wrote (an essay, report, notes, an
 * article) and wants it turned into slides. We must NOT invent a topic
 * or pad with generic filler — we ORGANIZE their material.
 * ============================================================ */
const IMPORT_SYSTEM_PROMPT = `You are SlideGen, a senior presentation designer.
The user is giving you content they ALREADY WROTE. Your job is to turn THAT
content into a clean, well-structured slide deck — not to write a new one.
Output ONLY valid JSON matching the schema. No prose, no markdown.

${/* schema block is shared and appended at call time */ ""}

THE GOLDEN RULE — PRESERVE THEIR CONTENT:
- Work from the user's actual words and ideas. Do NOT replace their content
  with your own generic version of the topic. Every slide must trace back to
  something the user actually wrote.
- You MAY: split long paragraphs into slides, turn prose into tight bullet
  points, write a short slide title and a subtitle for each section, reorder
  lightly for flow, and lift real numbers/lists into a chart or table.
- You MUST NOT: invent facts, statistics, quotes, or sources that aren't in
  their text; drop whole sections; or summarize so hard the meaning is lost.
- Condense wordy prose into scannable bullets, but keep the substance. If the
  user wrote a specific figure, name, date, or example, keep it.

YOU decide everything about the shape:
- Read the whole input first. Figure out its natural sections, then decide how
  many slides it needs — use as many or as few as the content calls for. Do not
  force a number. A long document becomes more slides; a short one, fewer.
- Decide each slide's TITLE yourself from the content of that section. Write a
  SUBTITLE where it adds clarity. There is no fixed structure or template.
- Choose each slide's layout from the palette based on what that section's
  content actually is (prose -> bullets; a real comparison the text makes ->
  two-column; numbers the text states -> chart or table; a line the user
  clearly meant as a pull-quote -> quote). Don't force any layout.
- Derive the deck title and subtitle from the document itself (use its real
  heading/thesis if it has one).

Charts and tables in import mode: ONLY build one from numbers/rows the user
ACTUALLY provided in their text. Never fabricate data to make a chart. If the
text has no real figures, present it as bullets.

First slide MUST be "title-hero" (titled from the document). Last slide MUST be
"closing". Do NOT use a "references" layout — it's added automatically. Respect
all the text/length caps and completeness rules below.`;

function buildImportSchemaPrompt() {
  // Reuse the exact schema + layout palette + rules from the main system
  // prompt so import-mode output is validated identically. The main prompt's
  // schema section is everything between "Schema:" and the closing tone line.
  const schemaStart = SYSTEM_PROMPT.indexOf("Schema:");
  const rulesTail = SYSTEM_PROMPT.slice(schemaStart);
  return `${IMPORT_SYSTEM_PROMPT}\n\n${rulesTail}`;
}


function buildUserMessage(opts: {
  prompt: string;
  slideCount: number;
  audience?: string;
  tone?: string;
  density: ContentDensity;
  includeReferences: boolean;
  directives?: string;
}) {
  const refLine = opts.includeReferences
    ? `For "references": include ONLY real, verifiable sources you are confident exist. If you are not confident, return an empty references array. Never fabricate citations or URLs.`
    : `Set "references" to an empty array — the user does not want a references slide.`;

  // The clarify-step answers are the user's explicit choices. They OVERRIDE
  // any default behavior in the system prompt. If the user said text-only,
  // there are NO charts, period — even if a slide has numbers.
  const directivesBlock = opts.directives && opts.directives.trim()
    ? `\n\n=========================================================
THE USER'S EXPLICIT CHOICES — THESE OVERRIDE EVERYTHING ELSE.
Follow each of these to the letter. If a choice conflicts with a
default instruction in your system prompt, the USER'S CHOICE WINS.
${opts.directives.trim()}
- If the user chose text-only / no visuals: output ZERO chart slides and
  ZERO table slides. Express any numbers in words inside bullets instead.
=========================================================\n`
    : "";

  return `Create EXACTLY a ${opts.slideCount}-slide presentation. Output exactly ${opts.slideCount} entries in "slides". Not fewer. Not more.
${directivesBlock}
You decide the structure. The only fixed rules: slide 1 is "title-hero",
slide ${opts.slideCount} is "closing". For every slide in between, YOU choose the
title, the layout, and the content based on what actually serves the topic and
the user's choices above. Don't follow a template. Don't force any layout.

${DENSITY_GUIDE[opts.density]}

${refLine}

Read the user's brief in full and use every relevant detail. If they listed sections, topics, or an order, honor each one. Fill each slide with real, substantive content — never leave a slide thin or a field empty. Write to the density target above; do not under-fill.

User's brief:
"""
${opts.prompt}
"""

Audience: ${opts.audience || "general"}
Tone: ${opts.tone || "professional, clear, engaging"}

Return ONLY the JSON object. The "slides" array MUST have exactly ${opts.slideCount} entries.`;
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

  // Reject tables with an entirely-empty column. A table where, say, the
  // "Unemployment Rate" column is blank in every row is worse than no table.
  // The model is told not to do this, but this guards against it anyway —
  // the slide then falls through to the bullet fill pass.
  for (let col = 0; col < headers.length; col++) {
    const everyCellBlank = rows.every((r: string[]) => !r[col] || r[col].trim() === "");
    if (everyCellBlank) return undefined;
  }

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

/** Drop exact duplicate bullets (case/whitespace-insensitive), keeping the
 *  first occurrence and original order. The model occasionally repeats a
 *  point near-verbatim; removing exact dupes never loses unique content. */
function dedupeBullets(bullets: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of bullets) {
    const key = b.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

/** Map one raw model slide object to a clean, validated Slide. Shared by
 *  the prompt path and the import-from-content path so both apply the same
 *  layout validation, variant whitelisting, and text cleaning. */
function mapRawSlide(s: any, i: number, total: number): Slide {  const rawLayout = s.layout;
  const layout: SlideLayout = VALID_LAYOUTS.includes(rawLayout)
    ? rawLayout
    : i === 0 ? "title-hero"
    : i === total - 1 ? "closing"
    : "bullets";

  return {
    layout: layout === "references" ? ("bullets" as SlideLayout) : layout,
    title: clean(s.title),
    subtitle: s.subtitle ? clean(s.subtitle) : undefined,
    bullets: Array.isArray(s.bullets) ? dedupeBullets(s.bullets.map(clean).filter(Boolean)) : [],
    body: s.body ? clean(s.body) : undefined,
    table: cleanTable(s.table),
    chart: cleanChartSpec(s.chart),
    notes: s.notes ? clean(s.notes) : undefined,
    kicker: s.kicker ? clean(s.kicker).toUpperCase().slice(0, 60) : undefined,
    titleVariant:
      s.titleVariant === "asymmetric"  ? "asymmetric"  :
      s.titleVariant === "big-initial" ? "big-initial" :
      s.titleVariant === "numbered"    ? "numbered"    :
      s.titleVariant === "underlined"  ? "underlined"  :
      s.titleVariant === "editorial-serif" ? "editorial-serif" :
      s.titleVariant === "centered"    ? "centered"    : undefined,
    bulletsVariant:
      ["standard", "numbered", "cards", "icon-check", "dashed"].includes(s.bulletsVariant)
        ? s.bulletsVariant : undefined,
    twoColumnVariant:
      ["classic", "divider", "cards", "numbered", "compare"].includes(s.twoColumnVariant)
        ? s.twoColumnVariant : undefined,
    columnLabels:
      s.columnLabels && typeof s.columnLabels === "object"
        && typeof s.columnLabels.left === "string" && typeof s.columnLabels.right === "string"
        ? { left: clean(s.columnLabels.left).slice(0, 28), right: clean(s.columnLabels.right).slice(0, 28) }
        : undefined,
    annotations: [],
  };
}

/** A slide is empty if its layout-specific content field is missing. */
function isEmptySlide(s: Slide): boolean {
  if (s.layout === "title-hero" || s.layout === "closing") return !s.title;
  if (s.layout === "section") return !s.title || !s.body;
  if (s.layout === "quote") return !s.body;
  if (s.layout === "table") return !s.table || s.table.rows.length === 0;
  if (s.layout === "chart") return !s.chart || s.chart.data.length < 2;
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
Output ONLY a JSON object: { "fills": [ { "index": number, "title"?: string, "bullets"?: string[], "body"?: string, "table"?: {headers, rows, source}, "subtitle"?: string } ] }.
For each target slide, provide the right content for its layout, written specifically for the deck topic and audience. NEVER return empty arrays. NEVER write placeholder filler.

Cover different angles of the topic across the slides — do not repeat the same idea on multiple slides. The reader should learn something new on each one.`;

  const user = `Deck topic: "${deck.topic || deck.title}"
Deck title: "${deck.title}"
Audience: ${deck.audience || "general"}
Tone: ${deck.tone || "professional"}
Density: ${deck.density || "balanced"}

Existing slides (so you don't duplicate content):
${JSON.stringify(deck.slides.map((s, i) => ({ i, layout: s.layout, title: s.title, bulletsPreview: (s.bullets || []).slice(0, 2) })), null, 2)}

Slides needing content:
${JSON.stringify(targets, null, 2)}

Rules per layout:
- bullets / two-column: produce 3-5 concrete bullets (10-18 words each), specific to the deck topic. Each slide should focus on a distinct sub-topic. If the slide has no title, also propose a short title.
- table: 3-5 rows with appropriate headers and a real-sounding "Author/Org, Year" source line.
- quote: a relevant real quote in "body" with attribution in "subtitle".
- section: a short body line and an evocative title.
- title-hero / closing: not expected here; skip.

Return ONLY the JSON.`;

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.4,
      // Same TPM constraint applies; fill pass usually only patches a
      // handful of slides so 3000 is plenty.
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
    if (typeof fill.title === "string" && fill.title.trim()) updated.title = clean(fill.title);
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
  /** Hard user directives from the pre-generation clarify step. */
  directives?: string;
}): Promise<Deck> {
  const density: ContentDensity = opts.density || "balanced";
  const includeReferences = opts.includeReferences !== false;

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.55,
      // Scout on the paid tier allows ~300k TPM / 1k RPM, so there's ample
      // headroom. 8000 output tokens lets even a 20-slide deck return in one
      // pass without truncation; the pad-and-fill-empty-slides net below
      // stays only as a backstop.
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage({ ...opts, density, includeReferences, directives: opts.directives }) },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "";
  const parsed = JSON.parse(extractJson(raw));

  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error("Model returned no slides.");
  }

  const slides: Slide[] = parsed.slides.map((s: any, i: number) =>
    mapRawSlide(s, i, parsed.slides.length),
  );

  if (slides[0]) slides[0].layout = "title-hero";
  if (slides.length > 1) slides[slides.length - 1].layout = "closing";

  // A "chart" slide with no usable chart data is useless — the fill pass
  // can't author charts. Downgrade it to bullets so it still gets content.
  for (let i = 1; i < slides.length - 1; i++) {
    if (slides[i].layout === "chart" && (!slides[i].chart || slides[i].chart!.data.length < 2)) {
      slides[i].layout = "bullets";
      slides[i].chart = undefined;
    }
  }

  // A "table" slide whose table was rejected (empty column, no rows, or the
  // model couldn't fill it with real data) becomes bullets so the fill pass
  // writes real content instead of leaving a half-empty grid.
  for (let i = 1; i < slides.length - 1; i++) {
    if (slides[i].layout === "table" && !slides[i].table) {
      slides[i].layout = "bullets";
    }
  }

  // PAD: if the model returned fewer slides than asked, insert empty bullet
  // slides in the middle and have the fill pass write content for them.
  // This is a safety net — the prompt also tells the model to output
  // exactly opts.slideCount slides, but we don't trust it 100%.
  while (slides.length < opts.slideCount) {
    const insertAt = Math.max(1, slides.length - 1); // before the closing
    slides.splice(insertAt, 0, {
      layout: "bullets",
      title: "",
      bullets: [],
      annotations: [],
    });
  }

  // TRIM: if the model returned more, drop extras from the middle (keep
  // hero and closing).
  if (slides.length > opts.slideCount) {
    const trimmed = [
      slides[0],
      ...slides.slice(1, slides.length - 1).slice(0, opts.slideCount - 2),
      slides[slides.length - 1],
    ];
    slides.length = 0;
    slides.push(...trimmed);
  }

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

/* ============================================================
 * IMPORT: build a deck from the user's OWN content.
 *
 * The model organizes the supplied text into slides — it decides the
 * count, titles, subtitles, and layouts. We do NOT pad/trim to a fixed
 * count here (the whole point is to honor the content's natural shape),
 * but we keep the same cleaning, the empty-slide fill backstop, and the
 * chart/table downgrade guards.
 * ============================================================ */
export async function generateDeckFromContent(opts: {
  /** The user's raw pasted/uploaded content. Preserved, not invented. */
  sourceText: string;
  /** Optional one-liner about intent/audience (e.g. "for my class"). */
  prompt?: string;
  audience?: string;
  tone?: string;
  density?: ContentDensity;
  includeReferences?: boolean;
  /** Hard user directives from the pre-generation clarify step. */
  directives?: string;
  /** Optional cap so a huge paste doesn't run forever. 0 = let AI decide. */
  maxSlides?: number;
}): Promise<Deck> {
  const density: ContentDensity = opts.density || "balanced";
  const includeReferences = opts.includeReferences !== false;
  // Guard the token budget: trim absurdly large pastes. ~24k chars is plenty
  // of source for a long deck and stays well within the model's context.
  const source = opts.sourceText.trim().slice(0, 24000);

  const directivesBlock = opts.directives && opts.directives.trim()
    ? `\n=========================================================
THE USER'S EXPLICIT CHOICES — THESE OVERRIDE EVERYTHING ELSE.
${opts.directives.trim()}
- If the user chose text-only / no visuals: output ZERO chart and ZERO
  table slides. Express any numbers in words inside bullets instead.
=========================================================\n`
    : "";

  const refLine = includeReferences
    ? `For "references": include ONLY sources that actually appear in the user's content. Do not invent any. If none are present, return an empty array.`
    : `Set "references" to an empty array.`;

  const countLine = opts.maxSlides && opts.maxSlides > 0
    ? `Use as many slides as the content needs, up to a maximum of ${opts.maxSlides}.`
    : `Use as many slides as the content genuinely needs — do not force a number.`;

  const intentLine = opts.prompt && opts.prompt.trim()
    ? `What the user wants this presentation for: "${opts.prompt.trim()}"\n`
    : "";

  const user = `Turn the content below into a presentation. Organize THE USER'S OWN
content — do not replace it with a generic take on the topic, and do not drop
sections. ${countLine}
${directivesBlock}
${intentLine}${DENSITY_GUIDE[density]}

${refLine}

You decide the deck title, every slide's title and subtitle, the layout of each
slide, and the order. Slide 1 is "title-hero" (titled from the document), the
last slide is "closing". Turn dense prose into tight, scannable bullets while
keeping the real substance, figures, names, and examples the user wrote.

Audience: ${opts.audience || "infer from the content"}
Tone: ${opts.tone || "match the content's own voice"}

THE USER'S CONTENT:
"""
${source}
"""

Return ONLY the JSON object.`;

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.4, // lower than the brief path: stay close to their words
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildImportSchemaPrompt() },
        { role: "user", content: user },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "";
  const parsed = JSON.parse(extractJson(raw));

  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error("Model returned no slides.");
  }

  let slides: Slide[] = parsed.slides.map((s: any, i: number) =>
    mapRawSlide(s, i, parsed.slides.length),
  );

  // Clamp to a sane window so a runaway response can't produce 80 slides.
  const hardCap = Math.min(40, opts.maxSlides && opts.maxSlides > 0 ? opts.maxSlides : 40);
  if (slides.length > hardCap) {
    slides = [
      slides[0],
      ...slides.slice(1, slides.length - 1).slice(0, hardCap - 2),
      slides[slides.length - 1],
    ];
  }

  if (slides[0]) slides[0].layout = "title-hero";
  if (slides.length > 1) slides[slides.length - 1].layout = "closing";

  // Same guards as the brief path: a chart/table the model couldn't back with
  // real data downgrades to bullets so the slide still carries content.
  for (let i = 1; i < slides.length - 1; i++) {
    if (slides[i].layout === "chart" && (!slides[i].chart || slides[i].chart!.data.length < 2)) {
      slides[i].layout = "bullets";
      slides[i].chart = undefined;
    }
    if (slides[i].layout === "table" && !slides[i].table) {
      slides[i].layout = "bullets";
    }
  }

  // Drop noise quote slides.
  for (let i = slides.length - 2; i > 0; i--) {
    const s = slides[i];
    if (s.layout === "quote") {
      const body = (s.body || "").trim();
      const looksReal = body.length >= 12 && /[a-zA-Z]/.test(body) && !/^[a-z]{8,}$/.test(body);
      if (!looksReal) slides.splice(i, 1);
    }
  }

  const tentative: Deck = {
    title: clean(parsed.title) || "Untitled Deck",
    subtitle: parsed.subtitle ? clean(parsed.subtitle) : undefined,
    slides,
    topic: (opts.prompt && opts.prompt.trim()) || clean(parsed.title) || "Imported content",
    audience: opts.audience,
    tone: opts.tone,
    density,
  };

  // Backstop fill for any slide the model left thin.
  const emptyIndices = slides
    .map((s, i) => (i === 0 || i === slides.length - 1 ? -1 : isEmptySlide(s) ? i : -1))
    .filter((i) => i >= 0);

  let filledSlides = slides;
  if (emptyIndices.length > 0) {
    try {
      filledSlides = await fillEmptySlides(tentative, emptyIndices);
    } catch (e) {
      console.warn("[generateDeckFromContent] fill pass failed:", e);
    }
  }

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

  return {
    title: tentative.title,
    subtitle: tentative.subtitle,
    slides: filledSlides,
    references: includeReferences ? references : [],
    includeReferences,
  };
}

/* ----------------------------- speaker notes ------------------------------ */

const SPEAKER_NOTES_SYSTEM = `You are a presentation coach writing speaker notes.
For each slide you are given, write what the presenter should SAY OUT LOUD while
that slide is on screen. This is a spoken script, not a rewrite of the slide.

Output ONLY valid JSON. No prose, no markdown.

Schema:
{
  "notes": [
    { "index": number, "script": string }
  ]
}

RULES:
- Return exactly one entry per slide, using the slide's "index" from the input.
- "script" is 2-4 natural spoken sentences (roughly 30-70 words). It should
  sound like a person talking, not bullet points read aloud.
- Expand on the slide — add a transition, a bit of context, or an example. Do
  NOT just restate the title and bullets verbatim.
- Match the deck's audience and tone. No emojis. No stage directions like
  "(pause)". No headings. Just the words to speak.
- Never invent statistics, dates, or sources that aren't implied by the slide.
- The first slide is the opening: greet/hook the audience. The last slide is
  the close: wrap up and invite questions if appropriate.`;

const SPEAKER_NOTES_SYSTEM_MULTI = `You are a presentation coach writing speaker notes for a GROUP presentation.
For each slide, write what the presenters should SAY OUT LOUD, divided among
the named presenters. This is a spoken script, not a rewrite of the slide.

Output ONLY valid JSON. No prose, no markdown.

Schema:
{
  "notes": [
    {
      "index": number,
      "segments": [
        { "speaker": string, "text": string }
      ]
    }
  ]
}

RULES:
- Return exactly one entry per slide, using the slide's "index" from the input.
- "segments" splits that slide's spoken script between the named presenters.
  Use the EXACT speaker names provided, spelled the same way.
- Most slides should be spoken by ONE presenter (one segment) so the handoff
  isn't frantic. Hand off to the next presenter between slides or on longer
  slides. Over the whole deck, balance the talking time roughly evenly and
  give every presenter a fair share.
- Go through the presenters in the given order across the deck, looping back as
  needed. Don't make one person do everything.
- Each segment's "text" is natural spoken sentences (roughly 30-70 words for a
  full-slide segment). Sound like a person talking, not bullets read aloud.
- Expand on the slide with a transition, context, or an example. Do NOT just
  restate the title and bullets verbatim.
- Match the deck's audience and tone. No emojis, no stage directions, no
  headings. Just the words to speak.
- Never invent statistics, dates, or sources not implied by the slide.
- The first presenter on slide 0 opens with a greeting suited to the setting,
  then introduces the team if natural. The final slide closes and may invite
  questions.`;

export type SlideNote = { index: number; script: string; segments?: { speaker: string; text: string }[] };

/**
 * Generate spoken speaker notes for every slide in a deck. Returns one
 * script per slide index. Used by /api/speaker-notes — the editor folds
 * the scripts into each slide's `notes` field, which also flows through to
 * the PPTX export and the presenter teleprompter.
 *
 * When `speakers` is provided (group presentations), each slide's script is
 * divided across the named presenters and returned as `segments` too.
 */
export async function generateSpeakerNotes(opts: {
  deck: Deck;
  audience?: string;
  tone?: string;
  speakers?: string[];
  setting?: string;
}): Promise<SlideNote[]> {
  const { deck } = opts;
  const audience = opts.audience || deck.audience || "a general audience";
  const tone = opts.tone || deck.tone || "clear and professional";
  const speakers = (opts.speakers || [])
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const multiSpeaker = speakers.length >= 2;

  // Compact, plain-text view of each slide so the model has enough to write a
  // script without blowing the token budget on a huge deck.
  const slidesForModel = deck.slides.map((s, i) => {
    const parts: string[] = [];
    if (s.title) parts.push(`title: ${stripPlain(s.title)}`);
    if (s.subtitle) parts.push(`subtitle: ${stripPlain(s.subtitle)}`);
    if (s.bullets?.length) parts.push(`bullets: ${s.bullets.map(stripPlain).join(" | ")}`);
    if (s.body) parts.push(`body: ${stripPlain(s.body)}`);
    if (s.table?.headers?.length) parts.push(`table columns: ${s.table.headers.map(stripPlain).join(", ")}`);
    if (s.chart?.title) parts.push(`chart: ${stripPlain(s.chart.title)}`);
    return { index: i, layout: s.layout, content: parts.join("\n") || "(no text)" };
  });

  const system = multiSpeaker ? SPEAKER_NOTES_SYSTEM_MULTI : SPEAKER_NOTES_SYSTEM;
  const speakerBlock = multiSpeaker
    ? `\nPresenters (split each slide's script between these people, in order, balancing the load): ${speakers.join(", ")}.\nSetting / occasion: ${opts.setting?.trim() || "a presentation"}.\nOpen the very first slide with an audience-appropriate greeting for this setting.`
    : "";

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Deck title: ${deck.title}
Audience: ${audience}
Tone: ${tone}
Total slides: ${deck.slides.length}${speakerBlock}

Slides:
${JSON.stringify(slidesForModel, null, 2)}

Write the speaker notes. Return ONLY the JSON.`,
        },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    parsed = {};
  }

  const list: any[] = Array.isArray(parsed?.notes) ? parsed.notes : [];
  const byIndex = new Map<number, { script: string; segments?: { speaker: string; text: string }[] }>();
  for (const n of list) {
    const idx = Number(n?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= deck.slides.length) continue;

    if (multiSpeaker && Array.isArray(n?.segments)) {
      const segments = n.segments
        .map((seg: any) => ({
          speaker: typeof seg?.speaker === "string" ? seg.speaker.trim().slice(0, 60) : "",
          text: typeof seg?.text === "string" ? seg.text.trim().slice(0, 600) : "",
        }))
        .filter((seg: { speaker: string; text: string }) => seg.speaker && seg.text);
      if (segments.length) {
        const script = segments.map((seg: { speaker: string; text: string }) => `${seg.speaker}: ${seg.text}`).join("\n");
        byIndex.set(idx, { script, segments });
        continue;
      }
    }

    const script = typeof n?.script === "string" ? n.script.trim() : "";
    if (script) byIndex.set(idx, { script: script.slice(0, 600) });
  }

  // Emit one entry per slide; keep any existing note as a fallback when the
  // model skipped a slide so we never blank out work the user already had.
  return deck.slides.map((s, i) => {
    const got = byIndex.get(i);
    if (got) return { index: i, script: got.script, segments: got.segments };
    return { index: i, script: (s.notes || "").trim() };
  });
}

/** Collapse inline HTML / whitespace to a plain spoken-friendly string. */
function stripPlain(s: string): string {
  return (s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------- translation ------------------------------ */

/**
 * Translate a whole deck in place. We collect every user-visible string into
 * a flat list, translate just the strings, then map them back onto a clone of
 * the deck. This keeps layout, theme, charts, positions, and structure exactly
 * as-is — only the text changes.
 */
export async function translateDeck(opts: {
  deck: Deck;
  targetLanguage: string;
}): Promise<Deck> {
  const { deck, targetLanguage } = opts;
  const lang = (targetLanguage || "").trim();
  if (!lang) return deck;

  // 1. Collect strings with stable indices. setters[] knows how to write each
  //    translated string back onto the cloned deck.
  const next: Deck = JSON.parse(JSON.stringify(deck));
  const items: string[] = [];
  const setters: ((v: string) => void)[] = [];

  const push = (value: string | undefined | null, set: (v: string) => void) => {
    if (typeof value === "string" && value.trim()) {
      items.push(value);
      setters.push(set);
    }
  };

  push(next.title, (v) => { next.title = v; });
  push(next.subtitle, (v) => { next.subtitle = v; });

  next.slides.forEach((s) => {
    push(s.title, (v) => { s.title = v; });
    push(s.subtitle, (v) => { s.subtitle = v; });
    push(s.kicker, (v) => { s.kicker = v; });
    push(s.body, (v) => { s.body = v; });
    if (Array.isArray(s.bullets)) {
      s.bullets.forEach((b, bi) => push(b, (v) => { s.bullets![bi] = v; }));
    }
    if (s.columnLabels) {
      push(s.columnLabels.left, (v) => { s.columnLabels!.left = v; });
      push(s.columnLabels.right, (v) => { s.columnLabels!.right = v; });
    }
    if (s.table) {
      s.table.headers.forEach((h, hi) => push(h, (v) => { s.table!.headers[hi] = v; }));
      s.table.rows.forEach((row, ri) =>
        row.forEach((c, ci) => push(c, (v) => { s.table!.rows[ri][ci] = v; })),
      );
      push(s.table.source, (v) => { s.table!.source = v; });
    }
    if (s.chart) {
      push(s.chart.title, (v) => { s.chart!.title = v; });
      s.chart.data?.forEach((d, di) => push(d.label, (v) => { s.chart!.data[di].label = v; }));
    }
    if (Array.isArray(s.annotations)) {
      s.annotations.forEach((a, ai) => push(a.text, (v) => { s.annotations![ai].text = v; }));
    }
    if (Array.isArray(s.textBoxes)) {
      s.textBoxes.forEach((t, ti) => push(t.text, (v) => { s.textBoxes![ti].text = v; }));
    }
    push(s.notes, (v) => { s.notes = v; });
    if (Array.isArray(s.noteSegments)) {
      s.noteSegments.forEach((seg, si) => push(seg.text, (v) => { s.noteSegments![si].text = v; }));
    }
  });

  if (items.length === 0) return next;

  // 2. Translate in batches so a huge deck doesn't blow the token budget or
  //    truncate the JSON response.
  const BATCH = 60;
  for (let start = 0; start < items.length; start += BATCH) {
    const slice = items.slice(start, start + BATCH);
    const translated = await translateStrings(slice, lang);
    translated.forEach((t, i) => {
      const setter = setters[start + i];
      if (setter && typeof t === "string" && t.trim()) setter(t);
    });
  }

  return next;
}

/**
 * Rewrite a whole deck at a new content density. Only the bullet content of
 * bullet-bearing slides changes — titles, layouts, charts, tables, theme,
 * structure, and order stay exactly as-is. The meaning is preserved; only the
 * number of bullets and how long/detailed each one is gets adjusted to match
 * the target density. Premium feature.
 */
export async function redensifyDeck(opts: {
  deck: Deck;
  density: ContentDensity;
}): Promise<Deck> {
  const { deck, density } = opts;
  const next: Deck = JSON.parse(JSON.stringify(deck));

  // Collect slides that carry bullets (bullets / two-column layouts). Density
  // is a property of bullet content; hero/closing/quote/section/chart/table
  // slides are left untouched.
  const targets: { index: number; title: string; bullets: string[] }[] = [];
  next.slides.forEach((s, i) => {
    if (Array.isArray(s.bullets) && s.bullets.length > 0) {
      targets.push({
        index: i,
        title: stripPlain(s.title || ""),
        bullets: s.bullets.map((b) => stripPlain(b)).filter(Boolean),
      });
    }
  });

  if (targets.length === 0) {
    next.density = density;
    return next;
  }

  const BATCH = 8;
  for (let start = 0; start < targets.length; start += BATCH) {
    const slice = targets.slice(start, start + BATCH);
    const rewritten = await redensifyBatch(slice, density, {
      audience: deck.audience,
      tone: deck.tone,
    });
    for (const r of rewritten) {
      const slide = next.slides[r.index];
      if (slide && Array.isArray(r.bullets) && r.bullets.length > 0) {
        slide.bullets = r.bullets.map((b) => String(b).slice(0, 220));
      }
    }
  }

  next.density = density;
  return next;
}

/** Rewrite one batch of slides' bullets to the target density. */
async function redensifyBatch(
  slides: { index: number; title: string; bullets: string[] }[],
  density: ContentDensity,
  ctx: { audience?: string; tone?: string },
): Promise<{ index: number; bullets: string[] }[]> {
  const system = `You rewrite slide bullet points to a target information density.
You MUST keep the same topic, meaning, and intent for each slide — you only
change how MANY bullets there are and how long/detailed each bullet is.

${DENSITY_GUIDE[density]}

Output ONLY JSON: { "slides": [ { "index": number, "bullets": string[] } ] }.

Rules:
- Return every slide given, with the SAME "index". Do not drop or merge slides.
- Keep bullets faithful to the slide's title and the original bullets' meaning.
  When EXPANDING, add genuine reasoning, detail, or examples that follow from
  the original — never invent fake statistics, dates, names, or sources.
  When CONDENSING, keep the most important points and tighten the wording.
- Obey the density's bullet COUNT and LENGTH targets strictly.
- Plain text only: no markdown, no numbering prefixes, no emojis, no commentary.`;

  const payload = {
    audience: ctx.audience || "general",
    tone: ctx.tone || "professional",
    slides: slides.map((s) => ({ index: s.index, title: s.title, bullets: s.bullets })),
  };

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.3,
      max_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Rewrite these slides' bullets to the target density.\n${JSON.stringify(payload)}\n\nReturn ONLY the JSON.` },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return []; // on parse failure, leave the originals untouched
  }

  const list: any[] = Array.isArray(parsed?.slides) ? parsed.slides : [];
  const out: { index: number; bullets: string[] }[] = [];
  for (const it of list) {
    const idx = Number(it?.index);
    const bullets = Array.isArray(it?.bullets)
      ? it.bullets.map((b: any) => (typeof b === "string" ? b.trim() : "")).filter(Boolean)
      : [];
    if (Number.isInteger(idx) && bullets.length > 0) out.push({ index: idx, bullets });
  }
  return out;
}

/** Translate an ordered list of strings, preserving order and count. */
async function translateStrings(strings: string[], targetLanguage: string): Promise<string[]> {
  const numbered = strings.map((s, i) => ({ i, text: s }));
  const system = `You are a professional translator. Translate each string's "text" into ${targetLanguage}.
Output ONLY JSON: { "items": [ { "i": number, "text": string } ] }.
Rules:
- Return every item, same "i", same order, same count.
- Translate naturally and idiomatically, not word-for-word.
- Preserve any inline HTML tags (<b>, <i>, <span ...>), numbers, URLs, emails,
  and proper nouns/brand names. Translate the human-readable text around them.
- Do NOT add, merge, split, or drop items. Do NOT add commentary.`;

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.2,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Translate into ${targetLanguage}:\n${JSON.stringify({ items: numbered })}\n\nReturn ONLY the JSON.` },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return strings; // fall back to originals on parse failure
  }

  const out = [...strings];
  const list: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
  for (const it of list) {
    const idx = Number(it?.i);
    const text = typeof it?.text === "string" ? it.text : "";
    if (Number.isInteger(idx) && idx >= 0 && idx < out.length && text.trim()) {
      out[idx] = text;
    }
  }
  return out;
}

/* -------------------------------- Q&A prep -------------------------------- */

export type QAItem = { category: string; question: string; answer: string };

const QA_SYSTEM = `You are a presentation coach preparing the speaker for audience questions.
Read the deck and produce the toughest, most likely questions an audience or
reviewer would ask, each with a strong suggested answer the speaker can give.

Output ONLY valid JSON. No prose, no markdown.

Schema:
{
  "items": [
    { "category": string, "question": string, "answer": string }
  ]
}

RULES:
- Produce 6-10 questions. Make them genuinely challenging, not softballs.
- "category" is a short tag: one of "Clarifying", "Challenging", "Evidence",
  "Scope", "Implementation", "Risk", "Cost", "Comparison". Pick what fits.
- Cover different angles: definitions/clarifications, push-back on claims,
  requests for data or evidence, edge cases, feasibility, and trade-offs.
- "answer" is 2-3 sentences the speaker can actually say, grounded in the
  deck's content. Confident but honest. If the deck lacks data to answer,
  suggest how to respond gracefully rather than inventing numbers.
- Match the deck's audience and tone. No emojis, no markdown, no headings.`;

const QA_ANSWER_SYSTEM = `You are a presentation coach. The speaker gives you ONE question an audience
member might ask about their deck. Write a strong, concise answer the speaker
can say out loud, grounded in the deck's content.

Output ONLY valid JSON: { "answer": string }.

RULES:
- 2-4 sentences. Confident, natural, spoken — not an essay.
- Ground it in the deck. If the deck doesn't contain the needed facts, say how
  to answer gracefully instead of inventing statistics, dates, or sources.
- Match the deck's audience and tone. No emojis, no markdown, no headings.`;

/** Compact plain-text view of a deck for Q&A prompts. */
function deckDigest(deck: Deck): string {
  const lines: string[] = [`Deck: ${stripPlain(deck.title)}`];
  if (deck.subtitle) lines.push(`Subtitle: ${stripPlain(deck.subtitle)}`);
  deck.slides.forEach((s, i) => {
    const parts: string[] = [];
    if (s.title) parts.push(stripPlain(s.title));
    if (s.subtitle) parts.push(stripPlain(s.subtitle));
    if (s.bullets?.length) parts.push(s.bullets.map(stripPlain).join("; "));
    if (s.body) parts.push(stripPlain(s.body));
    if (s.table?.headers?.length) parts.push(`table: ${s.table.headers.map(stripPlain).join(", ")}`);
    if (s.chart?.title) parts.push(`chart: ${stripPlain(s.chart.title)}`);
    lines.push(`${i + 1}. ${parts.join(" — ") || "(no text)"}`);
  });
  return lines.join("\n").slice(0, 6000);
}

/** Generate a set of likely audience questions with suggested answers. */
export async function generateQAPrep(opts: {
  deck: Deck;
  audience?: string;
  tone?: string;
}): Promise<QAItem[]> {
  const { deck } = opts;
  const audience = opts.audience || deck.audience || "a general audience";
  const tone = opts.tone || deck.tone || "clear and professional";

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.55,
      max_tokens: 3500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: QA_SYSTEM },
        {
          role: "user",
          content: `Audience: ${audience}\nTone: ${tone}\n\n${deckDigest(deck)}\n\nGenerate the Q&A prep. Return ONLY the JSON.`,
        },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    parsed = {};
  }
  const list: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
  return list
    .map((it) => ({
      category: typeof it?.category === "string" ? it.category.trim().slice(0, 24) : "Question",
      question: typeof it?.question === "string" ? it.question.trim().slice(0, 300) : "",
      answer: typeof it?.answer === "string" ? it.answer.trim().slice(0, 800) : "",
    }))
    .filter((it) => it.question && it.answer)
    .slice(0, 12);
}

/** Answer a single user-supplied question about the deck. */
export async function answerDeckQuestion(opts: {
  deck: Deck;
  question: string;
  audience?: string;
  tone?: string;
}): Promise<string> {
  const { deck } = opts;
  const question = (opts.question || "").trim().slice(0, 400);
  if (!question) return "";
  const audience = opts.audience || deck.audience || "a general audience";
  const tone = opts.tone || deck.tone || "clear and professional";

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: QA_ANSWER_SYSTEM },
        {
          role: "user",
          content: `Audience: ${audience}\nTone: ${tone}\n\n${deckDigest(deck)}\n\nQuestion: "${question}"\n\nReturn ONLY the JSON.`,
        },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(extractJson(raw));
    return typeof parsed?.answer === "string" ? parsed.answer.trim().slice(0, 800) : "";
  } catch {
    return "";
  }
}


/* -------------------------------- Visuals -------------------------------- */

/**
 * Turn a short description of a topic or dataset into a single chart spec
 * with realistic, plausible data. If `type` is given the chart uses it;
 * otherwise the model picks the best-fitting type. Returns undefined when
 * the model can't produce a usable chart.
 */
export async function generateChart(opts: {
  description: string;
  type?: ChartType;
}): Promise<ChartSpec | undefined> {
  const desc = (opts.description || "").trim().slice(0, 600);
  if (!desc) return undefined;

  const typeHint = opts.type
    ? `Use chart type "${opts.type}".`
    : `Choose the chart type that best fits the data (bar, line, area, pie, or donut).`;

  const system = `You build ONE data chart for a slide. Accuracy and honesty about the data are the absolute priority. You have no live internet — use only what you actually know from training.

Follow this algorithm IN ORDER:

1. RECALL: Decide whether you genuinely know real, factual figures for this topic from your training (world/economic/scientific statistics, historical series, well-known public figures, etc.).

2. KNOWN DATA → use the real, accurate values you remember. Do not fabricate precision you don't have; round sensibly. Set "dataQuality":"actual" and put the source + coverage in "note" (e.g. "World Bank · global · through 2021").

3. RECENT / FUTURE beyond your knowledge (e.g. "latest", this year, next year): still include those periods, but mark each such point "estimated": true and base it on the REAL historical trend you know — a reasoned projection, never a random guess. Set "dataQuality":"projected" (or "mixed" if some points are real and some projected) and explain in "note" (e.g. "through 2021 actual; 2022–2025 projected from trend").

4. NO REAL BASIS (private/internal numbers like "our revenue", obscure or fictional topics you can't know): produce clearly illustrative placeholder values, set "dataQuality":"estimated", and in "note" say the figures are illustrative and should be replaced with the user's real data.

HARD RULES:
- NEVER present estimated or projected numbers as established facts.
- NEVER invent specific real-world statistics you do not actually remember. If unsure of exact values, prefer fewer points you're confident in, or mark them estimated.
- The "note" must honestly tell the viewer where the numbers come from.

Output ONLY JSON:
{
  "type": "bar"|"line"|"area"|"pie"|"donut",
  "title": string,            // <= 48 chars
  "unit": string,             // "%","M","k","B","yrs" or ""
  "dataQuality": "actual"|"estimated"|"projected"|"mixed",
  "note": string,             // honest one-line basis/source, <= 120 chars
  "data": [ { "label": string, "value": number, "estimated": boolean } ]
}

Constraints: 3 to 7 data points; labels <= 16 chars; ${typeHint}; for pie/donut the values represent parts of a whole. No commentary, no markdown — JSON only.`;

  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.15,
      max_tokens: 1100,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Topic / data: "${desc}"\nReturn ONLY the JSON chart spec.` },
      ],
    }),
  );

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(extractJson(raw)); } catch { return undefined; }
  if (opts.type) parsed.type = opts.type;
  return cleanChartSpec(parsed);
}
