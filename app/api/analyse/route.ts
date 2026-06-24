import { NextRequest, NextResponse } from "next/server";
import { withGroqClient } from "@/lib/groqClient";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { PlanLimitError } from "@/lib/planServer";
import { requireCredits, deductCredits } from "@/lib/credits";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 90;

type Depth = "overview" | "moderate" | "deep";
const DEPTHS: Record<Depth, string> = {
  overview: "A quick OVERVIEW: 3–5 crisp bullet points capturing the essence. Be brief.",
  moderate: "A MODERATE analysis: a short summary plus 2–3 focused sections with the most important findings.",
  deep: "A DEEP, thorough analysis: multiple sections, specifics, figures, structure, strengths/weaknesses, and notable details. Leave nothing important out.",
};

const FOCI: Record<string, string> = {
  auto: "Decide the most useful lens for each document automatically based on what it is.",
  summary: "Summarise the content clearly.",
  insights: "Surface the key insights, takeaways, and what matters most.",
  risks: "Identify risks, gaps, weaknesses, errors, and red flags.",
  actions: "Extract concrete action items, next steps, and recommendations.",
  data: "Pull out the important data, numbers, metrics, and facts.",
  code: "Review as code/technical material: what it does, structure, issues, and improvements.",
};

function extractJson(raw: string): string {
  let s = (raw || "").trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  return s;
}

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("analyse");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireCredits(uid);

    const body = await req.json().catch(() => ({}));
    const depth: Depth = ["overview", "moderate", "deep"].includes(body?.depth) ? body.depth : "moderate";
    const focus = typeof body?.focus === "string" && FOCI[body.focus] ? body.focus : "auto";
    const docs = (Array.isArray(body?.docs) ? body.docs : [])
      .map((d: any) => ({ name: String(d?.name || "Document").slice(0, 120), text: String(d?.text || "").slice(0, 16000) }))
      .filter((d: any) => d.text.trim().length > 0)
      .slice(0, 8);
    if (docs.length === 0) return NextResponse.json({ error: "No readable content was found in the upload(s)." }, { status: 400 });

    const ctx = docs.map((d: any, i: number) => `=== Document ${i + 1}: ${d.name} ===\n${d.text}`).join("\n\n");

    // ---- Follow-up Q&A mode (with conversation memory) ----
    const question = String(body?.question || "").trim().slice(0, 2000);
    if (question) {
      const history = (Array.isArray(body?.messages) ? body.messages : []).slice(-10).map((m: any) => ({
        role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m?.content || "").slice(0, 2000),
      }));
      const askSys = `You are a sharp document analyst answering follow-up questions about the user's uploaded document(s). Use ONLY the documents below — if the answer isn't in them, say so plainly. Be concise and concrete (cite specifics, numbers, names, and which document). Plain text with light markdown (**bold**, - bullets). Refer to documents by their titles.\n\nDOCUMENTS:\n${ctx}`;
      const completion = await withGroqClient((client) =>
        client.chat.completions.create({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.3,
          max_tokens: 1400,
          messages: [{ role: "system", content: askSys }, ...history, { role: "user", content: question }],
        }),
      );
      const answer = (completion.choices[0]?.message?.content || "").trim();
      if (!answer) return NextResponse.json({ error: "No answer — try rephrasing." }, { status: 502 });
      deductCredits(uid, "qaPrep").catch(() => {});
      return NextResponse.json({ answer });
    }

    const multi = docs.length > 1;
    const sys = `You are an elite document analyst. You receive one or more documents (any kind: reports, spreadsheets, slides, code, notes, data) and produce a sharp, well-structured analysis.

Depth requested: ${DEPTHS[depth]}
Lens: ${FOCI[focus]}

Output STRICT JSON only:
{
  "perDoc": [ { "title": "<short label>", "type": "<what it is, e.g. Financial report, Python script, Slide deck>", "analysis": "<markdown analysis: use ## headings, - bullets, **bold**>" } ],
  ${multi ? `"synthesis": "<markdown: a CROSS-DOCUMENT synthesis — overlaps, connections, contradictions/disagreements between the documents, and the combined big-picture takeaways. This is the most valuable part.>"` : `"synthesis": ""`}
}
Rules: analyse ONLY what's given — never invent facts. Keep it concrete (cite specifics, numbers, names). Match the requested depth. Refer to documents by their titles. JSON only, no prose outside it.`;

    const userContent = ctx;

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.35,
        max_tokens: depth === "deep" ? 4000 : depth === "moderate" ? 2400 : 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Analyse the following ${docs.length} document(s):\n\n${userContent}\n\nReturn ONLY the JSON.` },
        ],
      }),
    );

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(extractJson(raw)); } catch { /* ignore */ }
    const perDoc = (Array.isArray(parsed?.perDoc) ? parsed.perDoc : []).map((p: any, i: number) => ({
      title: String(p?.title || docs[i]?.name || `Document ${i + 1}`).slice(0, 160),
      type: String(p?.type || "").slice(0, 80),
      analysis: String(p?.analysis || "").slice(0, 12000),
    })).filter((p: any) => p.analysis);
    if (perDoc.length === 0) return NextResponse.json({ error: "Analysis failed — try again or a different file." }, { status: 502 });

    deductCredits(uid, "analyse").catch(() => {});
    return NextResponse.json({ perDoc, synthesis: typeof parsed?.synthesis === "string" ? parsed.synthesis.slice(0, 8000) : "" });
  } catch (err: any) {
    if (err instanceof PlanLimitError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    // eslint-disable-next-line no-console
    console.error("[/api/analyse] error:", err);
    return NextResponse.json({ error: err?.message || "Analysis failed." }, { status: 500 });
  }
}
