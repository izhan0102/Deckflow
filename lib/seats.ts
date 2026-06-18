"use client";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "./firebase";

export type SeatKind = "team" | "org";
export type SeatView = {
  kind: SeatKind;
  name: string;
  max: number;
  active: boolean;
  expiresAt: number;
  members: string[];
};

/** Live-read the signed-in user's own seat plan (Team/Org). null = none. */
export function watchOwnSeat(uid: string, cb: (seat: SeatView | null) => void): () => void {
  const db = getFirebaseDb();
  if (!db) { cb(null); return () => {}; }
  const node = ref(db, `seats/${uid}`);
  const unsub = onValue(node, (snap) => {
    if (!snap.exists()) { cb(null); return; }
    const v = snap.val() || {};
    const kind: SeatKind = v.kind === "org" ? "org" : "team";
    cb({
      kind,
      name: typeof v.name === "string" ? v.name : "",
      max: typeof v.max === "number" ? v.max : (kind === "org" ? 20 : 3),
      active: v.active !== false && (typeof v.expiresAt !== "number" || v.expiresAt > Date.now()),
      expiresAt: typeof v.expiresAt === "number" ? v.expiresAt : 0,
      members: v.members && typeof v.members === "object" ? Object.values(v.members as Record<string, string>) : [],
    });
  });
  return () => unsub();
}

export type MemberPlan = { active: boolean; ownerName: string; kind: SeatKind | null };

/** Live-read the signed-in user's membership info (who granted their Pro). */
export function watchMembership(uid: string, cb: (m: MemberPlan | null) => void): () => void {
  const db = getFirebaseDb();
  if (!db) { cb(null); return () => {}; }
  const node = ref(db, `plans/${uid}`);
  const unsub = onValue(node, (snap) => {
    const v = snap.val();
    if (!v || v.source !== "seat" || v.tier !== "pro") { cb(null); return; }
    const expOk = typeof v.expiresAt !== "number" || v.expiresAt > Date.now();
    if (!expOk) { cb(null); return; }
    cb({ active: true, ownerName: typeof v.ownerName === "string" ? v.ownerName : "", kind: v.seatKind === "org" ? "org" : v.seatKind === "team" ? "team" : null });
  });
  return () => unsub();
}
