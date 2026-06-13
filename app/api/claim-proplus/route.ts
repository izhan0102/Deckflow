import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "firebase-admin/database";
import { authenticateRequest, AuthError, getAdminAppOrThrow } from "@/lib/firebaseAdmin";
import { isPromoOpen } from "@/lib/plans";

/**
 * Promo activation: grants the signed-in user a 1-month Pro Plus pass.
 *
 * Abuse guard: one device may activate Pro Plus for one account only.
 * The client sends a persistent device id; we record `promoClaims/{deviceId}`
 * server-side (the admin SDK bypasses DB rules, so no rule changes are
 * needed). A second, different account from the same device is refused.
 *
 * The grant is written to `plans/{uid}` as { tier, activatedAt, expiresAt }.
 * Expiry is honored everywhere by resolvePlanFromNode, so it reverts to
 * free automatically after a month — no cron needed.
 */

export const dynamic = "force-dynamic";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** RTDB keys can't contain . # $ [ ] / — keep device ids to safe chars. */
function sanitizeDeviceId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (id.length < 8 || id.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return id;
}

export async function POST(req: NextRequest) {
  // 1) Must be signed in with a verified email.
  let uid: string;
  try {
    uid = await authenticateRequest(req);
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    if (status === 403) {
      return NextResponse.json(
        { ok: false, code: "unverified", error: "Verify your email first, then come back to claim Pro Plus." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, code: "unauthorized", error: "Please sign in to claim Pro Plus." },
      { status: 401 },
    );
  }

  // 2) Identify the device.
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const deviceId = sanitizeDeviceId(body?.deviceId);
  if (!deviceId) {
    return NextResponse.json(
      { ok: false, code: "bad_device", error: "Couldn't identify this device. Refresh and try again." },
      { status: 400 },
    );
  }

  // 3) Offer window — the promo only accepts activations until the deadline.
  if (!isPromoOpen()) {
    return NextResponse.json(
      { ok: false, code: "offer_expired", error: "This free Pro Plus offer has ended." },
      { status: 410 },
    );
  }

  try {
    const db = getDatabase(getAdminAppOrThrow());
    const claimRef = db.ref(`promoClaims/${deviceId}`);
    const claimSnap = await claimRef.get();

    const existing = claimSnap.exists() ? (claimSnap.val() as { uid?: string } | null) : null;
    const sameAccount = !!existing?.uid && existing.uid === uid;

    // A different account already used this device → refuse.
    if (existing?.uid && !sameAccount) {
      return NextResponse.json(
        { ok: false, code: "device_used", error: "This device has already activated Pro Plus on another account." },
        { status: 409 },
      );
    }

    const now = Date.now();
    const expiresAt = now + MONTH_MS;

    // Grant / refresh the pass. update() preserves any other plan fields.
    await db.ref(`plans/${uid}`).update({
      tier: "proplus",
      activatedAt: now,
      expiresAt,
      source: "promo",
    });
    await claimRef.set({ uid, at: now, expiresAt });

    return NextResponse.json({
      ok: true,
      plan: "proplus",
      expiresAt,
      alreadyClaimed: sameAccount,
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[claim-proplus] failed:", e);
    return NextResponse.json(
      { ok: false, code: "server", error: "Couldn't activate Pro Plus right now. Please try again." },
      { status: 500 },
    );
  }
}
