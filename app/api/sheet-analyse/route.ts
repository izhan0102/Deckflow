import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireCredits, deductCredits } from "@/lib/credits";
import { PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withGroqClient } from "@/lib/groqClient";
import { sheetToPrompt } from "@/lib/sheetOps";
import type { Sheet } from "@/lib/sheet";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYS = `You are a sharp, friendly data analyst. The user uploaded a spreadsheet (its cells are given below). Answer their questions about THIS data only — never invent rows or numbers that aren't present.

Style: plain text, short paragraphs and tight bullet points. Be concrete — cite actual column names, counts, totals, averages, min/max, and notable rows. Round money/large numbers sensibly. Keep replies focused (a few sentences to a short list), not essays.

If the user's turn is the automatic kickoff ("Give an overview…"), respond with: one line on what the sheet appears to be; the columns and row count; then 3–6 key insights/stats (totals, averages, extremes, trends, and any data-quality issues like blanks or odd values).`;

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("edit-slide");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireCredits(uid);
    const body = await req.json().catch(() => ({}));
    const sheet: Sheet = {
      cols: Math.max(1, Math.min(60, Number(body?.cols) || 8)),
      rows: Math.max(1, Math.min(2000, Number(body?.rows) || 20)),
      cells: body?.cells && typeof body.cells === "object" ? body.cells : {},
    };
    const history = Array.isArray(body?.messages) ? body.messages.slice(-14) : [];
    if (!history.length) return NextResponse.json({ error: "Nothing to analyze." }, { status: 400 });

    const messages = [
      { role: "system" as const, content: `${SYS}\n\nSPREADSHEET:\n${sheetToPrompt(sheet)}` },
      ...history.map((m: any) => ({
        role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m?.content || "").slice(0, 2000),
      })),
    ];

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.4,
        max_tokens: 1400,
        messages,
      }),
    );
    const reply = (completion.choices[0]?.message?.content || "").trim() || "I couldn't read anything useful from that sheet.";
    deductCredits(uid, "sheetAnalyse").catch(() => {});
    return NextResponse.json({ reply });
  } catch (err: any) {
    if (err instanceof PlanLimitError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Analysis failed." }, { status });
  }
}
