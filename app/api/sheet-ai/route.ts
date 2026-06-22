import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withGroqClient } from "@/lib/groqClient";
import { sheetToPrompt } from "@/lib/sheetOps";
import type { Sheet } from "@/lib/sheet";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYS = `You are a spreadsheet assistant. The user gives an instruction; you edit the sheet by returning JSON operations. The app applies them and evaluates formulas itself.

Return STRICT JSON, no prose outside it, in ONE of these shapes:
{"ops": [ ...operations... ], "message": "<one short sentence describing what you did>"}
{"error": "<one short, friendly sentence explaining why you can't do it>"}

Cell references are A1-style: a column letter (A, B, C, …) + a 1-based row number. Row 1 is the top. Use the column letters exactly.

OPERATIONS (use the minimum needed):
- {"op":"set","ref":"C4","value":"42"}                      set one cell (value can be text, a number, or a formula starting with "=")
- {"op":"setRange","start":"A1","values":[["Item","Qty"],["Pen",3]]}  write a 2D block starting at "start" (row-major)
- {"op":"clear","ref":"C4"}  or  {"op":"clear","range":"A1:C3"}       empty a cell or a range
- {"op":"insertRow","at":3}        insert a blank row before row 3 (existing rows shift down)
- {"op":"insertCol","at":2}        insert a blank column before column 2 (B) — existing columns shift right
- {"op":"deleteRow","at":3}        delete row 3
- {"op":"deleteCol","at":2}        delete column 2 (B)
- {"op":"format","range":"A1:D1","bold":true}   style cells. Props: bold, italic, underline (booleans), align ("left"|"center"|"right"), color ("#RRGGBB" text), bg ("#RRGGBB" fill). Use "range" OR "ref".
- {"op":"clearFormat","range":"A1:D1"}   remove styling
- {"op":"resize","rows":30,"cols":10}   change the grid size

CRITICAL RULES:
- For ANY calculation (totals, sums, averages, growth, etc.) emit a FORMULA string, never a pre-computed number. The engine recomputes live. Supported: =SUM(A1:A9), =AVERAGE(B2:B10), =MIN, =MAX, =COUNT, =COUNTA, =PRODUCT, =ROUND(x,2), =ABS, =SQRT, =POWER(x,y), =IF(cond,a,b), =CONCAT(...), and operators + - * / ^ % with parentheses and comparisons = <> < > <= >=.
  Example total: {"op":"set","ref":"B11","value":"=SUM(B2:B10)"}
- Put headers in row 1 unless the user says otherwise. When asked to "make a table" of given data, use ONE setRange from A1 including a header row.
- After insert/delete row/column, re-emit any affected formulas with corrected ranges.
- Keep within 60 columns and 2000 rows.
- If the instruction is unclear, off-topic, or impossible, return the {"error": ...} shape instead of guessing.

Examples:
Instruction: "make a table of fruits and prices: apple 30, banana 10, cherry 50, then add a total row"
{"ops":[{"op":"setRange","start":"A1","values":[["Fruit","Price"],["Apple",30],["Banana",10],["Cherry",50],["Total","=SUM(B2:B4)"]]}],"message":"Built a fruit/price table with a total row."}

Instruction: "change C4 to 99"
{"ops":[{"op":"set","ref":"C4","value":"99"}],"message":"Set C4 to 99."}

Instruction: "make the header row bold and centered"
{"ops":[{"op":"format","range":"A1:D1","bold":true,"align":"center"}],"message":"Made the header row bold and centered."}

Instruction: "add a column D that multiplies B by C for each data row (rows 2 to 5)"
{"ops":[{"op":"set","ref":"D1","value":"Total"},{"op":"set","ref":"D2","value":"=B2*C2"},{"op":"set","ref":"D3","value":"=B3*C3"},{"op":"set","ref":"D4","value":"=B4*C4"},{"op":"set","ref":"D5","value":"=B5*C5"}],"message":"Added a Total column (B×C) for rows 2–5."}`;

function extractJson(s: string): string {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : "{}";
}

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("edit-slide");
  if (limited) return limited;
  try {
    await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const instruction = String(body?.instruction || "").trim();
    if (!instruction) return NextResponse.json({ error: "Tell me what to do with the sheet." }, { status: 400 });
    if (instruction.length > 1200) return NextResponse.json({ error: "That instruction is too long." }, { status: 400 });

    const sheet: Sheet = {
      cols: Math.max(1, Math.min(60, Number(body?.cols) || 8)),
      rows: Math.max(1, Math.min(2000, Number(body?.rows) || 20)),
      cells: body?.cells && typeof body.cells === "object" ? body.cells : {},
    };

    const completion = await withGroqClient((client) =>
      client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: `Current sheet:\n${sheetToPrompt(sheet)}\n\nInstruction: "${instruction}"\n\nReturn the JSON.` },
        ],
      }),
    );

    const parsed = JSON.parse(extractJson(completion.choices[0]?.message?.content || "{}"));
    if (parsed?.error) return NextResponse.json({ error: String(parsed.error).slice(0, 240) });
    const ops = Array.isArray(parsed?.ops) ? parsed.ops : [];
    if (!ops.length) return NextResponse.json({ error: "I couldn't turn that into a sheet change. Try rephrasing." });
    return NextResponse.json({ ops, message: typeof parsed?.message === "string" ? parsed.message.slice(0, 200) : "Done." });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "The assistant failed. Please try again." }, { status });
  }
}
