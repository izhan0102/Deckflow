/**
 * Issue reports in Firebase Realtime Database.
 *
 * Layout:
 *   /reports/{id}
 *     - username   // display name (or email prefix) — no other PII
 *     - text       // the report body
 *     - createdAt  // server timestamp
 *
 * We deliberately store ONLY the username + report text. No email, no uid,
 * no deck data — so the public /reports list can't leak anything sensitive.
 *
 * Suggested Realtime DB rules:
 *   "reports": {
 *     ".read": true,
 *     "$id": {
 *       ".write": "auth != null && !data.exists()
 *                  && newData.hasChildren(['username','text','createdAt'])
 *                  && newData.child('text').isString()
 *                  && newData.child('text').val().length <= 2000"
 *     }
 *   }
 */

import { get, onValue, push, ref, serverTimestamp, set, child } from "firebase/database";
import { getFirebaseDb } from "./firebase";

export type IssueReport = {
  id: string;
  username: string;
  text: string;
  createdAt: number;
};

/** Submit an issue report. Stores only username + text (+ timestamp). */
export async function submitReport(username: string, text: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Reporting is unavailable right now.");
  const body = text.trim().slice(0, 2000);
  if (!body) throw new Error("Please describe the issue.");
  const node = push(ref(db, "reports"));
  await set(node, {
    username: (username || "Anonymous").slice(0, 80),
    text: body,
    createdAt: serverTimestamp(),
  });
}

/** Live-read all reports, newest first. */
export function watchReports(cb: (items: IssueReport[]) => void): () => void {
  const db = getFirebaseDb();
  if (!db) { cb([]); return () => {}; }
  const node = ref(db, "reports");
  const unsub = onValue(node, (snap) => {
    const val = snap.val() || {};
    const items: IssueReport[] = Object.entries(val).map(([id, row]: [string, any]) => ({
      id,
      username: row?.username || "Anonymous",
      text: row?.text || "",
      createdAt: typeof row?.createdAt === "number" ? row.createdAt : 0,
    }));
    items.sort((a, b) => b.createdAt - a.createdAt);
    cb(items);
  });
  return () => unsub();
}

/** One-shot read (used by the /reports page on first paint). */
export async function getReports(): Promise<IssueReport[]> {
  const db = getFirebaseDb();
  if (!db) return [];
  const snap = await get(child(ref(db), "reports"));
  if (!snap.exists()) return [];
  const val = snap.val() || {};
  const items: IssueReport[] = Object.entries(val).map(([id, row]: [string, any]) => ({
    id,
    username: row?.username || "Anonymous",
    text: row?.text || "",
    createdAt: typeof row?.createdAt === "number" ? row.createdAt : 0,
  }));
  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
}
