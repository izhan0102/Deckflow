/**
 * Server-side seat management for Team / Organisation plans (Admin SDK).
 *
 * Layout:
 *   seats/{ownerUid}          { kind: "team"|"org", max, active, expiresAt, members: { emailKey: email } }
 *   memberSeats/{emailKey}    { ownerUid, expiresAt }   // reverse index
 *   plans/{uid}               members get { tier:"pro", source:"seat", expiresAt, ownerUid } on sign-in
 *
 * Owner Pro itself is written by grantProduct (razorpayServer). Members are
 * materialized into plans/{uid} by syncMemberPlan when they sign in, so every
 * existing plan reader (client + server) keeps working unchanged.
 */
import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import { PRODUCTS } from "./plans";

export type SeatKind = "team" | "org";

export function emailKey(email: string): string {
  return (email || "").trim().toLowerCase().replace(/[.#$/\[\]]/g, "_");
}

export type SeatRecord = {
  kind: SeatKind;
  name: string;
  max: number;
  active: boolean;
  expiresAt: number;
  members: Record<string, string>;
};

export async function getSeat(ownerUid: string): Promise<SeatRecord | null> {
  const db = getDatabase(getAdminAppOrThrow());
  const snap = await db.ref(`seats/${ownerUid}`).get();
  if (!snap.exists()) return null;
  const v = snap.val() || {};
  const kind: SeatKind = v.kind === "org" ? "org" : "team";
  return {
    kind,
    name: typeof v.name === "string" ? v.name : "",
    max: typeof v.max === "number" ? v.max : PRODUCTS[kind].seats,
    active: v.active !== false && (typeof v.expiresAt !== "number" || v.expiresAt > Date.now()),
    expiresAt: typeof v.expiresAt === "number" ? v.expiresAt : 0,
    members: v.members && typeof v.members === "object" ? v.members : {},
  };
}

/** Create or renew an owner's seat plan (preserving existing members + name). */
export async function createOrRenewSeat(ownerUid: string, kind: SeatKind, expiresAt: number): Promise<void> {
  const db = getDatabase(getAdminAppOrThrow());
  const existing = await getSeat(ownerUid);
  const members = existing?.members || {};
  const name = existing?.name || "";
  await db.ref(`seats/${ownerUid}`).update({
    kind, max: PRODUCTS[kind].seats, active: true, expiresAt,
  });
  // Refresh each existing member's reverse-index (expiry, name, kind).
  for (const ek of Object.keys(members)) {
    await db.ref(`memberSeats/${ek}`).update({ ownerUid, expiresAt, name, kind }).catch(() => {});
  }
}

/** Set the team/organisation display name; propagate it to all members. */
export async function setSeatName(ownerUid: string, name: string): Promise<void> {
  const db = getDatabase(getAdminAppOrThrow());
  const clean = String(name || "").trim().slice(0, 80);
  const seat = await getSeat(ownerUid);
  if (!seat) return;
  await db.ref(`seats/${ownerUid}/name`).set(clean);
  for (const ek of Object.keys(seat.members)) {
    await db.ref(`memberSeats/${ek}`).update({ name: clean }).catch(() => {});
  }
}

export async function addMember(ownerUid: string, email: string): Promise<{ ok: boolean; error?: string }> {
  const e = (email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: "Enter a valid email." };
  const seat = await getSeat(ownerUid);
  if (!seat || !seat.active) return { ok: false, error: "No active team/organisation plan." };
  const ek = emailKey(e);
  const already = !!seat.members[ek];
  if (!already && Object.keys(seat.members).length >= seat.max) {
    return { ok: false, error: `You've used all ${seat.max} seats.` };
  }
  const db = getDatabase(getAdminAppOrThrow());
  await db.ref(`seats/${ownerUid}/members/${ek}`).set(e);
  await db.ref(`memberSeats/${ek}`).set({ ownerUid, expiresAt: seat.expiresAt, name: seat.name, kind: seat.kind });
  return { ok: true };
}

export async function removeMember(ownerUid: string, email: string): Promise<{ ok: boolean }> {
  const ek = emailKey(email);
  const db = getDatabase(getAdminAppOrThrow());
  await db.ref(`seats/${ownerUid}/members/${ek}`).remove().catch(() => {});
  // Only clear the reverse index if it still points to this owner.
  const snap = await db.ref(`memberSeats/${ek}`).get();
  if (snap.exists() && snap.val()?.ownerUid === ownerUid) {
    await db.ref(`memberSeats/${ek}`).remove().catch(() => {});
  }
  return { ok: true };
}

/**
 * Materialize a member's seat into plans/{uid} (called on sign-in). If the
 * user's email holds an active seat, grant Pro (source "seat") with the seat's
 * expiry. If they previously had a seat-granted Pro but no longer qualify,
 * revoke it. Never touches a self-purchased (razorpay) plan.
 */
export async function syncMemberPlan(uid: string, email?: string): Promise<void> {
  const db = getDatabase(getAdminAppOrThrow());
  const planSnap = await db.ref(`plans/${uid}`).get();
  const plan = planSnap.val() || {};
  const now = Date.now();

  let seat: { ownerUid: string; expiresAt: number; name: string; kind: string } | null = null;
  if (email) {
    const ms = await db.ref(`memberSeats/${emailKey(email)}`).get();
    if (ms.exists()) {
      const v = ms.val();
      if (v && (typeof v.expiresAt !== "number" || v.expiresAt > now)) {
        seat = {
          ownerUid: v.ownerUid,
          expiresAt: typeof v.expiresAt === "number" ? v.expiresAt : now + 31 * 86400000,
          name: typeof v.name === "string" ? v.name : "",
          kind: v.kind === "org" ? "org" : "team",
        };
      }
    }
  }

  if (seat) {
    // Don't downgrade a self-paid plan that's better/active; only upgrade.
    if (plan.source === "razorpay" && (typeof plan.expiresAt !== "number" || plan.expiresAt > now)) return;
    await db.ref(`plans/${uid}`).update({ tier: "pro", source: "seat", ownerUid: seat.ownerUid, ownerName: seat.name || null, seatKind: seat.kind, expiresAt: seat.expiresAt, activatedAt: now });
  } else if (plan.source === "seat") {
    await db.ref(`plans/${uid}`).update({ tier: "free", source: "seat-revoked", ownerUid: null, ownerName: null, seatKind: null, expiresAt: null });
  }
}
