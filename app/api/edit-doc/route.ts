import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/firebaseAdmin";
import { requireCredits, deductCredits } from "@/lib/credits";
import { PlanLimitError } from "@/lib/planServer";
import { rateLimitResponse } from "@/lib/rateLimit";
import { editDoc } from "@/lib/groqDoc";
import type { DocBlock } from "@/lib/docTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Apply a natural-language instruction to an existing document. */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("edit-slide");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    await requireCredits(uid);
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "");
    const subtitle = body?.subtitle ? String(body.subtitle) : undefined;
    const blocks: DocBlock[] = Array.isArray(body?.blocks) ? body.blocks : [];
    const instruction = String(body?.instruction || "").trim();
    if (!instruction) return NextResponse.json({ error: "Tell me what to change." }, { status: 400 });
    if (instruction.length > 1000) return NextResponse.json({ error: "Instruction too long." }, { status: 400 });

    // Manually-added images can't round-trip through the model — preserve them.
    const images = blocks.map((b, i) => ({ b, i })).filter((x) => x.b.type === "image");

    const result = await editDoc({ title, subtitle, blocks, instruction });
    const merged = [...result.blocks];
    for (const { b, i } of images) merged.splice(Math.min(i, merged.length), 0, b);

    deductCredits(uid, "editSlide").catch(() => {});
    return NextResponse.json({ doc: { title: result.title, subtitle: result.subtitle, blocks: merged } });
  } catch (err: any) {
    if (err instanceof PlanLimitError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    const status = err instanceof AuthError ? err.status : Number(err?.status) || 500;
    return NextResponse.json({ error: err?.message || "Edit failed." }, { status });
  }
}
