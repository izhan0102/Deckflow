import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError, getAdminAppOrThrow } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { syncMemberPlan } from "@/lib/seatsServer";
import { getUserPlanServer } from "@/lib/planServer";

export const runtime = "nodejs";

/** Called on sign-in: materializes any team/org seat the user's email holds
 *  into their plan (grants Pro), or revokes a stale seat-granted Pro. */
export async function POST(req: NextRequest) {
  try {
    const uid = await authenticateRequest(req);
    let email: string | undefined;
    try { email = (await getAuth(getAdminAppOrThrow()).getUser(uid)).email || undefined; } catch { /* ignore */ }
    await syncMemberPlan(uid, email);
    const plan = await getUserPlanServer(uid);
    return NextResponse.json({ ok: true, plan });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Sync failed." }, { status });
  }
}
