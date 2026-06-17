import { withGroqClient } from "./groqClient";
import { cleanChartSpec } from "./charts";
import { blockId, type DocBlock, type DocDensity } from "./docTypes";

/**
 * AI document generation. Produces a structured, Word-like document as typed
 * blocks (headings, paragraphs, lists, tables, callouts, quotes) honoring a
 * requested page count and text density.
 */

const DENSITY_GUIDE: Record<DocDensity, { perPage: number; note: string }> = {
  concise: { perPage: 230, note: "Tight and scannable. Short paragraphs (2-3 sentences). Use lists liberally." },
  balanced: { perPage: 380, note: "Clear and complete. Paragraphs of 3-5 sentences, with lists and a table where useful." },
  detailed: { perPage: 550, note: "Thorough. Full paragraphs that explain and give examples, plus lists and tables." },
  comprehensive: { perPage: 720, note: "In-depth and authoritative. Rich, specific paragraphs with examples, data, and reasoning." },
};

const SYSTEM = `You are DocGen, a professional document writer. Output ONLY valid JSON
matching the schema. No markdown fences, no prose outside JSON.

Schema:
{
  "title": string,                 // document title (rendered as the cover/H1)
  "subtitle": string,              // OPTIONAL one-line subtitle
  "blocks": [
    { "type": "heading", "level": 2 | 3, "text": string },        // section / sub-section headings
    { "type": "paragraph", "text": string },
    { "type": "bullets", "items": [string] },
    { "type": "numbered", "items": [string] },                    // ordered steps
    { "type": "table", "headers": [string], "rows": [[string]] }, // real tabular data only
    { "type": "callout", "tone": "info" | "success" | "warning" | "neutral", "text": string }, // key note / tip / warning
    { "type": "chart", "chart": { "type": "bar"|"line"|"area"|"pie"|"donut", "title": string, "unit": string, "data": [ { "label": string, "value": number } ] }, "caption": string },
    { "type": "quote", "text": string, "cite": string }           // a real, relevant quotation only
  ]
}

WRITING RULES:
- Write a REAL document with a logical flow: an intro, well-organized sections
  (level-2 headings) with sub-sections (level-3) where needed, and a conclusion.
- BE SPECIFIC AND SUBSTANTIVE. Include concrete facts, figures, percentages,
  dates, and named examples where they genuinely apply to the topic. Avoid vague
  filler. Don't fabricate precise statistics you don't actually know — use
  well-known, widely-reported figures, or clearly frame numbers as illustrative.
- TABLES: use rich, multi-column comparison/spec/pricing/schedule tables with
  3+ columns and several rows where the topic warrants it. Fill EVERY cell with a
  real value — never empty/placeholder cells.
- CHARTS: when the topic has quantitative data that compares or trends, include a
  "chart" block with 3-7 real data points (bar = compare categories, line/area =
  trend over time, pie/donut = parts of a whole). Only with genuine numbers.
- CONCLUSION: end with a SPECIFIC conclusion that synthesizes the document's key
  points and gives a concrete takeaway or recommendation — never a generic
  "in conclusion, this is important" paragraph.
- Use "callout" for a key takeaway, tip, or warning. Use "numbered" for steps,
  "bullets" for non-ordered points. Don't overuse any one block.
- Inline emphasis: wrap important terms in **bold**, _underline_, or *italic*.
  Use sparingly and meaningfully.
- Be accurate. Never invent citations or quotes. If you don't have a real quote,
  omit the quote block.
- Plain text only inside fields (besides the **/_/* emphasis markers). No HTML.`;

function buildUser(opts: { topic: string; pages: number; density: DocDensity; directives?: string }): string {
  const d = DENSITY_GUIDE[opts.density];
  const targetWords = Math.round(opts.pages * d.perPage);
  const sections = Math.max(3, Math.round(opts.pages * 1.6));
  return `Write a ${opts.pages}-page document about:
"""
${opts.topic}
"""

LENGTH: aim for roughly ${targetWords} words total (about ${opts.pages} A4 pages).
Density: ${opts.density.toUpperCase()} — ${d.note}
STRUCTURE: around ${sections} level-2 sections, each with 1-4 paragraphs and the
occasional list, table, or callout where it genuinely helps. Start with a short
intro paragraph and end with a conclusion.
${opts.directives ? `\nExtra instructions: ${opts.directives}` : ""}

Return ONLY the JSON object.`;
}

/* ----------------------------- cleaning ----------------------------- */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Convert the limited markdown emphasis to safe inline HTML. */
export function inlineToHtml(raw: string): string {
  let s = esc(String(raw || ""));
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/__(.+?)__/g, "<u>$1</u>");
  s = s.replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<i>$2</i>");
  return s;
}

function cleanText(s: any): string {
  return inlineToHtml(typeof s === "string" ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim() : "");
}

function cleanBlocks(raw: any[]): DocBlock[] {
  const out: DocBlock[] = [];
  for (const b of Array.isArray(raw) ? raw : []) {
    const t = b?.type;
    if (t === "heading") {
      const text = cleanText(b.text);
      if (text) out.push({ id: blockId(), type: "heading", level: b.level === 3 ? 3 : 2, text });
    } else if (t === "paragraph") {
      const text = cleanText(b.text);
      if (text) out.push({ id: blockId(), type: "paragraph", text });
    } else if (t === "bullets" || t === "numbered") {
      const items = (Array.isArray(b.items) ? b.items : []).map(cleanText).filter(Boolean);
      if (items.length) out.push({ id: blockId(), type: t, items });
    } else if (t === "table") {
      const headers = (Array.isArray(b.headers) ? b.headers : []).map((h: any) => cleanText(h)).filter(Boolean);
      const rows = (Array.isArray(b.rows) ? b.rows : [])
        .map((r: any) => (Array.isArray(r) ? r.map((c: any) => cleanText(c)) : []))
        .filter((r: string[]) => r.length > 0)
        .map((r: string[]) => { const o = [...r]; while (o.length < headers.length) o.push(""); return o.slice(0, headers.length); });
      // reject tables with an entirely empty column
      const valid = headers.length >= 2 && rows.length >= 1 &&
        !headers.some((_: string, c: number) => rows.every((r: string[]) => !r[c] || !r[c].trim()));
      if (valid) out.push({ id: blockId(), type: "table", headers, rows });
    } else if (t === "callout") {
      const text = cleanText(b.text);
      const tone = ["info", "success", "warning", "neutral"].includes(b.tone) ? b.tone : "info";
      if (text) out.push({ id: blockId(), type: "callout", tone, text });
    } else if (t === "chart") {
      const chart = cleanChartSpec(b.chart);
      if (chart && chart.data && chart.data.length >= 2) {
        out.push({ id: blockId(), type: "chart", chart, caption: b.caption ? cleanText(b.caption) : undefined });
      }
    } else if (t === "quote") {
      const text = cleanText(b.text);
      if (text && text.length > 12) out.push({ id: blockId(), type: "quote", text, cite: b.cite ? cleanText(b.cite) : undefined });
    }
  }
  return out;
}

function extractJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  return a !== -1 && b !== -1 ? s.slice(a, b + 1) : s;
}

/** Convert our stored inline HTML back to the bold/underline/italic markers the model uses. */
function htmlToMd(s: string): string {
  return String(s || "")
    .replace(/<\/?(b|strong)>/gi, "**").replace(/<\/?u>/gi, "__").replace(/<\/?(i|em)>/gi, "*")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/** A compact, model-friendly view of a block (HTML emphasis -> markers). */
function blockToPlain(b: DocBlock): any {
  switch (b.type) {
    case "heading": return { type: "heading", level: b.level, text: htmlToMd(b.text) };
    case "paragraph": return { type: "paragraph", text: htmlToMd(b.text) };
    case "bullets": case "numbered": return { type: b.type, items: b.items.map(htmlToMd) };
    case "table": return { type: "table", headers: b.headers.map(htmlToMd), rows: b.rows.map((r) => r.map(htmlToMd)) };
    case "callout": return { type: "callout", tone: b.tone, text: htmlToMd(b.text) };
    case "quote": return { type: "quote", text: htmlToMd(b.text), cite: b.cite ? htmlToMd(b.cite) : "" };
    case "chart": return { type: "chart", chart: b.chart, caption: b.caption ? htmlToMd(b.caption) : "" };
    case "divider": return { type: "divider" };
    case "image": return { type: "image", caption: b.caption ? htmlToMd(b.caption) : "" }; // url kept client-side
    default: return null;
  }
}

const EDIT_SYS = `You edit an existing document. You receive the current document as JSON and an
instruction. Apply the instruction and return the FULL updated document as JSON:
{ "title": string, "subtitle": string, "blocks": [ ... ] } using the SAME block schema
(heading, paragraph, bullets, numbered, table, callout, chart, quote, divider).
Keep everything not affected by the instruction unchanged and in order. You may add,
remove, reorder, expand, shorten, or restyle blocks; add tables or charts; and use
**bold**, _underline_, *italic* markers. Output ONLY the JSON, no prose.`;

/** Apply a natural-language instruction to an existing document. Image blocks are
 *  preserved on the client (the model can't see their data). */
export async function editDoc(input: { title: string; subtitle?: string; blocks: DocBlock[]; instruction: string }):
  Promise<{ title: string; subtitle?: string; blocks: DocBlock[] }> {
  const plain = { title: htmlToMd(input.title), subtitle: htmlToMd(input.subtitle || ""), blocks: input.blocks.map(blockToPlain).filter(Boolean) };
  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.4,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EDIT_SYS },
        { role: "user", content: `Current document:\n${JSON.stringify(plain)}\n\nInstruction: "${input.instruction}"\n\nReturn the full updated document JSON.` },
      ],
    }),
  );
  const parsed = JSON.parse(extractJson(completion.choices[0]?.message?.content || "{}"));
  return {
    title: (typeof parsed?.title === "string" && parsed.title.trim()) ? inlineToHtml(parsed.title) : input.title,
    subtitle: typeof parsed?.subtitle === "string" && parsed.subtitle.trim() ? inlineToHtml(parsed.subtitle) : input.subtitle,
    blocks: cleanBlocks(parsed?.blocks),
  };
}

async function runDocCall(userContent: string, temp = 0.6): Promise<any> {
  const completion = await withGroqClient((client) =>
    client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: temp,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
    }),
  );
  return JSON.parse(extractJson(completion.choices[0]?.message?.content || "{}"));
}

/** Build the user prompt for ONE part of a multi-part document. */
function buildPartUser(
  opts: { topic: string; pages: number; density: DocDensity; directives?: string },
  part: { index: number; count: number; position: "opening" | "middle" | "closing"; pagesInPart: number; priorHeadings: string[] },
): string {
  const d = DENSITY_GUIDE[opts.density];
  const targetWords = Math.round(part.pagesInPart * d.perPage);
  const seen = part.priorHeadings.length
    ? `\nSections ALREADY written earlier in this document (do NOT repeat them — continue naturally AFTER them):\n- ${part.priorHeadings.join("\n- ")}`
    : "";
  const role =
    part.position === "opening"
      ? `This is PART 1 of ${part.count}. Begin the document: a "title", an optional "subtitle", a short introduction paragraph, and the FIRST body sections. Do NOT write a conclusion yet — later parts continue the document.`
      : part.position === "closing"
        ? `This is PART ${part.index + 1} of ${part.count} — the FINAL part. Write the remaining body sections, then END with a specific, well-developed conclusion section (a level-2 heading like "Conclusion") that synthesizes the whole document and gives a concrete takeaway.`
        : `This is PART ${part.index + 1} of ${part.count} — a MIDDLE part. Continue with the NEXT body sections only. Do NOT write an introduction and do NOT write a conclusion.`;
  return `You are writing ONE PART of a longer ${opts.pages}-page document about:
"""
${opts.topic}
"""

${role}
LENGTH FOR THIS PART: roughly ${targetWords} words — about ${part.pagesInPart} full A4 page(s) of content. Write substantial, complete content; do not be brief or cut it short.
Density: ${opts.density.toUpperCase()} — ${d.note}
Use 2-4 level-2 sections in this part, each with several paragraphs plus the occasional list, table, chart, or callout where it genuinely helps.${seen}
${opts.directives ? `\nExtra instructions: ${opts.directives}` : ""}
${part.position === "opening" ? `Return JSON with "title", "subtitle", and "blocks".` : `Return JSON with ONLY a "blocks" array (no title/subtitle).`}`;
}

export async function generateDoc(opts: { topic: string; pages: number; density: DocDensity; directives?: string }):
  Promise<{ title: string; subtitle?: string; blocks: DocBlock[] }> {
  const pages = Math.max(1, Math.min(20, Math.round(opts.pages || 1)));
  // One model response can't reliably fill many pages (token ceiling), so we
  // generate the document in parts (~1.5 pages each) and stitch them together.
  const partCount = pages <= 2 ? 1 : Math.min(8, Math.ceil(pages / 1.5));

  if (partCount === 1) {
    const parsed = await runDocCall(buildUser({ ...opts, pages }));
    return {
      title: (typeof parsed?.title === "string" && parsed.title.trim()) || opts.topic.slice(0, 80),
      subtitle: typeof parsed?.subtitle === "string" && parsed.subtitle.trim() ? parsed.subtitle.trim() : undefined,
      blocks: cleanBlocks(parsed?.blocks),
    };
  }

  const perPart = Math.max(1, Math.round(pages / partCount));
  let title = ""; let subtitle: string | undefined;
  const blocks: DocBlock[] = [];
  const priorHeadings: string[] = [];

  for (let i = 0; i < partCount; i++) {
    const position: "opening" | "middle" | "closing" = i === 0 ? "opening" : i === partCount - 1 ? "closing" : "middle";
    let parsed: any;
    try {
      parsed = await runDocCall(buildPartUser({ ...opts, pages }, { index: i, count: partCount, position, pagesInPart: perPart, priorHeadings: [...priorHeadings] }));
    } catch {
      continue; // one failed part shouldn't kill the whole document
    }
    if (i === 0) {
      title = (typeof parsed?.title === "string" && parsed.title.trim()) || opts.topic.slice(0, 80);
      subtitle = typeof parsed?.subtitle === "string" && parsed.subtitle.trim() ? parsed.subtitle.trim() : undefined;
    }
    for (const b of cleanBlocks(parsed?.blocks)) {
      if (b.type === "heading" && b.level === 2) priorHeadings.push(htmlToMd(b.text).slice(0, 80));
      blocks.push(b);
    }
  }
  if (!title) title = opts.topic.slice(0, 80);
  return { title, subtitle, blocks };
}
