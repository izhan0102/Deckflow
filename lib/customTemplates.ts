/**
 * User-designed templates ("design your own template").
 *
 * Stored per-user at /templates/{uid}/{id}. A custom template captures a
 * full visual identity — colors, per-role fonts, a background (pattern /
 * graphic / uploaded image with opacity), and decorative elements (icons /
 * images). When a user generates a deck from one of their templates, the
 * generator's output is re-skinned to match it exactly (see applyCustom-
 * TemplateToDeck in lib/applyCustomTemplate.ts).
 *
 * Firebase rules needed (deny-by-default DB):
 *   "templates": {
 *     "$uid": {
 *       ".read":  "auth != null && auth.uid === $uid",
 *       ".write": "auth != null && auth.uid === $uid"
 *     }
 *   }
 */
"use client";
import {
  get, onValue, push, ref, remove, serverTimestamp, set, update, child,
} from "firebase/database";
import { getFirebaseDb } from "./firebase";
import type { UploadedImage } from "./types";

export type TemplateBackground = {
  kind: "none" | "pattern" | "graphic" | "image";
  patternId?: string;
  patternColor?: string;
  patternOpacity?: number;   // 0..1
  graphicId?: string;
  graphicAccent?: string;
  /** base64 data URL for an uploaded PNG/JPG background. */
  imageDataUrl?: string;
  imageOpacity?: number;     // 0..1
};

export type TemplateFonts = {
  title?: string;     // font preset id (see lib/fonts)
  subtitle?: string;
  kicker?: string;
  body?: string;
};

export type CustomTemplate = {
  id: string;
  name: string;
  createdAt: number | object;
  updatedAt: number | object;
  /** Custom theme colors + base font category. */
  colors: { bg: string; fg: string; accent: string; muted: string };
  fontCategory: "sans" | "serif" | "mono";
  fonts: TemplateFonts;
  background: TemplateBackground;
  /** Decorative icons/images placed on every generated slide. */
  decorations: UploadedImage[];
};

export type CustomTemplateListItem = Pick<
  CustomTemplate, "id" | "name" | "colors" | "fontCategory" | "background"
> & { updatedAt: number };

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

export async function saveCustomTemplate(
  uid: string,
  tpl: Omit<CustomTemplate, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const id = tpl.id || rid();
  const existing = tpl.id ? await loadCustomTemplate(uid, id) : null;
  await set(ref(db, `templates/${uid}/${id}`), sanitize({
    ...tpl,
    id,
    createdAt: existing?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return id;
}

export async function loadCustomTemplate(uid: string, id: string): Promise<CustomTemplate | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(child(ref(db), `templates/${uid}/${id}`));
  return snap.exists() ? (snap.val() as CustomTemplate) : null;
}

export async function deleteCustomTemplate(uid: string, id: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await remove(ref(db, `templates/${uid}/${id}`)).catch(() => {});
}

export function watchCustomTemplates(
  uid: string, cb: (items: CustomTemplate[]) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) { cb([]); return () => {}; }
  const node = ref(db, `templates/${uid}`);
  const unsub = onValue(node, (snap) => {
    const val = snap.val() || {};
    const items = Object.values(val) as CustomTemplate[];
    items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    cb(items);
  });
  return () => unsub();
}
