import { NextRequest, NextResponse } from "next/server";
import { withGroqClient } from "@/lib/groqClient";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { PlanLimitError } from "@/lib/planServer";
import { requireCredits, deductCredits } from "@/lib/credits";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYS = `You build a single data TABLE from a description. Output STRICT JSON only:
{"headers": ["..."], "rows": [["...","..."], ...]}
Rules:
- 2-6 columns. Up to 20 rows. Keep cells short.
- Use real, sensible values that fit the description; compute totals if implied.
- Every row must have exactly as many cells as there are headers.
- No prose, no markdown, JSON only.`;

function extractJson(raw: string): string {
  let s = (raw || "").trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  return s;
}

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("edit-slide");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireCredits(uid);
    const body = await req.json().catch(() => ({}));
    const description = String(body?.description || "").trim().slice(0, 800);
    if (description.length < 3) return NextResponse.json({ error: "Describe the table first." }, { status: 400 });

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: `Build a table for: "${description.replace(/"/g, "'")}". Return ONLY the JSON.` },
        ],
      }),
    );

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(extractJson(raw)); } catch { /* ignore */ }
    const headers: string[] = Array.isArray(parsed?.headers) ? parsed.headers.map((h: any) => String(h ?? "").slice(0, 60)).filter(Boolean).slice(0, 6) : [];
    if (headers.length < 1) return NextResponse.json({ error: "Couldn't build a table from that — try rephrasing." }, { status: 422 });
    const rows: string[][] = (Array.isArray(parsed?.rows) ? parsed.rows : []).slice(0, 20).map((r: any) => {
      const cells = (Array.isArray(r) ? r : []).map((c: any) => String(c ?? "").slice(0, 120));
      while (cells.length < headers.length) cells.push("");
      return cells.slice(0, headers.length);
    });

    deductCredits(uid, "editSlide").catch(() => {});
    return NextResponse.json({ headers, rows });
  } catch (err: any) {
    if (err instanceof PlanLimitError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    // eslint-disable-next-line no-console
    console.error("[/api/doc-table] error:", err);
    return NextResponse.json({ error: err?.message || "Failed to build table." }, { status: 500 });
  }
}
