import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { getUserPlanServer, PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";
import { refineResume } from "@/lib/groqResume";
import { FREE_FOR_ALL } from "@/lib/plans";
import type { ResumeData } from "@/lib/resumeTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Refine a resume's wording with AI. Premium (Pro / Pro Plus). */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("edit-slide");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    if (!FREE_FOR_ALL) {
      const plan = await getUserPlanServer(uid);
      if (plan === "free") throw new PlanLimitError("Refine with AI is a Pro feature. Upgrade to Pro.", "plan_feature_locked", 403);
    }
    const body = await req.json().catch(() => ({}));
    const resume = body?.resume as ResumeData;
    if (!resume || typeof resume !== "object") return NextResponse.json({ error: "Resume required." }, { status: 400 });

    const refined = await refineResume(resume);
    return NextResponse.json({ resume: refined });
  } catch (err: any) {
    if (err instanceof PlanLimitError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    const status = err instanceof AuthError ? err.status : Number(err?.status) || 500;
    return NextResponse.json({ error: err?.message || "Refine failed." }, { status });
  }
}
