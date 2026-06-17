/**
 * Resume persistence in Firebase Realtime Database (resumes/{uid}/{id}).
 * Mirrors lib/docStore.
 */
import { child, get, onValue, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { getFirebaseDb } from "./firebase";
import type { ResumeData } from "./resumeTypes";

export type StoredResume = {
  id: string;
  meta: { name: string; headline: string; createdAt: number | object; updatedAt: number | object };
  resume: ResumeData;
};

export type ResumeListItem = {
  id: string;
  name: string;
  headline: string;
  updatedAt: number;
  accent?: string;
  templateId?: string;
};

function rid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

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

export async function createResume(uid: string, resume: ResumeData): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const id = rid();
  await set(ref(db, `resumes/${uid}/${id}`), sanitize({
    id,
    meta: {
      name: resume.name || "Untitled resume",
      headline: resume.headline || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    resume,
  }));
  return id;
}

export async function saveResume(uid: string, resumeId: string, resume: ResumeData): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  await update(ref(db, `resumes/${uid}/${resumeId}`), sanitize({
    "meta/name": resume.name || "Untitled resume",
    "meta/headline": resume.headline || "",
    "meta/updatedAt": serverTimestamp(),
    resume,
  }));
}

export async function loadResume(uid: string, resumeId: string): Promise<StoredResume | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(child(ref(db), `resumes/${uid}/${resumeId}`));
  if (!snap.exists()) return null;
  return snap.val() as StoredResume;
}

export async function deleteResume(uid: string, resumeId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await remove(ref(db, `resumes/${uid}/${resumeId}`));
}

export function watchResumeList(uid: string, cb: (items: ResumeListItem[]) => void): () => void {
  const db = getFirebaseDb();
  if (!db) { cb([]); return () => {}; }
  const node = ref(db, `resumes/${uid}`);
  const unsub = onValue(node, (snap) => {
    const val = snap.val() || {};
    const items: ResumeListItem[] = Object.values(val).map((row: any) => ({
      id: row.id,
      name: row?.meta?.name || "Untitled resume",
      headline: row?.meta?.headline || "",
      updatedAt: typeof row?.meta?.updatedAt === "number" ? row.meta.updatedAt : 0,
      accent: row?.resume?.accent,
      templateId: row?.resume?.templateId,
    }));
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    cb(items);
  });
  return () => unsub();
}
