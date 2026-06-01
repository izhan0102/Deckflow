"use client";
import { useMemo } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import type { Deck, Slide, SlideLayout } from "@/lib/types";
import { stripHtml } from "@/lib/richText";

/**
 * Outline view of a deck.
 *
 * Surfaces EVERY editable text field of each slide in one screen, not
 * just bullets: kicker, title, subtitle, body (quotes / section lead-ins),
 * bullets, the two-column labels, and any annotations the AI placed
 * (footers, team names, corner callouts). Lets the user restructure the
 * whole deck — edit any text, reorder, add, or delete slides.
 *
 * Safety: slides are edited by spreading the existing object, so anything
 * not surfaced here (layout, chart, table, images, variants, notes) is
 * preserved untouched. Title/subtitle/body/bullets may carry inline
 * rich-text HTML; we show it as plain text and write back plain text on
 * edit (formatting is re-applied in slide view if needed).
 */
export default function OutlineEditor({
  deck, setDeck, active, setActive,
}: {
  deck: Deck;
  setDeck: (d: Deck) => void;
  active: number;
  setActive: (i: number) => void;
}) {
  const slides = deck.slides;
  const commit = (next: Slide[]) => setDeck({ ...deck, slides: next });
  const patch = (i: number, p: Partial<Slide>) =>
    commit(slides.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
    setActive(j);
  };

  const remove = (i: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, idx) => idx !== i);
    commit(next);
    setActive(Math.max(0, Math.min(i, next.length - 1)));
  };

  const addAfter = (i: number) => {
    const blank: Slide = {
      layout: "bullets" as SlideLayout,
      title: "New slide",
      bullets: ["New point"],
      annotations: [],
    };
    const next = [...slides];
    next.splice(i + 1, 0, blank);
    commit(next);
    setActive(i + 1);
  };

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.02] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Outline</h2>
          <p className="mt-0.5 text-[12px] text-white/50">
            Edit every piece of text, reorder, add or remove slides. Design, charts, and images are kept.
          </p>
        </div>
        <span className="text-[11px] text-white/40">{slides.length} slides</span>
      </div>

      <ol className="space-y-2.5">
        {slides.map((s, i) => (
          <OutlineRow
            key={i}
            index={i}
            slide={s}
            isActive={i === active}
            isFirst={i === 0}
            isLast={i === slides.length - 1}
            canDelete={slides.length > 1}
            onFocus={() => setActive(i)}
            onPatch={(p) => patch(i, p)}
            onUp={() => move(i, -1)}
            onDown={() => move(i, 1)}
            onDelete={() => remove(i)}
            onAdd={() => addAfter(i)}
          />
        ))}
      </ol>
    </div>
  );
}

/* ----------------------------- field labels ----------------------------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/35">
      {children}
    </div>
  );
}

function OutlineRow({
  index, slide, isActive, isFirst, isLast, canDelete,
  onFocus, onPatch, onUp, onDown, onDelete, onAdd,
}: {
  index: number;
  slide: Slide;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onFocus: () => void;
  onPatch: (p: Partial<Slide>) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  onAdd: () => void;
}) {
  const layout = slide.layout;

  // Plain-text mirrors of each field (strip inline rich-text HTML).
  const titleText = useMemo(() => stripHtml(slide.title || ""), [slide.title]);
  const subtitleText = useMemo(() => stripHtml(slide.subtitle || ""), [slide.subtitle]);
  const bodyText = useMemo(() => stripHtml(slide.body || ""), [slide.body]);
  const bulletsText = useMemo(
    () => (slide.bullets || []).map((b) => stripHtml(b)).join("\n"),
    [slide.bullets],
  );

  const hasBullets = layout === "bullets" || layout === "two-column" || (slide.bullets && slide.bullets.length > 0);
  const isTwoCol = layout === "two-column";
  // body is used by quote (the quotation) and section (lead-in); also any
  // slide that happens to carry one.
  const hasBody = layout === "quote" || layout === "section" || !!slide.body;
  // kicker is the small line above a hero title.
  const hasKicker = layout === "title-hero" || !!slide.kicker;

  const setBullets = (raw: string) => {
    const bullets = raw
      .split("\n")
      .map((l) => l.replace(/^\s*[-*•]\s*/, ""))
      .filter((l) => l.trim().length > 0);
    onPatch({ bullets });
  };

  const setAnnotationText = (annIdx: number, text: string) => {
    const annotations = (slide.annotations || []).map((a, k) =>
      k === annIdx ? { ...a, text } : a,
    );
    onPatch({ annotations });
  };

  return (
    <li
      onMouseDown={onFocus}
      className={`group rounded-xl border p-3 transition ${
        isActive ? "border-white/35 bg-white/[0.05]" : "border-white/10 bg-white/[0.02] hover:border-white/20"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Index + grip */}
        <div className="mt-1 flex shrink-0 items-center gap-1 text-white/30">
          <GripVertical size={13} className="hidden sm:block" />
          <span className="grid h-5 w-5 place-items-center rounded-md bg-white/8 text-[11px] font-semibold tabular-nums text-white/60">
            {index + 1}
          </span>
        </div>

        {/* Fields */}
        <div className="min-w-0 flex-1 space-y-2.5">
          {/* layout tag */}
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/30">
            {layout.replace("-", " ")}
          </div>

          {/* Kicker */}
          {hasKicker && (
            <div>
              <FieldLabel>Kicker</FieldLabel>
              <input
                value={slide.kicker || ""}
                onChange={(e) => onPatch({ kicker: e.target.value.toUpperCase().slice(0, 60) })}
                onFocus={onFocus}
                placeholder="e.g. Q3 INVESTOR UPDATE"
                className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70 outline-none placeholder:text-white/25 focus:border-white/30"
              />
            </div>
          )}

          {/* Title */}
          <div>
            <FieldLabel>Title</FieldLabel>
            <input
              value={titleText}
              onChange={(e) => onPatch({ title: e.target.value })}
              onFocus={onFocus}
              placeholder="Slide title"
              className="w-full bg-transparent text-[14px] font-semibold text-white outline-none placeholder:text-white/30"
            />
          </div>

          {/* Subtitle */}
          {(subtitleText || layout === "title-hero" || layout === "closing") && (
            <div>
              <FieldLabel>Subtitle</FieldLabel>
              <input
                value={subtitleText}
                onChange={(e) => onPatch({ subtitle: e.target.value })}
                onFocus={onFocus}
                placeholder="Optional subtitle"
                className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[12.5px] text-white/80 outline-none placeholder:text-white/25 focus:border-white/30"
              />
            </div>
          )}

          {/* Body (quote text / section lead-in) */}
          {hasBody && (
            <div>
              <FieldLabel>{layout === "quote" ? "Quote" : "Body"}</FieldLabel>
              <textarea
                value={bodyText}
                onChange={(e) => onPatch({ body: e.target.value })}
                onFocus={onFocus}
                rows={Math.max(2, bodyText.split("\n").length)}
                placeholder={layout === "quote" ? "The quotation…" : "Lead-in text…"}
                className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-[12.5px] leading-relaxed text-white/80 outline-none placeholder:text-white/25 focus:border-white/30"
              />
            </div>
          )}

          {/* Two-column labels */}
          {isTwoCol && slide.columnLabels && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Left label</FieldLabel>
                <input
                  value={slide.columnLabels.left}
                  onChange={(e) => onPatch({ columnLabels: { left: e.target.value, right: slide.columnLabels!.right } })}
                  onFocus={onFocus}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[12px] text-white/80 outline-none focus:border-white/30"
                />
              </div>
              <div>
                <FieldLabel>Right label</FieldLabel>
                <input
                  value={slide.columnLabels.right}
                  onChange={(e) => onPatch({ columnLabels: { left: slide.columnLabels!.left, right: e.target.value } })}
                  onFocus={onFocus}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[12px] text-white/80 outline-none focus:border-white/30"
                />
              </div>
            </div>
          )}

          {/* Bullets */}
          {hasBullets && (
            <div>
              <FieldLabel>{isTwoCol ? "Points (one per line)" : "Bullets (one per line)"}</FieldLabel>
              <textarea
                value={bulletsText}
                onChange={(e) => setBullets(e.target.value)}
                onFocus={onFocus}
                placeholder="One bullet per line…"
                rows={Math.max(2, bulletsText.split("\n").length)}
                className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-[12.5px] leading-relaxed text-white/80 outline-none placeholder:text-white/25 focus:border-white/30"
              />
            </div>
          )}

          {/* Table — not text-editable here, just flagged */}
          {layout === "table" && slide.table && (
            <p className="text-[11.5px] italic text-white/35">
              Table with {slide.table.rows.length} row{slide.table.rows.length === 1 ? "" : "s"} — edit cells in slide view.
            </p>
          )}

          {/* Chart — flagged */}
          {layout === "chart" && slide.chart && (
            <p className="text-[11.5px] italic text-white/35">
              {slide.chart.type} chart — edit data in slide view.
            </p>
          )}

          {/* Annotations (footers, team names, corner callouts) */}
          {slide.annotations && slide.annotations.length > 0 && (
            <div>
              <FieldLabel>Annotations</FieldLabel>
              <div className="space-y-1.5">
                {slide.annotations.map((a, k) => (
                  <div key={a.id || k} className="flex items-center gap-2">
                    <span className="shrink-0 rounded bg-white/8 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/40">
                      {a.anchor.replace("-", " ")}
                    </span>
                    <input
                      value={a.text}
                      onChange={(e) => setAnnotationText(k, e.target.value)}
                      onFocus={onFocus}
                      placeholder="Annotation text"
                      className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[12px] text-white/80 outline-none placeholder:text-white/25 focus:border-white/30"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Row actions */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            onClick={onUp}
            disabled={isFirst}
            title="Move up"
            className="grid h-6 w-6 place-items-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          >
            <ArrowUp size={13} />
          </button>
          <button
            onClick={onDown}
            disabled={isLast}
            title="Move down"
            className="grid h-6 w-6 place-items-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          >
            <ArrowDown size={13} />
          </button>
          <button
            onClick={onDelete}
            disabled={!canDelete}
            title="Delete slide"
            className="grid h-6 w-6 place-items-center rounded-md text-red-300/70 transition hover:bg-red-500/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Insert-after */}
      <div className="mt-2 flex justify-center">
        <button
          onClick={onAdd}
          title="Add a slide after this one"
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10.5px] text-white/45 opacity-0 transition hover:bg-white/10 hover:text-white/80 group-hover:opacity-100"
        >
          <Plus size={11} /> Add slide
        </button>
      </div>
    </li>
  );
}
