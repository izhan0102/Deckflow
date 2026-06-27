/**
 * Deck-level operations emitted by the AI Deck Chat.
 *
 * The /api/edit-deck route returns a list of operations describing the
 * intended mutation. The applier in this file walks the list, produces
 * a new Deck object, and the editor swaps it in atomically (so undo
 * captures the whole batch as a single state).
 *
 * Why ops instead of "give me back the new deck"?
 *   1. Auditable — the chat panel can summarise what happened.
 *   2. Cheaper — bulk operations (e.g. "shorten every bullet") can
 *      patch only the affected fields rather than re-emitting whole
 *      slides.
 *   3. Safer — the applier validates each op against the current deck
 *      shape, so a malformed AI response can't corrupt structure.
 *
 * Apply order:
 *   1. Slide-content patches and replacements first, by *original*
 *      slide index. These don't change the slide count.
 *   2. Removals next, sorted descending so earlier indices stay valid
 *      while we splice from the end.
 *   3. Additions next, sorted descending by afterIndex so later inserts
 *      don't shift earlier ones.
 *   4. Reorder last (operates on the post-mutation index space).
 *   5. Deck-meta updates apply at the very end, decoupled from slides.
 *
 * The AI is told this order in the system prompt so it can reason about
 * which indices it's referring to.
 */

import type { Deck, Slide, SlideLayout, TableData } from "./types";
import type { ChartSpec } from "./charts";
import { cleanChartSpec } from "./charts";

export class DeckOpValidationError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.name = "DeckOpValidationError";
    this.status = 400;
  }
}

/* ----------------------------- op types ----------------------------- */

/** Insert a new slide after the given index. afterIndex = -1 prepends. */
export type DeckOpAddSlide = {
  type: "addSlide";
  afterIndex: number;
  slide: NewSlideSpec;
};

/** Drop the slide at index. */
export type DeckOpRemoveSlide = {
  type: "removeSlide";
  index: number;
};

/** Wholesale replace the slide at index. Layout can change. */
export type DeckOpReplaceSlide = {
  type: "replaceSlide";
  index: number;
  slide: NewSlideSpec;
};

/** Reorder slides. newOrder is the post-add/remove index list, with
 *  each entry being the index in the post-mutation deck (not the
 *  original deck). The applier validates lengths match. */
export type DeckOpReorderSlides = {
  type: "reorderSlides";
  newOrder: number[];
};

/** Targeted patch — change only specific fields on one slide. */
export type DeckOpPatchSlide = {
  type: "patchSlide";
  index: number;
  patch: SlidePatch;
};

/** Update deck-level metadata (title shown on hero / closing). */
export type DeckOpSetDeckMeta = {
  type: "setDeckMeta";
  title?: string;
  subtitle?: string;
};

export type DeckOp =
  | DeckOpAddSlide
  | DeckOpRemoveSlide
  | DeckOpReplaceSlide
  | DeckOpReorderSlides
  | DeckOpPatchSlide
  | DeckOpSetDeckMeta;

/** Spec the AI emits for a brand-new (or replacement) slide. */
export type NewSlideSpec = {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  table?: TableData;
  chart?: ChartSpec;
  notes?: string;
  kicker?: string;
  /** Mermaid source — when set, this slide becomes a diagram slide (a title
   *  with the rendered diagram beneath it). The client renders the SVG. */
  diagram?: string;
};

/** Patch shape — same vocabulary as the existing /api/edit-slide route. */
export type SlidePatch = {
  title?: string;
  subtitle?: string;
  body?: string;
  notes?: string;
  bullets?: string[];
  addBullets?: string[];
  removeBullets?: number[];
  table?: TableData;
  chart?: ChartSpec;
  layout?: SlideLayout;
  kicker?: string;
  /** Replace/set this slide's diagram (Mermaid source). */
  diagram?: string;
};


/* ----------------------------- helpers ----------------------------- */

const VALID_LAYOUTS: SlideLayout[] = [
  "title-hero", "bullets", "table", "chart", "two-column",
  "quote", "section", "references", "closing",
];

function clean(s: any): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001F\u007F\u200B-\u200F\uFEFF]/g, "").trim();
}
/** Like clean() but KEEPS newlines (\n) and tabs (\t) — Mermaid needs them. */
function sanitizeMermaid(s: any): string {
  return typeof s === "string"
    ? s.replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\uFEFF]/g, "").trim()
    : "";
}
function cleanList(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(clean).filter(Boolean);
}
function cleanTable(t: any): TableData | undefined {
  if (!t || typeof t !== "object") return undefined;
  const headers = Array.isArray(t.headers) ? t.headers.map(clean).filter(Boolean) : [];
  if (headers.length === 0) return undefined;
  const rows = Array.isArray(t.rows)
    ? t.rows
        .map((r: any) => Array.isArray(r) ? r.map(clean) : [])
        .filter((r: string[]) => r.length > 0)
        .map((r: string[]) => {
          const out = [...r];
          while (out.length < headers.length) out.push("");
          return out.slice(0, headers.length);
        })
    : [];
  if (rows.length === 0) return undefined;
  const source = clean(t.source);
  return { headers, rows, source: source || undefined };
}

function specToSlide(spec: NewSlideSpec): Slide {
  if (typeof spec.diagram === "string" && spec.diagram.trim()) {
    return {
      layout: "bullets",
      title: clean(spec.title) || "Diagram",
      bullets: [],
      notes: spec.notes ? clean(spec.notes) : undefined,
      annotations: [],
      uploadedImages: [{
        id: freshId(),
        kind: "diagram",
        mermaid: sanitizeMermaid(spec.diagram),
        dataUrl: "",
        x: 1.9, y: 1.7, w: 9.5, h: 5.2,
      }],
    };
  }
  const layout: SlideLayout = VALID_LAYOUTS.includes(spec.layout) ? spec.layout : "bullets";
  return {
    layout,
    title: clean(spec.title),
    subtitle: spec.subtitle ? clean(spec.subtitle) : undefined,
    bullets: cleanList(spec.bullets),
    body: spec.body ? clean(spec.body) : undefined,
    table: cleanTable(spec.table),
    chart: cleanChartSpec(spec.chart),
    notes: spec.notes ? clean(spec.notes) : undefined,
    kicker: spec.kicker ? clean(spec.kicker).toUpperCase().slice(0, 60) : undefined,
    annotations: [],
  };
}

function applyPatch(slide: Slide, patch: SlidePatch): Slide {
  const next: Slide = { ...slide };
  if (typeof patch.title === "string")    next.title    = clean(patch.title);
  if (typeof patch.subtitle === "string") next.subtitle = clean(patch.subtitle);
  if (typeof patch.body === "string")     next.body     = clean(patch.body);
  if (typeof patch.notes === "string")    next.notes    = clean(patch.notes);
  if (typeof patch.kicker === "string")   next.kicker   = clean(patch.kicker).toUpperCase().slice(0, 60);
  if (typeof patch.layout === "string" && VALID_LAYOUTS.includes(patch.layout)) {
    next.layout = patch.layout;
  }
  if (Array.isArray(patch.bullets)) {
    next.bullets = cleanList(patch.bullets);
  } else {
    let arr = [...(next.bullets || [])];
    if (Array.isArray(patch.removeBullets)) {
      const drop = new Set<number>(patch.removeBullets.filter((n: any) => typeof n === "number"));
      arr = arr.filter((_, i) => !drop.has(i));
    }
    if (Array.isArray(patch.addBullets)) {
      arr.push(...cleanList(patch.addBullets));
    }
    if (Array.isArray(patch.removeBullets) || Array.isArray(patch.addBullets)) {
      next.bullets = arr;
    }
  }
  if (patch.table !== undefined) {
    const t = cleanTable(patch.table);
    if (t) next.table = t;
  }
  if (patch.chart !== undefined) {
    const c = cleanChartSpec(patch.chart);
    if (c) { next.chart = c; if (next.layout !== "chart") next.layout = "chart"; }
  }
  if (typeof patch.diagram === "string" && patch.diagram.trim()) {
    const src = sanitizeMermaid(patch.diagram);
    const imgs = [...(next.uploadedImages || [])];
    const di = imgs.findIndex((im) => im.kind === "diagram");
    if (di >= 0) imgs[di] = { ...imgs[di], mermaid: src, dataUrl: "" };
    else imgs.push({ id: freshId(), kind: "diagram", mermaid: src, dataUrl: "", x: 1.9, y: 1.7, w: 9.5, h: 5.2 });
    next.uploadedImages = imgs;
    if (!next.bullets) next.bullets = [];
  }
  return next;
}


/* --------------------------- applier --------------------------- */

/**
 * Apply a list of operations to a deck and return the new deck.
 *
 * Throws on structural impossibilities (e.g. removing a slide that
 * doesn't exist). Skips no-ops silently. Always preserves the first
 * slide as title-hero and the last as closing — clamping enforces this
 * after add / remove / reorder runs.
 */
export function applyDeckOps(deck: Deck, ops: DeckOp[]): {
  deck: Deck;
  summary: string[];
} {
  const summary: string[] = [];
  let slides = [...deck.slides];
  let title = deck.title;
  let subtitle = deck.subtitle;

  // 1) Patches and replacements first (they don't shift indices).
  for (const op of ops) {
    if (op.type === "patchSlide") {
      if (op.index < 0 || op.index >= slides.length) {
        throw new DeckOpValidationError(
          `Cannot patch slide: index ${op.index} is out of bounds (deck has ${slides.length} slides).`
        );
      }
      slides[op.index] = applyPatch(slides[op.index], op.patch || {});
      summary.push(`patched slide ${op.index + 1}`);
    } else if (op.type === "replaceSlide") {
      if (op.index < 0 || op.index >= slides.length) {
        throw new DeckOpValidationError(
          `Cannot replace slide: index ${op.index} is out of bounds (deck has ${slides.length} slides).`
        );
      }
      slides[op.index] = specToSlide(op.slide);
      summary.push(`replaced slide ${op.index + 1}`);
    }
  }

  // 2) Removals.
  const removeIndices = ops
    .filter((o): o is DeckOpRemoveSlide => o.type === "removeSlide")
    .map((o) => o.index);

  const removeSeen = new Set<number>();
  for (const i of removeIndices) {
    if (i < 0 || i >= slides.length) {
      throw new DeckOpValidationError(
        `Cannot remove slide: index ${i} is out of bounds (deck has ${slides.length} slides).`
      );
    }
    if (removeSeen.has(i)) {
      throw new DeckOpValidationError(
        `Duplicate removeSlide operation for slide index ${i}.`
      );
    }
    removeSeen.add(i);
  }

  const sortedRemoveIndices = [...removeIndices].sort((a, b) => b - a);
  for (const i of sortedRemoveIndices) {
    slides.splice(i, 1);
    summary.push(`removed slide ${i + 1}`);
  }

  // 3) Additions. Validate bounds (throw on invalid), then sort by
  // afterIndex descending so later inserts don't push earlier ones
  // forward. When two additions share the same afterIndex, break the tie
  // by original operation index descending so sequential splices at the
  // same target preserve the intended relative order (#35).
  const adds = ops
    .map((o, idx) => ({ o, idx }))
    .filter((x): x is { o: DeckOpAddSlide; idx: number } => x.o.type === "addSlide")
    .filter((x) => typeof x.o.afterIndex === "number" && !!x.o.slide);

  for (const { o: op } of adds) {
    if (op.afterIndex < -1 || op.afterIndex >= slides.length) {
      throw new DeckOpValidationError(
        `Cannot add slide: afterIndex ${op.afterIndex} is out of bounds (-1 to ${slides.length - 1}).`
      );
    }
  }

  const sortedAdds = [...adds].sort((a, b) => {
    if (b.o.afterIndex !== a.o.afterIndex) return b.o.afterIndex - a.o.afterIndex;
    return b.idx - a.idx;
  });
  for (const { o: op } of sortedAdds) {
    const at = Math.max(-1, Math.min(slides.length - 1, op.afterIndex));
    slides.splice(at + 1, 0, specToSlide(op.slide));
    summary.push(`added a "${specToSlide(op.slide).title || op.slide.layout}" slide`);
  }

  // 4) Reorder (single op honored — last one wins).
  const reorderOp = [...ops].reverse().find((o): o is DeckOpReorderSlides => o.type === "reorderSlides");
  if (reorderOp) {
    if (reorderOp.newOrder.length !== slides.length) {
      throw new DeckOpValidationError(
        `Cannot reorder slides: newOrder length (${reorderOp.newOrder.length}) does not match current slide count (${slides.length}).`
      );
    }
    const seen = new Set<number>();
    const valid = reorderOp.newOrder.every((i) => {
      if (i < 0 || i >= slides.length || seen.has(i)) return false;
      seen.add(i);
      return true;
    });
    if (!valid) {
      throw new DeckOpValidationError(
        `Cannot reorder slides: newOrder contains duplicate or out-of-bounds indices.`
      );
    }
    slides = reorderOp.newOrder.map((i) => slides[i]);
    summary.push("reordered slides");
  }

  // 5) Deck-level meta.
  for (const op of ops) {
    if (op.type === "setDeckMeta") {
      if (typeof op.title === "string")    { title    = clean(op.title); summary.push("renamed deck"); }
      if (typeof op.subtitle === "string") { subtitle = clean(op.subtitle); }
    }
  }

  // Enforce structural rules: hero first, closing last.
  if (slides.length > 0) {
    if (slides[0].layout !== "title-hero") slides[0] = { ...slides[0], layout: "title-hero" };
    if (slides.length > 1) {
      const last = slides.length - 1;
      if (slides[last].layout !== "closing") {
        slides[last] = { ...slides[last], layout: "closing" };
      }
    }
  }

  return {
    deck: { ...deck, slides, title, subtitle },
    summary,
  };
}

/* ----------------------------- duplicate -------------------------------- */

/**
 * Return a deep clone of `slide` with a fresh unique id assigned to every
 * sub-object that carries an `id` field (`uploadedImages`, `annotations`,
 * `textBoxes`).  All other fields — layout, style overrides, element offsets,
 * deco overrides, text content — are preserved verbatim so the duplicate is
 * visually identical to the original.
 *
 * Using `structuredClone` (available in all modern runtimes / Node ≥ 17)
 * ensures arrays-of-objects and nested records are deep-copied, not shared.
 */
function freshId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function duplicateSlide(slide: Slide): Slide {
  const clone: Slide = structuredClone(slide);

  if (clone.uploadedImages) {
    clone.uploadedImages = clone.uploadedImages.map((img) => ({
      ...img,
      id: freshId(),
    }));
  }

  if (clone.annotations) {
    clone.annotations = clone.annotations.map((ann) => ({
      ...ann,
      id: freshId(),
    }));
  }

  if (clone.textBoxes) {
    clone.textBoxes = clone.textBoxes.map((tb) => ({
      ...tb,
      id: freshId(),
    }));
  }

  return clone;
}