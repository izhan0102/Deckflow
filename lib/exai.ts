/**
 * EX-AI assistant daily message metering (separate from the credit pool).
 *
 * Stored at `exai/{uid}/{YYYY-MM-DD}` = number of messages sent today.
 *   • Free → 3 messages/day
 *   • Pro  → 100 messages/day
 * Resets at UTC midnight (the day key changes).
 */
import { getDatabase } from "firebase-admin/database";
import { getAdminAppOrThrow } from "./firebaseAdmin";
import { PlanLimitError, getUserPlanServer } from "./planServer";
import { type PlanId, exaiDailyLimit } from "./plans";

export function exaiDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function ref(uid: string) {
  return getDatabase(getAdminAppOrThrow()).ref(`exai/${uid}/${exaiDayKey()}`);
}

export type ExaiState = { plan: PlanId; used: number; limit: number; remaining: number };

export async function getExaiState(uid: string): Promise<ExaiState> {
  const plan = await getUserPlanServer(uid);
  const limit = exaiDailyLimit(plan);
  let used = 0;
  try {
    const snap = await ref(uid).get();
    used = typeof snap.val() === "number" ? snap.val() : 0;
  } catch { /* fail open */ }
  return { plan, used, limit, remaining: Math.max(0, limit - used) };
}

/** Block if the user has used today's EX-AI messages. */
export async function requireExai(uid: string): Promise<ExaiState> {
  const state = await getExaiState(uid);
  if (state.used >= state.limit) {
    throw new PlanLimitError(
      state.plan === "pro"
        ? "You've used today's EX-AI messages. They reset tomorrow."
        : "You've used your 3 free EX-AI messages today. Upgrade to Pro for 50 a day.",
      "exai_limit",
      429,
    );
  }
  return state;
}

/** Count one message; returns the new used count. */
export async function bumpExai(uid: string): Promise<number> {
  try {
    const res = await ref(uid).transaction((c) => (typeof c === "number" && isFinite(c) ? c : 0) + 1);
    const v = res.snapshot.val();
    return typeof v === "number" ? v : 0;
  } catch { return 0; }
}
