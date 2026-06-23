import { NextRequest, NextResponse } from "next/server";
import { generateChart } from "@/lib/groq";
import type { ChartType } from "@/lib/charts";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireCredits, deductCredits } from "@/lib/credits";
import { PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Generate a data chart from a short description. The client passes a topic
 * or dataset ("fertility rate by country", "our Q1 revenue split") and an
 * optional chart type; we return a ChartSpec the editor can render, edit,
 * and drop onto a slide.
 */

const VALID: ChartType[] = ["bar", "line", "area", "pie", "donut"];

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("visualize");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireCredits(uid);
    const { description, type } = (await req.json()) as { description?: string; type?: ChartType };
    if (!description || description.trim().length < 2) {
      return NextResponse.json({ error: "Describe the data or topic first." }, { status: 400 });
    }
    const chartType = type && VALID.includes(type) ? type : undefined;
    const spec = await generateChart({ description: description.trim(), type: chartType });
    if (!spec) {
      return NextResponse.json({ error: "Couldn't build a chart from that. Try describing the data differently." }, { status: 422 });
    }
    deductCredits(uid, "visualize").catch(() => {});
    return NextResponse.json({ spec });
  } catch (err: any) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[/api/visualize] error:", err);
    return NextResponse.json({ error: err?.message || "Could not generate the visual." }, { status: 500 });
  }
}
