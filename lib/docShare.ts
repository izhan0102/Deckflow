/**
 * Shared-document links. Mirrors the deck share model but for ExDoc.
 *
 * Layout:
 *   /sharedDocs/{shareId} = { doc, mode, ownerUid, title, createdAt }
 *
 * Modes:
 *   - "view": read-only. Viewers see a live, read-only A4 preview + export.
 *   - "edit": read-write. Anyone with the link can edit; changes sync live
 *     back to the same node for everyone (lightweight collaboration).
 *
 * Required DB rule (mirror of /shared):
 *   "sharedDocs": {
 *     ".read": true,
 *     "$id": {
 *       ".write": "(auth != null && newData.child('ownerUid').val() === auth.uid) ||
 *                  ((data.child('mode').val() === 'edit' || newData.child('mode').val() === 'edit') &&
 *                   newData.child('ownerUid').val() === data.child('ownerUid').val())"
 *     }
 *   }
 */
import { onValue, ref, set, update, get, child } from "firebase/database";
import { getFirebaseDb } from "./firebase";
import type { ExDoc } from "./docTypes";

export type DocShareMode = "view" | "edit";

export type SharedDocData = {
  doc: ExDoc;
  mode: DocShareMode;
  ownerUid: string;
  title: string;
};

function rid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** RTDB rejects `undefined` — strip it recursively. */
function sanitize<T>(value: T): T {
  if (value === null || value === undefined) return value as any;
  if (Array.isArray(value)) return value.map((v) => sanitize(v)) as any;
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue;
      out[k] = sanitize(v);
    }
    return out as any;
  }
  return value;
}

/** Publish (or re-publish) a document and return its share id. */
export async function publishDoc(uid: string, doc: ExDoc, mode: DocShareMode, existingId?: string): Promise<string | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const id = existingId || rid();
  await set(ref(db, `sharedDocs/${id}`), sanitize({
    doc,
    mode,
    ownerUid: uid,
    title: doc.title || "Untitled document",
    createdAt: Date.now(),
  }));
  return id;
}

/** Change a shared doc's mode (owner only, enforced by rules). */
export async function setDocShareMode(id: string, mode: DocShareMode): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await update(ref(db, `sharedDocs/${id}`), { mode });
}

/** Live write-back of an edited shared doc (read-write mode). */
export async function writeSharedDoc(id: string, doc: ExDoc): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await update(ref(db, `sharedDocs/${id}`), sanitize({ doc, title: doc.title || "Untitled document" }));
}

/** Live-watch a shared doc. */
export function watchSharedDoc(id: string, cb: (data: SharedDocData | null) => void): () => void {
  const db = getFirebaseDb();
  if (!db) { cb(null); return () => {}; }
  const node = ref(db, `sharedDocs/${id}`);
  const unsub = onValue(node, (snap) => {
    if (!snap.exists()) { cb(null); return; }
    const v = snap.val();
    if (!v?.doc) { cb(null); return; }
    cb({ doc: v.doc, mode: v.mode === "edit" ? "edit" : "view", ownerUid: v.ownerUid, title: v.title || v.doc.title || "Untitled document" });
  });
  return () => unsub();
}

/** One-shot read (e.g. for unpublish checks). */
export async function loadSharedDoc(id: string): Promise<SharedDocData | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(child(ref(db), `sharedDocs/${id}`));
  if (!snap.exists()) return null;
  const v = snap.val();
  if (!v?.doc) return null;
  return { doc: v.doc, mode: v.mode === "edit" ? "edit" : "view", ownerUid: v.ownerUid, title: v.title || "Untitled document" };
}
