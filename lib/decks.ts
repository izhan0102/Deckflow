/**
 * Deck persistence in Firebase Realtime Database.
 *
 * Layout:
 *   /decks/{uid}/{deckId}     // private to the owner
 *     - meta (title, updatedAt, ...)
 *     - deck
 *     - theme
 *     - shareId? (when published)
 *
 *   /shared/{shareId}         // public read-only snapshot
 *     - ownerUid, deckId, deck, theme, publishedAt
 *
 * Required Firebase rules to make this safe:
 *   {
 *     "rules": {
 *       "decks": {
 *         "$uid": {
 *           ".read":  "auth != null && auth.uid === $uid",
 *           ".write": "auth != null && auth.uid === $uid"
 *         }
 *       },
 *       "shared": {
 *         ".read": true,
 *         "$shareId": {
 *           ".write": "auth != null && newData.child('ownerUid').val() === auth.uid"
 *         }
 *       }
 *     }
 *   }
 */

import {
  child, get, onValue, push, ref, remove, serverTimestamp, set, update,
} from "firebase/database";
import { getFirebaseDb } from "./firebase";
import type { Deck } from "./types";
import type { Theme } from "./themes";

export type StoredDeck = {
  id: string;
  meta: {
    title: string;
    subtitle?: string;
    slides: number;
    createdAt: number | object;
    updatedAt: number | object;
  };
  deck: Deck;
  theme: Theme;
  shareId?: string;
  /** Set when the user has completed a successful Razorpay payment for
   *  this deck. Sibling of `deck` so autosave (which rewrites `deck`)
   *  cannot wipe it. */
  paid?: { paidAt: number; method: "razorpay-redirect" };
};

export type DeckListItem = {
  id: string;
  title: string;
  subtitle?: string;
  slides: number;
  updatedAt: number;
  shareId?: string;
  /** Full first slide + theme/graphic context, used to render a real
   *  preview thumbnail in dashboards and the My Decks list. */
  firstSlide?: import("./types").Slide;
  theme?: Theme;
  graphic?: string;
  graphicAccent?: string;
  fontId?: string;
};

function rid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/**
 * Realtime DB rejects writes that contain `undefined` anywhere in the tree.
 * Slide fields like `kicker`, `subtitle`, `graphicAccent`, etc. are
 * optional, so we strip undefined recursively before any save.
 */
function sanitize<T>(value: T): T {
  if (value === null || value === undefined) return value as any;
  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v)) as any;
  }
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

/* -------------------------- single-deck helpers -------------------------- */

/** Create a new deck row. Returns the new deck id. */
export async function createDeck(uid: string, deck: Deck, theme: Theme): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const id = rid();
  const node = ref(db, `decks/${uid}/${id}`);
  await set(node, sanitize({
    id,
    meta: {
      title: deck.title || "Untitled deck",
      subtitle: deck.subtitle || "",
      slides: deck.slides?.length || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    deck,
    theme,
  }));
  return id;
}

/** Patch an existing deck. */
export async function saveDeck(
  uid: string, deckId: string, deck: Deck, theme: Theme,
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const node = ref(db, `decks/${uid}/${deckId}`);
  await update(node, sanitize({
    "meta/title": deck.title || "Untitled deck",
    "meta/subtitle": deck.subtitle || "",
    "meta/slides": deck.slides?.length || 0,
    "meta/updatedAt": serverTimestamp(),
    deck,
    theme,
  }));
}

export async function loadDeck(uid: string, deckId: string): Promise<StoredDeck | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(child(ref(db), `decks/${uid}/${deckId}`));
  if (!snap.exists()) return null;
  return snap.val() as StoredDeck;
}

/**
 * Mark a deck as paid. Called after the Razorpay redirect lands on
 * /payment-success — the redirect itself is the proof. Idempotent.
 *
 * `paid` lives at the row level (sibling of `deck`) so the regular
 * autosave that rewrites `deck` cannot wipe it out.
 */
export async function markDeckPaid(uid: string, deckId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  await update(ref(db, `decks/${uid}/${deckId}`), {
    paid: { paidAt: serverTimestamp(), method: "razorpay-redirect" },
  });
}

/** Read just the paid metadata for a deck. */
export async function loadDeckPaid(
  uid: string, deckId: string,
): Promise<StoredDeck["paid"] | undefined> {
  const db = getFirebaseDb();
  if (!db) return undefined;
  const snap = await get(child(ref(db), `decks/${uid}/${deckId}/paid`));
  if (!snap.exists()) return undefined;
  return snap.val();
}

export async function deleteDeck(uid: string, deckId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const stored = await loadDeck(uid, deckId);
  await remove(ref(db, `decks/${uid}/${deckId}`));
  if (stored?.shareId) {
    await remove(ref(db, `shared/${stored.shareId}`)).catch(() => {});
  }
}

export function watchDeckList(
  uid: string, cb: (items: DeckListItem[]) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) { cb([]); return () => {}; }
  const node = ref(db, `decks/${uid}`);
  const unsub = onValue(node, (snap) => {
    const val = snap.val() || {};
    const items: DeckListItem[] = Object.values(val).map((row: any) => ({
      id: row.id,
      title: row?.meta?.title || "Untitled deck",
      subtitle: row?.meta?.subtitle || "",
      slides: row?.meta?.slides || 0,
      updatedAt: typeof row?.meta?.updatedAt === "number" ? row.meta.updatedAt : 0,
      shareId: row?.shareId,
      firstSlide: Array.isArray(row?.deck?.slides) ? row.deck.slides[0] : undefined,
      theme: row?.theme,
      graphic: row?.deck?.graphic,
      graphicAccent: row?.deck?.graphicAccent,
      fontId: row?.deck?.fontId,
    }));
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    cb(items);
  });
  return () => unsub();
}

/* ------------------------------ sharing ---------------------------------- */

/** Publish (or refresh) a public read-only copy of a deck and return the share id. */
export async function publishDeck(uid: string, deckId: string): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const stored = await loadDeck(uid, deckId);
  if (!stored) throw new Error("Deck not found.");
  const shareId = stored.shareId || `s_${rid()}`;
  await set(ref(db, `shared/${shareId}`), sanitize({
    ownerUid: uid,
    deckId,
    deck: stored.deck,
    theme: stored.theme,
    title: stored.meta?.title || "Deck",
    publishedAt: serverTimestamp(),
  }));
  await update(ref(db, `decks/${uid}/${deckId}`), { shareId });
  return shareId;
}

export async function unpublishDeck(uid: string, deckId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const stored = await loadDeck(uid, deckId);
  if (!stored?.shareId) return;
  await remove(ref(db, `shared/${stored.shareId}`)).catch(() => {});
  await update(ref(db, `decks/${uid}/${deckId}`), { shareId: null });
}

/** Public read of a shared deck (no auth required). */
export async function loadSharedDeck(
  shareId: string,
): Promise<{ deck: Deck; theme: Theme; title: string } | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(child(ref(db), `shared/${shareId}`));
  if (!snap.exists()) return null;
  const v = snap.val();
  return { deck: v.deck, theme: v.theme, title: v.title || v.deck?.title || "Shared deck" };
}
