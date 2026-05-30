import Groq from "groq-sdk";
import type { Deck, Slide, SlideLayout, ContentDensity, Reference, TableData } from "./types";
import { withGroqClient } from "./groqClient";
import { cleanChartSpec } from "./charts";

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
  concise:        `Density: CONCISE.\n- Exactly 3 bullets per content slide. Hard cap.\n- Each bullet 4-8 words, max 60 characters.`,
  balanced:       `Density: BALANCED.\n- Exactly 4 bullets per content slide. Hard cap.\n- Each bullet 8-14 words, max 90 characters.`,
  detailed:       `Density: DETAILED.\n- Exactly 4 bullets per content slide. Hard cap (5 only if absolutely necessary).\n- Each bullet 12-20 words, max 130 characters.\n- Real sentences, but tight. NEVER let any single bullet exceed 130 chars.`,
  comprehensive:  `Density: COMPREHENSIVE.\n- Exactly 5 bullets per content slide. Hard cap.\n- Each bullet 18-26 words, max 160 characters.\n- Substance and specificity matter, but NEVER overflow 160 chars per bullet — split into two bullets if needed.`,
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
      "columnLabels": { "left": string, "right": string },  // ONLY for "two-column". The REAL heading for each side, e.g. {"left":"Challenges","right":"Opportunities"} or {"left":"Traditional","right":"Modern"}. Use {"left":"Pros","right":"Cons"} ONLY when it is genuinely a pros/cons trade-off.
      "kicker": string,         // OPTIONAL. ONLY for the first "title-hero" slide. Short uppercase context line shown above the title (e.g. "Q3 INVESTOR UPDATE", "INTRO LECTURE"). 2-5 words, always uppercase.
      "titleVariant": "centered" | "asymmetric" | "big-initial" | "numbered" | "underlined",  // OPTIONAL. ONLY for "title-hero".
      "bulletsVariant": "standard" | "numbered" | "cards" | "icon-check" | "dashed",  // OPTIONAL. ONLY for "bullets". Choose by content: "cards" for distinct features/pillars, "icon-check" for benefits/advantages, "numbered" for ordered steps, "standard"/"dashed" for plain points.
      "twoColumnVariant": "classic" | "divider" | "cards" | "numbered" | "compare",  // OPTIONAL. ONLY for "two-column". Use "compare" ONLY for genuine pros/cons.
      "notes": string
    }
  ]
}

YOUR JOB: design a deck that fits THIS topic. Every deck must feel different.
Do NOT fall back to a fixed template. Choose each slide's layout based on what
the content on that slide actually is. Two decks on different topics should look
visibly different in their layout sequence.

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
- "chart":       USE THIS whenever a slide is fundamentally about NUMBERS that
  compare or trend: market share, growth over time, revenue by segment, survey
  results, budget split, before/after metrics, percentages. Put the data in
  "chart" with 2-7 data points. Pick the chart type that fits:
    * "bar"   - comparing categories (revenue by region, votes per option)
    * "line"  - a trend over ordered time (MRR by month, users by year)
    * "area"  - a trend where the filled volume matters (cumulative growth)
    * "pie"   - parts of a whole, 2-5 slices (market share, budget split)
    * "donut" - same as pie, more modern look
  Choose the chart's colors yourself when it helps (e.g. red for a declining
  segment), or omit "color" to use the theme palette. A chart slide usually
  has a short title and little or no bullets.
- "table":       precise tabular data with multiple columns (feature matrix,
  pricing tiers, spec comparison). Use a chart instead if it's a single series
  of numbers that would read better visually. Always include "source".
- "two-column":  a side-by-side of TWO related sets of points. Examples:
  Challenges vs Opportunities, Traditional vs Modern, Theory vs Practice,
  Short-term vs Long-term, Team A vs Team B. ALWAYS set "columnLabels" to the
  REAL headings for the two sides (e.g. {"left":"Challenges","right":"Opportunities"}).
  Set "twoColumnVariant":"compare" ONLY when it is a genuine PROS vs CONS
  trade-off, and in that case set columnLabels to {"left":"Pros","right":"Cons"}.
  For every other two-sided slide use "classic", "divider", or "cards" with the
  real labels — NOT the pros/cons styling.
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
  Use this ONLY when the slide is genuinely weighing upsides against downsides,
  AND only when the user's brief or that slide's substance actually calls for a
  trade-off. NEVER apply pros/cons styling to a slide that is just two related
  groups (e.g. "Challenges and Opportunities" is NOT pros/cons — it's a
  two-column with those exact labels). Do not invent a pros/cons slide for filler.
- Numbers that compare or trend -> strongly prefer "chart". Don't bury real data
  in prose bullets.
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
- "table": "table.rows" has at least 2 rows, "table.headers" not empty.
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

function buildUserMessage(opts: {
  prompt: string;
  slideCount: number;
  audience?: string;
  tone?: string;
  density: ContentDensity;
  includeReferences: boolean;
}) {
  const refLine = opts.includeReferences
    ? `For "references": include ONLY real, verifiable sources you are confident exist. If you are not confident, return an empty references array. Never fabricate citations or URLs.`
    : `Set "references" to an empty array — the user does not want a references slide.`;

  return `Create EXACTLY a ${opts.slideCount}-slide presentation. Output exactly ${opts.slideCount} entries in "slides". Not fewer. Not more. The user explicitly requested ${opts.slideCount} slides — honor that count.

Slide structure:
- Slide 1: title-hero
- Slides 2 through ${opts.slideCount - 1}: choose the layout for EACH slide based on
  what that slide's content actually is. Mix freely among bullets, chart, table,
  two-column, and (rarely) section. Use a "chart" wherever the slide is about
  comparable or trending numbers. Use "two-column" for any pros/cons or
  comparison. Do NOT make every middle slide a bullets slide. (If the user's
  brief implies an order like "Problem, Solution, Traction, Ask", follow it.)
- Slide ${opts.slideCount}: closing

${DENSITY_GUIDE[opts.density]}

${refLine}

Read the user's brief in full. Use every relevant detail they gave you — DO NOT drop or skip parts because the brief is long. If they listed sections / topics / numbers, honor each one explicitly. If they specified an order, preserve it. If the brief contains real numbers or stats, put them in a chart rather than burying them in prose.

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
      chart: cleanChartSpec(s.chart),
      notes: s.notes ? clean(s.notes) : undefined,
      kicker: s.kicker ? clean(s.kicker).toUpperCase().slice(0, 60) : undefined,
      titleVariant:
        s.titleVariant === "asymmetric"  ? "asymmetric"  :
        s.titleVariant === "big-initial" ? "big-initial" :
        s.titleVariant === "numbered"    ? "numbered"    :
        s.titleVariant === "underlined"  ? "underlined"  :
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
  });

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
