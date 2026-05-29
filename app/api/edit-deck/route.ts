import { NextRequest, NextResponse } from "next/server";
import { withGroqClient } from "@/lib/groqClient";
import type { Deck } from "@/lib/types";
import type { DeckOp } from "@/lib/deckOps";
import { applyDeckOps } from "@/lib/deckOps";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Deck-level AI editor.
 *
 * The user types a single instruction that operates on the whole deck
 * (e.g. "add 3 slides about competitors after slide 4", "shorten every
 * bullet", "reorder so the strongest argument is first"). We hand the
 * model a strict tool vocabulary, parse the JSON response into a list
 * of DeckOp values, validate them, apply them, and return the new deck
 * plus a human-readable summary.
 *
 * The model's vocabulary is intentionally small so it can reason
 * accurately:
 *   addSlide      — insert one slide after a specific index
 *   removeSlide   — drop a slide by index
 *   replaceSlide  — wholesale swap a slide
 *   patchSlide    — change specific fields on a slide
 *   reorderSlides — reorder using a permutation of indices
 *   setDeckMeta   — change deck-level title or subtitle
 *
 * That's it. Anything more elaborate (e.g. "make this whole deck more
 * concise") is the model's job to express as a list of patchSlide ops.
 */


const SYSTEM_PROMPT = `You are SlideGen's deck-level editor.
You receive a deck and a single instruction. You output ONLY a JSON
object describing the operations to perform. No prose. No markdown.

Output schema:
{
  "ops": [ DeckOp, DeckOp, ... ],
  "explanation": string
}

The available operations are:

1. addSlide
   { "type": "addSlide",
     "afterIndex": number,                  // -1 inserts at the start
     "slide": {
       "layout": "title-hero"|"bullets"|"table"|"two-column"|"quote"|"section"|"closing",
       "title": string,
       "subtitle"?: string,
       "bullets"?: string[],                 // 3-5 items for bullets/two-column
       "body"?: string,                      // for quote/section
       "table"?: { "headers": string[], "rows": [string[]], "source": string },
       "kicker"?: string,                    // optional uppercase line
       "notes"?: string
     }
   }

2. removeSlide
   { "type": "removeSlide", "index": number }

3. replaceSlide
   { "type": "replaceSlide", "index": number, "slide": <same as addSlide.slide> }

4. patchSlide
   { "type": "patchSlide",
     "index": number,
     "patch": {
       "title"?: string,
       "subtitle"?: string,
       "body"?: string,
       "bullets"?: string[],                 // replaces bullets entirely
       "addBullets"?: string[],              // append-only
       "removeBullets"?: number[],           // by index
       "table"?: { "headers": string[], "rows": [string[]], "source": string },
       "layout"?: "...",                     // change the slide's layout
       "kicker"?: string,
       "notes"?: string
     }
   }

5. reorderSlides
   { "type": "reorderSlides", "newOrder": number[] }
   newOrder must be a permutation of indices into the FINAL deck (after
   any add/remove ops in this same response). If you don't need to
   reorder, omit this op entirely.

6. setDeckMeta
   { "type": "setDeckMeta", "title"?: string, "subtitle"?: string }

CRITICAL rules:

- Read the user's instruction CAREFULLY and identify exactly which
  slides they mean.
    "first slide" = index 0.
    "last slide" = index slides.length - 1.
    "every slide" = every index.
    "section/intro/closing" = match by layout or by what's on the slide.
    "slide 3" = index 2 (one-based to zero-based).
  When the instruction targets multiple slides ("first and last",
  "every bullet slide", "all slides"), emit ONE op per target slide.
  Do NOT skip any.

- The first slide stays "title-hero" and the last stays "closing" —
  the server enforces this automatically. Don't fight it; build around
  it. If the user asks for a "team" slide and doesn't specify where,
  insert it BEFORE the closing slide (afterIndex = slides.length - 2),
  not as the closing itself.

- For "make every bullet shorter" or "tighten every slide", emit one
  patchSlide per content slide. Do not return a single replaceSlide for
  the whole deck.

- For "add subtitle X to slide N", patch the subtitle field. For "add
  X as a bullet to slide N", use addBullets. Don't invent a different
  field.

- Apply order is fixed. The server processes ops in this order:
    1. patchSlide + replaceSlide (operate on ORIGINAL indices)
    2. removeSlide (descending by index)
    3. addSlide (ascending by afterIndex)
    4. reorderSlides (operates on POST-mutation indices)
    5. setDeckMeta
  Use ORIGINAL indices for patch/replace/remove, and FINAL indices for
  reorder.

- Always fill content fully. NEVER emit empty bullets / empty bodies.
  If you don't have a strong concrete bullet, write fewer of them, but
  every slide that's not a hero or closing must have substance.

- If the user asks for an impossible thing (e.g. "remove slide 99" when
  there are 6 slides), don't make ops up — return an empty ops array
  and explain in the explanation field.

- "explanation" is a single short sentence that tells the user what you
  did. It's shown in the deck chat panel.

Examples:

Instruction: "Add a competitive landscape section after slide 4 — three
slides: who's out there, what they do well, where we win"
Response:
{
  "ops": [
    { "type": "addSlide", "afterIndex": 4, "slide": {
        "layout": "bullets", "title": "The competitive landscape",
        "kicker": "WHO ELSE IS OUT THERE",
        "bullets": ["Notion AI ships fluent prose but no real layouts", "Gamma is design-first but locked in their format", "Beautiful.ai uses templates that fight your edits"]
    }},
    { "type": "addSlide", "afterIndex": 5, "slide": {
        "layout": "bullets", "title": "What they do well",
        "bullets": ["Strong onboarding flows", "Polished marketing", "Mature billing infrastructure"]
    }},
    { "type": "addSlide", "afterIndex": 6, "slide": {
        "layout": "bullets", "title": "Where we win",
        "bullets": ["Real PowerPoint export, no lock-in", "Inline editor that respects your changes", "Pay-per-deck pricing at INR 15"]
    }}
  ],
  "explanation": "Added three competitive landscape slides after slide 4."
}

Instruction: "Make this deck more concise — cut every bullet to under 10 words"
Response:
{
  "ops": [
    { "type": "patchSlide", "index": 1, "patch": { "bullets": ["Revenue grew 38% QoQ", "Net retention 124%", "Three new enterprise customers"] }},
    { "type": "patchSlide", "index": 2, "patch": { "bullets": ["Product velocity is up", "Hiring closed two senior roles", "Onboarding shipped in March"] }}
  ],
  "explanation": "Tightened every bullet on slides 2 and 3 to under 10 words."
}

Instruction: "Reorder so the strongest argument comes first"
Response:
{
  "ops": [
    { "type": "reorderSlides", "newOrder": [0, 4, 1, 2, 3, 5] }
  ],
  "explanation": "Moved the slide on net retention to position 2 since it's the strongest standalone argument."
}

Instruction: "Add 'team name' as the subtitle on the first and last slide"
Response:
{
  "ops": [
    { "type": "patchSlide", "index": 0, "patch": { "subtitle": "team name" }},
    { "type": "patchSlide", "index": -1, "patch": { "subtitle": "team name" }}
  ],
  "explanation": "Added 'team name' as the subtitle on the first and last slide."
}
NOTE: above index "-1" is illustrative only. In a real response use the
literal last index given in the deck (e.g. 5 if slides.length is 6).

Return only valid JSON. No markdown fences. No commentary.`;

function extractJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("\`\`\`")) s = s.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\`\`\`\s*$/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1);
  return s;
}


export async function POST(req: NextRequest) {
  try {
    const uid = await authenticateRequest(req);
    const { deck, instruction, history } = (await req.json()) as {
      deck: Deck;
      instruction: string;
      /** Compact recent edits, oldest -> newest. Used by the model as memory. */
      history?: { user: string; explanation?: string; scope?: "slide" | "deck" }[];
    };
    if (!deck || !Array.isArray(deck.slides) || !instruction) {
      return NextResponse.json({ error: "deck + instruction required" }, { status: 400 });
    }

    // Build a compact deck snapshot for the model. Keeping each slide
    // short stops the prompt from blowing past the TPM budget.
    const compact = {
      title: deck.title,
      subtitle: deck.subtitle,
      topic: deck.topic,
      audience: deck.audience,
      tone: deck.tone,
      density: deck.density,
      slides: deck.slides.map((s, i) => ({
        index: i,
        layout: s.layout,
        kicker: s.kicker,
        title: s.title,
        subtitle: s.subtitle,
        bullets: s.bullets,
        bodyPreview: s.body ? s.body.slice(0, 240) : undefined,
        hasTable: !!s.table,
      })),
    };

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        // Smaller, much faster model for ops emission. The deck-level
        // chat is structured JSON output — no need for the bigger
        // model's reasoning, and llama-3.3-70b consistently returns in
        // 3-5s vs the 12-15s of gpt-oss-120b.
        model: "llama-3.3-70b-versatile",
        temperature: 0.15,
        max_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Current deck (slides.length = ${deck.slides.length}, last index = ${deck.slides.length - 1}):\n${JSON.stringify(compact, null, 2)}\n\n${
              Array.isArray(history) && history.length > 0
                ? `Recent edits (oldest -> newest, your memory of what just happened):\n${history
                    .slice(-6)
                    .map((h, i) => `  ${i + 1}. [${h.scope || "slide"}] "${(h.user || "").slice(0, 200)}" -> ${(h.explanation || "(applied)").slice(0, 200)}`)
                    .join("\n")}\n\n`
                : ""
            }Instruction:\n"${instruction}"\n\nReturn ONLY the JSON ops object.`,
          },
        ],
      }),
    );

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(extractJson(raw));
    const ops: DeckOp[] = Array.isArray(parsed?.ops) ? parsed.ops : [];

    if (ops.length === 0) {
      return NextResponse.json({
        deck,
        ops: [],
        summary: [],
        explanation: typeof parsed?.explanation === "string"
          ? parsed.explanation
          : "I couldn't act on that — try rephrasing.",
      });
    }

    const { deck: nextDeck, summary } = applyDeckOps(deck, ops);

    return NextResponse.json({
      deck: nextDeck,
      ops,
      summary,
      explanation: typeof parsed?.explanation === "string"
        ? parsed.explanation
        : "Deck updated.",
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[/api/edit-deck] error:", err);
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json(
      { error: err?.message || "Deck edit failed." },
      { status },
    );
  }
}
