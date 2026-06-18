import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError, getAdminAppOrThrow } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { getSeat, addMember, removeMember, setSeatName } from "@/lib/seatsServer";

export const runtime = "nodejs";

/** Shape the seat for the client: members as an array (the UI maps over it). */
function view(s: Awaited<ReturnType<typeof getSeat>>) {
  if (!s) return null;
  return { kind: s.kind, name: s.name, max: s.max, active: s.active, expiresAt: s.expiresAt, members: Object.values(s.members || {}) };
}

/** Owner-only seat management for Team / Organisation plans. */
export async function POST(req: NextRequest) {
  const limited = rateLimitResponse("edit-slide");
  if (limited) return limited;
  try {
    const uid = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const seat = await getSeat(uid);
      return NextResponse.json({ seat: view(seat) });
    }

    const seat = await getSeat(uid);
    if (!seat || !seat.active) {
      return NextResponse.json({ error: "You don't have an active Team or Organisation plan." }, { status: 403 });
    }

    if (action === "add") {
      const email = String(body?.email || "").trim().toLowerCase();
      // Don't let an owner add their own email (they already have Pro).
      try {
        const me = await getAuth(getAdminAppOrThrow()).getUser(uid);
        if (me.email && me.email.toLowerCase() === email) {
          return NextResponse.json({ error: "You're already on Pro — no seat needed for yourself." }, { status: 400 });
        }
      } catch { /* ignore */ }
      const r = await addMember(uid, email);
      if (!r.ok) return NextResponse.json({ error: r.error || "Couldn't add member." }, { status: 400 });
      return NextResponse.json({ seat: view(await getSeat(uid)) });
    }

    if (action === "remove") {
      await removeMember(uid, String(body?.email || ""));
      return NextResponse.json({ seat: view(await getSeat(uid)) });
    }

    if (action === "name") {
      await setSeatName(uid, String(body?.name || ""));
      return NextResponse.json({ seat: view(await getSeat(uid)) });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || "Seat action failed." }, { status });
  }
}
