"use client";
import { ref, get, child } from "firebase/database";
import { getFirebaseDb } from "./firebase";
import { resolvePlanFromNode, exaiDailyLimit, DEFAULT_PLAN, type PlanId } from "./plans";

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export type ExaiRemaining = { plan: PlanId; used: number; limit: number; remaining: number };

/** One-shot read of today's EX-AI message usage for the live counter. */
export async function readExaiRemaining(uid: string): Promise<ExaiRemaining> {
  const db = getFirebaseDb();
  const fallback: ExaiRemaining = { plan: DEFAULT_PLAN, used: 0, limit: exaiDailyLimit(DEFAULT_PLAN), remaining: exaiDailyLimit(DEFAULT_PLAN) };
  if (!db) return fallback;
  try {
    const [u, p] = await Promise.all([
      get(child(ref(db), `exai/${uid}/${dayKey()}`)),
      get(child(ref(db), `plans/${uid}`)),
    ]);
    const plan = p.exists() ? resolvePlanFromNode(p.val()) : DEFAULT_PLAN;
    const limit = exaiDailyLimit(plan);
    const used = typeof u.val() === "number" ? u.val() : 0;
    return { plan, used, limit, remaining: Math.max(0, limit - used) };
  } catch {
    return fallback;
  }
}
