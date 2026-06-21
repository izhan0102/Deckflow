import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireDeckAllowance, incrementMonthlyGenerationsServer, getUserPlanServer, requireDailyAllowance, incrementDailyServer, PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";
import { generateDoc } from "@/lib/groqDoc";
import { FREE_FOR_ALL } from "@/lib/plans";
import type { DocDensity } from "@/lib/docTypes";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Generate a structured document (blocks) from a topic, page count, and density. */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("generate");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    // AI Documents are a premium feature — Pro / Pro Plus only.
    if (!FREE_FOR_ALL) {
      const plan = await getUserPlanServer(uid);
      if (plan === "free") {
        throw new PlanLimitError("AI Documents are a Pro feature. Upgrade to Pro.", "plan_feature_locked", 403);
      }
    }
    await requireDeckAllowance(uid); // documents count against the same monthly allowance
    await requireDailyAllowance(uid); // daily safety cap (all tiers)
    const body = await req.json().catch(() => ({}));
    const topic = String(body?.topic || "").trim();
    const pages = Math.min(20, Math.max(1, Number(body?.pages) || 3));
    const density: DocDensity = ["concise", "balanced", "detailed", "comprehensive"].includes(body?.density) ? body.density : "balanced";
    const directives = typeof body?.directives === "string" ? body.directives.slice(0, 600) : "";
    if (topic.length < 5) return NextResponse.json({ error: "Topic is required (min 5 chars)." }, { status: 400 });

    const doc = await generateDoc({ topic, pages, density, directives });
    if (doc.blocks.length === 0) return NextResponse.json({ error: "Generation returned no content.", code: "parse" }, { status: 502 });

    incrementMonthlyGenerationsServer(uid).catch(() => {});
    incrementDailyServer(uid).catch(() => {});
    return NextResponse.json({ doc });
  } catch (err: any) {
    if (err instanceof PlanLimitError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    const status = err instanceof AuthError ? err.status : Number(err?.status) || 500;
    const msg = String(err?.message || "Generation failed.");
    const code = /json|parse/i.test(msg) ? "parse" : /rate|quota/i.test(msg) ? "rate_limit" : "unknown";
    return NextResponse.json({ error: msg, code }, { status });
  }
}
