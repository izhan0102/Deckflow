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
 *   /shared/{shareId}         // public snapshot (read-only OR collaborative)
 *     - ownerUid, deckId, deck, theme, mode ("view" | "edit"), publishedAt
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
 *           // Owner can always write. When the deck is shared in "edit" mode,
 *           // anyone with the link may write the collaborative content
 *           // (deck/theme/title) — but ownerUid and mode are pinned so a
 *           // collaborator can't hijack ownership or silently change the mode.
 *           ".write": "(auth != null && newData.child('ownerUid').val() === auth.uid) || ((data.child('mode').val() === 'edit' || newData.child('mode').val() === 'edit') && newData.child('ownerUid').val() === data.child('ownerUid').val())"
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
  shareMode?: ShareMode;
};

/** How a published deck is shared: read-only or collaboratively editable. */
export type ShareMode = "view" | "edit";

/** Public payload for a shared deck (returned by load/watch). */
export type SharedDeckData = {
  deck: Deck;
  theme: Theme;
  title: string;
  mode: ShareMode;
  ownerUid?: string;
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

export async function deleteDeck(uid: string, deckId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const stored = await loadDeck(uid, deckId);
  await remove(ref(db, `decks/${uid}/${deckId}`));
  if (stored?.shareId) {
    await remove(ref(db, `shared/${stored.shareId}`)).catch(() => {});
  }
}

/** Rename a deck. Updates the list meta and the deck's own title so the
 *  editor opens with the new title. Deliberately does NOT touch
 *  `updatedAt` — a rename shouldn't bump the deck to most-recent (which
 *  would move it into "Continue working"). */
export async function renameDeck(uid: string, deckId: string, title: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const clean = (title || "").trim().slice(0, 200) || "Untitled deck";
  await update(ref(db, `decks/${uid}/${deckId}`), sanitize({
    "meta/title": clean,
    "deck/title": clean,
  }));
}

/** Duplicate a deck into a brand-new row ("… (Copy)"). Returns the new id,
 *  or null if the source couldn't be loaded. */
export async function duplicateDeck(uid: string, deckId: string): Promise<string | null> {
  const stored = await loadDeck(uid, deckId);
  if (!stored) return null;
  const copy: Deck = {
    ...stored.deck,
    title: `${stored.deck.title || "Untitled deck"} (Copy)`,
  };
  return createDeck(uid, copy, stored.theme);
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

/** Publish (or refresh) a shared copy of a deck and return the share id.
 *  mode "view" = read-only (notes stripped); "edit" = collaborative (full deck
 *  kept so owner↔collaborator round-trips don't lose notes). */
export async function publishDeck(
  uid: string, deckId: string, mode: ShareMode = "view",
): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const stored = await loadDeck(uid, deckId);
  if (!stored) throw new Error("Deck not found.");
  const shareId = stored.shareId || `s_${rid()}`;

  await set(ref(db, `shared/${shareId}`), sanitize({
    ownerUid: uid,
    deckId,
    deck: mode === "edit" ? stored.deck : publicDeckCopy(stored.deck),
    theme: stored.theme,
    title: stored.meta?.title || "Deck",
    mode,
    publishedAt: serverTimestamp(),
  }));
  await update(ref(db, `decks/${uid}/${deckId}`), { shareId, shareMode: mode });
  return shareId;
}

/** Switch an already-published deck between read-only and collaborative edit
 *  mode. Re-pushes the appropriate deck copy so the shared node is current. */
export async function setShareMode(
  uid: string, deckId: string, mode: ShareMode,
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Cloud sync unavailable.");
  const stored = await loadDeck(uid, deckId);
  if (!stored?.shareId) throw new Error("Deck is not shared.");
  await update(ref(db, `shared/${stored.shareId}`), sanitize({
    mode,
    deck: mode === "edit" ? stored.deck : publicDeckCopy(stored.deck),
    theme: stored.theme,
  }));
  await update(ref(db, `decks/${uid}/${deckId}`), { shareMode: mode });
}

/** Collaborative write: patch the shared node's deck/theme in place. Used by
 *  the owner AND link collaborators while editing an "edit"-mode shared deck.
 *  ownerUid/mode are left untouched (the security rules pin them). */
export async function writeSharedDeck(
  shareId: string, deck: Deck, theme: Theme,
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await update(ref(db, `shared/${shareId}`), sanitize({
    deck,
    theme,
    title: deck.title || "Deck",
    publishedAt: serverTimestamp(),
  }));
}

/** Clone a shared deck into the signed-in user's own My Decks. Returns the new
 *  deck id, or null if the shared deck couldn't be read. */
export async function copySharedDeck(uid: string, shareId: string): Promise<string | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(child(ref(db), `shared/${shareId}`));
  if (!snap.exists()) return null;
  const v = snap.val();
  if (!v?.deck || !v?.theme) return null;
  const srcTitle = v.deck.title || v.title || "Shared deck";
  const copy: Deck = { ...v.deck, title: `${srcTitle} (copy)` };
  return createDeck(uid, copy, v.theme);
}

/** Build the public, read-only copy of a deck (presenter notes stripped). */
function publicDeckCopy(deck: Deck): Deck {
  const cleanSlides = deck.slides.map((s) => {
    const { notes, noteSegments, ...rest } = s as any;
    return rest;
  });
  return { ...deck, slides: cleanSlides };
}

/** If this deck is already published, refresh its public /shared snapshot so
 *  viewers of an existing share link see edits without the owner re-sharing.
 *  No-op when the deck was never published. Best-effort (callers fire & forget).
 *  Edit-mode shares keep the FULL deck (notes included); view-mode strips notes. */
export async function syncSharedDeck(
  uid: string, deckId: string, deck: Deck, theme: Theme,
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const snap = await get(ref(db, `decks/${uid}/${deckId}`));
  if (!snap.exists()) return;
  const row = snap.val() as any;
  const shareId: string | null = row?.shareId || null;
  if (!shareId) return;
  const mode: ShareMode = row?.shareMode === "edit" ? "edit" : "view";
  await update(ref(db, `shared/${shareId}`), sanitize({
    deck: mode === "edit" ? deck : publicDeckCopy(deck),
    theme,
    title: deck.title || "Deck",
    publishedAt: serverTimestamp(),
  }));
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
export async function loadSharedDeck(shareId: string): Promise<SharedDeckData | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(child(ref(db), `shared/${shareId}`));
  if (!snap.exists()) return null;
  const v = snap.val();
  return {
    deck: v.deck, theme: v.theme,
    title: v.title || v.deck?.title || "Shared deck",
    mode: v.mode === "edit" ? "edit" : "view",
    ownerUid: v.ownerUid,
  };
}

/** Live-subscribe to a public shared deck. The callback fires immediately with
 *  the current snapshot and again on every edit (owner autosave or a
 *  collaborator's write), so open viewers/editors update in real time.
 *  Returns an unsubscribe fn. */
export function watchSharedDeck(
  shareId: string,
  cb: (data: SharedDeckData | null) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) { cb(null); return () => {}; }
  const node = ref(db, `shared/${shareId}`);
  const unsub = onValue(
    node,
    (snap) => {
      if (!snap.exists()) { cb(null); return; }
      const v = snap.val();
      cb({
        deck: v.deck, theme: v.theme,
        title: v.title || v.deck?.title || "Shared deck",
        mode: v.mode === "edit" ? "edit" : "view",
        ownerUid: v.ownerUid,
      });
    },
    () => cb(null),
  );
  return unsub;
}
