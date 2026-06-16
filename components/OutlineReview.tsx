"use client";
import { useRef, useState } from "react";
import {
  Plus, Trash2, X, Sparkles, ArrowRight, ArrowLeft,
  ChevronUp, ChevronDown, Wand2, Loader2,
} from "lucide-react";
import type { Deck, Slide } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { getIdToken } from "@/lib/auth";

/**
 * Outline review step.
 *
 * Shown after generation (and the build animation) and BEFORE the deck is
 * designed. It's deliberately text-only — no themes, images, or layouts — so
 * the user can shape the *content* first: edit titles and points inline, ask
 * AI to rewrite a slide, and add/remove/reorder slides. On Confirm, the parent
 * plays the "designing" animation and reveals the finished deck.
 */
export default function OutlineReview({
  deck, setDeck, theme, onConfirm, onBack,
}: {
  deck: Deck;
  setDeck: (d: Deck) => void;
  theme: Theme;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const accent = theme.accent || "#7C5CFF";

  // Only content slides are editable in the outline; the hero/closing keep
  // their role but we still show their title so the structure reads clearly.
  const slides = deck.slides;

  const setSlide = (i: number, patch: Partial<Slide>) => {
    const next = slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    setDeck({ ...deck, slides: next });
  };

  const setBullet = (i: number, bi: number, value: string) => {
    const bullets = [...(slides[i].bullets || [])];
    bullets[bi] = value;
    setSlide(i, { bullets });
  };

  const addBullet = (i: number) => {
    const bullets = [...(slides[i].bullets || []), ""];
    setSlide(i, { bullets });
  };

  const removeBullet = (i: number, bi: number) => {
    const bullets = (slides[i].bullets || []).filter((_, idx) => idx !== bi);
    setSlide(i, { bullets });
  };

  const addSlideAfter = (i: number) => {
    const blank: Slide = { layout: "bullets", title: "New slide", bullets: ["New point"], annotations: [] };
    const next = [...slides.slice(0, i + 1), blank, ...slides.slice(i + 1)];
    setDeck({ ...deck, slides: next });
  };

  const removeSlide = (i: number) => {
    if (slides.length <= 2) return; // keep at least a hero + closing
    setDeck({ ...deck, slides: slides.filter((_, idx) => idx !== i) });
  };

  const moveSlide = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    setDeck({ ...deck, slides: next });
  };

  return (
    <main className="min-h-screen pb-32" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {/* Hero header */}
      <header className="relative overflow-hidden border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{ background: `radial-gradient(60% 120% at 50% 0%, ${accent}, transparent 70%)` }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-10 text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ borderColor: `${accent}55`, color: accent, background: `${accent}14` }}
          >
            <Sparkles size={12} /> Step 1 · Outline
          </span>
          <h1 className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">
            Shape your story first
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            This is the outline — just the words, no design yet. Edit any slide, ask AI to rewrite one,
            or add and remove slides. When it reads right, hit <b>Design my deck</b> and EXdeck does the magic.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>
            <span className="tabular-nums">{slides.length} slides</span>
            <span aria-hidden>·</span>
            <span>Editable · text-only</span>
          </div>
        </div>
      </header>

      {/* Slide cards */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {slides.map((s, i) => (
          <div key={i}>
            <SlideOutlineCard
              index={i}
              total={slides.length}
              slide={s}
              accent={accent}
              deck={deck}
              theme={theme}
              onTitle={(v) => setSlide(i, { title: v })}
              onBullet={(bi, v) => setBullet(i, bi, v)}
              onAddBullet={() => addBullet(i)}
              onRemoveBullet={(bi) => removeBullet(i, bi)}
              onRemoveSlide={() => removeSlide(i)}
              onMoveUp={() => moveSlide(i, -1)}
              onMoveDown={() => moveSlide(i, 1)}
              onApplyAi={(updated) => setSlide(i, updated)}
            />
            {/* Insert-between control */}
            <div className="relative my-1 flex justify-center">
              <button
                onClick={() => addSlideAfter(i)}
                className="group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition hover:scale-[1.03]"
                style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)" }}
              >
                <Plus size={12} /> Add slide
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky confirm bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur"
        style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-nav-bg)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3.5">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium transition hover:opacity-90"
            style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold shadow-lg transition hover:scale-[1.02]"
            style={{ background: accent, color: "#fff", boxShadow: `0 10px 30px -8px ${accent}` }}
          >
            <Wand2 size={15} /> Design my deck <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------ slide card ------------------------------ */

function SlideOutlineCard({
  index, total, slide, accent, deck, theme,
  onTitle, onBullet, onAddBullet, onRemoveBullet, onRemoveSlide, onMoveUp, onMoveDown, onApplyAi,
}: {
  index: number;
  total: number;
  slide: Slide;
  accent: string;
  deck: Deck;
  theme: Theme;
  onTitle: (v: string) => void;
  onBullet: (bi: number, v: string) => void;
  onAddBullet: () => void;
  onRemoveBullet: (bi: number) => void;
  onRemoveSlide: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onApplyAi: (patch: Partial<Slide>) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isHero = slide.layout === "title-hero";
  const isClosing = slide.layout === "closing";
  const roleLabel = isHero ? "Intro" : isClosing ? "Closing" : slide.layout === "section" ? "Section" : "Content";

  const runAi = async () => {
    const text = instruction.trim();
    if (!text || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const token = await getIdToken().catch(() => null);
      const res = await fetch("/api/edit-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          deck,
          theme: { bg: theme.bg, fg: theme.fg, accent: theme.accent },
          slideIndex: index,
          instruction: text,
          history: [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.slide) {
        setNote(data?.error || "Couldn't apply that. Try rephrasing.");
      } else {
        // Outline is text-only: take the rewritten title/subtitle/bullets/body.
        const u = data.slide as Slide;
        onApplyAi({ title: u.title, subtitle: u.subtitle, bullets: u.bullets, body: u.body });
        setInstruction("");
        setNote(data.explanation || "Updated.");
      }
    } catch {
      setNote("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="group relative mt-4 overflow-hidden rounded-2xl border transition"
      style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
    >
      {/* Accent spine */}
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />

      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-extrabold tabular-nums text-white"
              style={{ background: accent }}
            >
              {index + 1}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}>
                Slide {index + 1} · {roleLabel}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
            <IconBtn label="Move up" disabled={index === 0} onClick={onMoveUp}><ChevronUp size={15} /></IconBtn>
            <IconBtn label="Move down" disabled={index === total - 1} onClick={onMoveDown}><ChevronDown size={15} /></IconBtn>
            <IconBtn label="Delete slide" disabled={total <= 2} onClick={onRemoveSlide} danger><Trash2 size={14} /></IconBtn>
          </div>
        </div>

        {/* Title */}
        <input
          value={slide.title || ""}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Slide title"
          className="mt-3 w-full bg-transparent text-[17px] font-bold leading-snug tracking-tight outline-none placeholder:opacity-40"
          style={{ color: "var(--ezd-fg-strong)" }}
        />

        {/* Bullets (content slides) */}
        {!isHero && !isClosing && (
          <div className="mt-2 space-y-1.5">
            {(slide.bullets || []).map((b, bi) => (
              <div key={bi} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
                <textarea
                  value={b}
                  onChange={(e) => onBullet(bi, e.target.value)}
                  rows={1}
                  placeholder="Point…"
                  className="min-h-[28px] w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:opacity-40"
                  style={{ color: "var(--ezd-fg)" }}
                />
                <button
                  onClick={() => onRemoveBullet(bi)}
                  className="mt-1 rounded p-1 opacity-0 transition hover:bg-black/5 group-hover:opacity-60 hover:!opacity-100"
                  aria-label="Remove point"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={onAddBullet}
              className="ml-3.5 inline-flex items-center gap-1 text-[12.5px] font-medium transition hover:opacity-80"
              style={{ color: accent }}
            >
              <Plus size={12} /> Add point
            </button>
          </div>
        )}

        {/* Subtitle for hero/closing */}
        {(isHero || isClosing) && (
          <input
            value={slide.subtitle || ""}
            onChange={(e) => onApplyAi({ subtitle: e.target.value })}
            placeholder={isHero ? "One-line description" : "Closing line"}
            className="mt-2 w-full bg-transparent text-[14px] leading-relaxed outline-none placeholder:opacity-40"
            style={{ color: "var(--ezd-fg-muted)" }}
          />
        )}

        {/* AI chat */}
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--ezd-divider)" }}>
          {!chatOpen ? (
            <button
              onClick={() => { setChatOpen(true); setTimeout(() => inputRef.current?.focus(), 30); }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition hover:opacity-90"
              style={{ borderColor: `${accent}40`, color: accent, background: `${accent}0f` }}
            >
              <Sparkles size={12} /> Ask AI to edit this slide
            </button>
          ) : (
            <div>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2"
                   style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)" }}>
                <Sparkles size={14} style={{ color: accent }} />
                <input
                  ref={inputRef}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runAi(); if (e.key === "Escape") setChatOpen(false); }}
                  disabled={busy}
                  placeholder="e.g. make these punchier, add a point about cost, rewrite for students"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:opacity-45"
                  style={{ color: "var(--ezd-fg)" }}
                />
                <button
                  onClick={runAi}
                  disabled={busy || !instruction.trim()}
                  className="grid h-7 w-7 place-items-center rounded-lg text-white transition disabled:opacity-40"
                  style={{ background: accent }}
                  aria-label="Send"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                </button>
              </div>
              {note && (
                <div className="mt-1.5 px-1 text-[11.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>{note}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children, onClick, label, disabled, danger,
}: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded-lg p-1.5 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
      style={{ color: danger ? "#e5484d" : "var(--ezd-fg-muted)" }}
    >
      {children}
    </button>
  );
}
