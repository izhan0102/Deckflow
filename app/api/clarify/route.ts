import { NextRequest, NextResponse } from "next/server";
import { withGroqClient } from "@/lib/groqClient";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireCredits, deductCredits } from "@/lib/credits";
import { PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Pre-generation clarifying questions.
 *
 * Before we actually build the deck, we ask the model to look at the
 * user's brief and produce a short set of MULTIPLE-CHOICE questions that
 * would meaningfully change the output. The user answers by tapping
 * options (never typing), and the answers get folded into the generation
 * prompt as hard directives.
 *
 * The questions are NOT fixed — they're generated per topic. We only
 * require that the FIRST question always covers visual/graphical
 * representation (charts, diagrams, flow), because that's the single
 * biggest lever on how the deck looks, and the user explicitly wants
 * control over it.
 */

const SYSTEM_PROMPT = `You are SlideGen's pre-flight interviewer.
Given a user's presentation brief, produce a SHORT set of multiple-choice
questions whose answers would genuinely change how you build the deck.
Output ONLY JSON. No prose, no markdown.

Output schema:
{
  "questions": [
    {
      "id": string,                       // short slug, e.g. "visuals", "depth"
      "question": string,                 // one clear sentence
      "hint": string,                     // OPTIONAL, <= 8 words, why it matters
      "multi": boolean,                    // true = user may pick several options
      "options": [
        { "label": string, "value": string }   // 2-4 options, label <= 4 words
      ]
    }
  ]
}

RULES:
- Ask as MANY questions as you genuinely need to remove ambiguity, and
  no more. Most briefs need 3-6. A vague brief may need more; a very
  detailed one may need only 2-3. Never pad with filler questions just
  to hit a number, and never ask something the brief already answers.
- Hard ceiling: 8 questions. Stop once the important choices are covered.
- The FIRST question MUST be about visual / graphical representation:
  whether to include data charts, diagrams, or process/flow visuals.
  Phrase it naturally for THIS topic. Give clear options like
  "Yes, where it helps", "Charts only", "Keep it text-only".
- The REMAINING questions must be SPECIFIC to the brief's topic —
  things you genuinely need decided to build a good deck. Examples of the
  KIND of thing (do not copy verbatim, tailor to the topic):
    * audience seniority / expertise level
    * which angle or sub-topics to emphasize
    * tone (formal vs energetic)
    * whether to include a specific section (pricing, roadmap, risks, demo)
    * level of technical depth
    * structure or ordering preferences
- Every option must be a concrete TAP CHOICE. NEVER ask the user to type.
- Options must be mutually sensible. For single-choice questions set
  "multi": false. Use "multi": true only when picking several makes sense
  (e.g. "which sections to include").
- Keep labels punchy (1-4 words). Keep questions jargon-free.
- Make the questions feel tailored, not generic. A pitch deck and a
  biology lecture should get clearly different questions.

Return only valid JSON.`;

function extractJson(raw: string): string {
  let s = (raw || "").trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
}

type Option = { label: string; value: string };
type Question = {
  id: string;
  question: string;
  hint?: string;
  multi: boolean;
  options: Option[];
};

function clean(s: any, max = 120): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function sanitizeQuestions(raw: any): Question[] {
  const arr = Array.isArray(raw?.questions) ? raw.questions : [];
  const out: Question[] = [];
  for (const q of arr.slice(0, 8)) {
    const question = clean(q?.question, 160);
    if (!question) continue;
    const options: Option[] = (Array.isArray(q?.options) ? q.options : [])
      .map((o: any) => ({ label: clean(o?.label, 40), value: clean(o?.value || o?.label, 60) }))
      .filter((o: Option) => o.label && o.value)
      .slice(0, 4);
    if (options.length < 2) continue;
    out.push({
      id: clean(q?.id, 32) || `q${out.length + 1}`,
      question,
      hint: clean(q?.hint, 60) || undefined,
      multi: q?.multi === true,
      options,
    });
  }
  return out;
}

/** A safe fallback so the flow never blocks if the model misbehaves. */
function fallbackQuestions(): Question[] {
  return [
    {
      id: "visuals",
      question: "Should the deck include visuals like charts or diagrams?",
      hint: "Affects how visual it looks",
      multi: false,
      options: [
        { label: "Yes, where it helps", value: "Include charts and diagrams wherever the content supports them" },
        { label: "Charts only", value: "Include data charts only, no diagrams" },
        { label: "Keep it text-only", value: "Do not include any charts or diagrams; text-only" },
      ],
    },
    {
      id: "depth",
      question: "How detailed should each slide be?",
      multi: false,
      options: [
        { label: "Punchy", value: "Keep slides concise and punchy" },
        { label: "Balanced", value: "Balanced level of detail" },
        { label: "In-depth", value: "Detailed, thorough slides" },
      ],
    },
    {
      id: "tone",
      question: "What tone fits best?",
      multi: false,
      options: [
        { label: "Formal", value: "Formal, professional tone" },
        { label: "Confident", value: "Confident and direct tone" },
        { label: "Energetic", value: "Energetic, engaging tone" },
      ],
    },
  ];
}

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("clarify");
  if (limited) return limited;

  try {
    const uid = await authenticateRequest(req);
    await requireCredits(uid);
    const { prompt, audience, tone, slideCount, sourceText } = (await req.json()) as {
      prompt: string;
      audience?: string;
      tone?: string;
      slideCount?: number;
      sourceText?: string;
    };

    const hasSource = typeof sourceText === "string" && sourceText.trim().length >= 40;
    const hasPrompt = typeof prompt === "string" && prompt.trim().length >= 5;

    if (!hasSource && !hasPrompt) {
      return NextResponse.json({ error: "prompt or sourceText required" }, { status: 400 });
    }

    // In import mode the "brief" is a trimmed excerpt of the user's own
    // content (plus any intent line) so the questions are tailored to what
    // they actually pasted, not a generic topic.
    const briefRaw = hasSource
      ? `${prompt && prompt.trim() ? `Intent: ${prompt.trim()}\n` : ""}The user pasted this content to turn into a presentation:\n${sourceText!.trim().slice(0, 4000)}`
      : prompt;

    const safePrompt = briefRaw.replace(/\\/g, "\\\\").replace(/"/g, '\\"').slice(0, 4000);

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.5,
        max_tokens: 1600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Brief: "${safePrompt}"
Audience: ${audience || "unspecified"}
Tone: ${tone || "unspecified"}
Slides: ${slideCount || "unspecified"}

Generate the clarifying questions. Return ONLY the JSON.`,
          },
        ],
      }),
    );

    const raw = completion.choices[0]?.message?.content || "{}";
    let questions: Question[] = [];
    try {
      questions = sanitizeQuestions(JSON.parse(extractJson(raw)));
    } catch {
      questions = [];
    }
    if (questions.length < 2) questions = fallbackQuestions();

    deductCredits(uid, "clarify").catch(() => {});
    return NextResponse.json({ questions });
  } catch (err: any) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[/api/clarify] error:", err);
    // Never hard-fail the flow — return fallback questions so the user can
    // still proceed to generation.
    return NextResponse.json({ questions: fallbackQuestions() });
  }
}
