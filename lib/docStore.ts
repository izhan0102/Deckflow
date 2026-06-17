/**
 * Document persistence in Firebase Realtime Database.
 *
 * Layout:
 *   /docs/{uid}/{docId}
 *     - meta (title, subtitle, blocks, createdAt, updatedAt)
 *     - doc  (the full ExDoc: title, subtitle, theme, blocks)
 *
 * Required rules (mirror of /decks):
 *   "docs": { "$uid": {
 *     ".read":  "auth != null && auth.uid === $uid",
 *     ".write": "auth != null && auth.uid === $uid"
 *   }}
 */
import { child, get, onValue, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { getFirebaseDb } from "./firebase";
import type { ExDoc, DocTheme } from "./docTypes";

export type StoredDoc = {
  id: string;
  meta: { title: string; subtitle?: string; blocks: number; createdAt: number | object; updatedAt: number | object };
  doc: ExDoc;
};

export type DocListItem = {
  id: string;
  title: string;
  subtitle?: string;
  blocks: number;
  updatedAt: number;
  theme?: DocTheme;
};

function rid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/** RTDB rejects `undefined` anywhere in the tree — strip it recursively. */
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

/** Create a new document row. Returns the new id. */
export async function createDoc(uid: string, doc: ExDoc): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const id = rid();
  await set(ref(db, `docs/${uid}/${id}`), sanitize({
    id,
    meta: {
      title: doc.title || "Untitled document",
      subtitle: doc.subtitle || "",
      blocks: doc.blocks?.length || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    doc,
  }));
  return id;
}

/** Patch an existing document. */
export async function saveDoc(uid: string, docId: string, doc: ExDoc): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  await update(ref(db, `docs/${uid}/${docId}`), sanitize({
    "meta/title": doc.title || "Untitled document",
    "meta/subtitle": doc.subtitle || "",
    "meta/blocks": doc.blocks?.length || 0,
    "meta/updatedAt": serverTimestamp(),
    doc,
  }));
}

export async function loadDoc(uid: string, docId: string): Promise<StoredDoc | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(child(ref(db), `docs/${uid}/${docId}`));
  if (!snap.exists()) return null;
  return snap.val() as StoredDoc;
}

export async function deleteDoc(uid: string, docId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await remove(ref(db, `docs/${uid}/${docId}`));
}

export function watchDocList(uid: string, cb: (items: DocListItem[]) => void): () => void {
  const db = getFirebaseDb();
  if (!db) { cb([]); return () => {}; }
  const node = ref(db, `docs/${uid}`);
  const unsub = onValue(node, (snap) => {
    const val = snap.val() || {};
    const items: DocListItem[] = Object.values(val).map((row: any) => ({
      id: row.id,
      title: row?.meta?.title || "Untitled document",
      subtitle: row?.meta?.subtitle || "",
      blocks: row?.meta?.blocks || 0,
      updatedAt: typeof row?.meta?.updatedAt === "number" ? row.meta.updatedAt : 0,
      theme: row?.doc?.theme,
    }));
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    cb(items);
  });
  return () => unsub();
}
