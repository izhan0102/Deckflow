"use client";
import { useEffect, useRef, useState } from "react";
import type { Deck, Slide, SlideLayout } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import SlideCanvas from "./SlideCanvas";
import { Plus, Copy, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import { stripHtml } from "@/lib/richText";

const ADD_SLIDE_TIP_KEY = "deckflow_add_slide_tip_seen_v1";

type Props = {
  deck: Deck;
  theme: Theme;
  active: number;
  setActive: (i: number) => void;
  onChange: (slides: Slide[]) => void;
};

function emptySlide(layout: SlideLayout = "bullets"): Slide {
  return {
    layout,
    title: "New slide",
    bullets: layout === "bullets" || layout === "two-column" ? ["Bullet one", "Bullet two", "Bullet three"] : [],
    body: layout === "quote" || layout === "section" ? "" : undefined,
    annotations: [],
  };
}

export default function SlideRail({ deck, theme, active, setActive, onChange }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ idx: number; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // One-time tooltip pointing at the first insert bar so new users discover
  // they can add slides between thumbnails. Self-dismisses on first insert
  // click, on the X, or after a generous timeout.
  const [showTip, setShowTip] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (deck.slides.length < 2) return; // not useful with one slide
    let seen = false;
    try { seen = !!window.localStorage.getItem(ADD_SLIDE_TIP_KEY); } catch { /* ignore */ }
    if (seen) return;
    const t = window.setTimeout(() => setShowTip(true), 1200);
    const auto = window.setTimeout(() => dismissTip(), 14000);
    return () => { window.clearTimeout(t); window.clearTimeout(auto); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissTip = () => {
    setShowTip(false);
    try { window.localStorage.setItem(ADD_SLIDE_TIP_KEY, "1"); } catch { /* ignore */ }
  };

  // Close context menu on outside click / Esc
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const slides = deck.slides;
  const move = (from: number, to: number) => {
    if (from === to || from < 0 || from >= slides.length) return;
    const target = Math.max(0, Math.min(slides.length - 1, to));
    const next = [...slides];
    const [it] = next.splice(from, 1);
    next.splice(target, 0, it);
    onChange(next);
    setActive(target);
  };

  const insertAt = (i: number) => {
    const next = [...slides];
    next.splice(i, 0, emptySlide("bullets"));
    onChange(next);
    setActive(i);
    if (showTip) dismissTip();
  };

  const duplicate = (i: number) => {
    const next = [...slides];
    const clone: Slide = JSON.parse(JSON.stringify(slides[i]));
    next.splice(i + 1, 0, clone);
    onChange(next);
    setActive(i + 1);
  };

  const remove = (i: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, k) => k !== i);
    onChange(next);
    setActive(Math.max(0, Math.min(next.length - 1, i)));
  };

  return (
    <div className="max-h-[78vh] overflow-y-auto pr-1">
      {slides.map((s, i) => (
        <div key={i} className="relative">
          {/* Insert-before bar — the one between slides 1 and 2 (i === 1)
              is the anchor for the first-visit tooltip. */}
          <InsertBar
            onClick={() => insertAt(i)}
            highlight={showTip && i === 1}
          />
          {showTip && i === 1 && (
            <AddSlideTip onDismiss={dismissTip} />
          )}

          {/* Drop indicator */}
          {dropIdx === i && dragIdx !== null && dragIdx !== i && (
            <div className="my-1 h-0.5 w-full rounded bg-cyan-400" />
          )}

          <button
            draggable
            onDragStart={(e) => {
              setDragIdx(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIdx !== null && dragIdx !== i) setDropIdx(i);
            }}
            onDragLeave={() => setDropIdx((d) => (d === i ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragIdx ?? Number(e.dataTransfer.getData("text/plain"));
              if (!isNaN(from)) move(from, i);
              setDragIdx(null);
              setDropIdx(null);
            }}
            onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
            onClick={() => setActive(i)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ idx: i, x: e.clientX, y: e.clientY });
            }}
            className={`group block w-full overflow-hidden rounded-lg border text-left transition ${
              active === i ? "border-white/60 ring-2 ring-white/20" : "border-white/10 hover:border-white/30"
            } ${dragIdx === i ? "opacity-50" : ""}`}
          >
            <div className="pointer-events-none">
              <SlideCanvas slide={s} theme={theme} idx={i} total={slides.length} deckTitle={deck.title} graphicId={deck.graphic}
              graphicAccent={deck.graphicAccent}
              fontId={deck.fontId} />
            </div>
            <div className="flex items-center justify-between bg-black/40 px-2 py-1 text-[10px] text-white/60">
              <span className="truncate">
                {i + 1}. {stripHtml(s.title) || (s.layout === "references" ? "References" : "Untitled")}
              </span>
            </div>
          </button>
        </div>
      ))}

      {/* Final insert-after bar */}
      <InsertBar onClick={() => insertAt(slides.length)} label="Add slide" />

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 70, background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", borderColor: "var(--ezd-hairline)" }}
          className="min-w-[180px] rounded-lg border p-1 text-xs shadow-2xl backdrop-blur"
        >
          <MenuItem icon={<ArrowUp size={12} />} label="Move up"
            onClick={() => { move(menu.idx, menu.idx - 1); setMenu(null); }}
            disabled={menu.idx === 0}
          />
          <MenuItem icon={<ArrowDown size={12} />} label="Move down"
            onClick={() => { move(menu.idx, menu.idx + 1); setMenu(null); }}
            disabled={menu.idx === slides.length - 1}
          />
          <MenuItem icon={<Copy size={12} />} label="Duplicate"
            onClick={() => { duplicate(menu.idx); setMenu(null); }}
          />
          <MenuItem icon={<Plus size={12} />} label="Insert below"
            onClick={() => { insertAt(menu.idx + 1); setMenu(null); }}
          />
          <div className="my-1 h-px" style={{ background: "var(--ezd-hairline)" }} />
          <MenuItem icon={<Trash2 size={12} />} label="Delete"
            onClick={() => { remove(menu.idx); setMenu(null); }}
            disabled={slides.length <= 1}
            danger
          />
        </div>
      )}
    </div>
  );
}

function InsertBar({ onClick, label, highlight }: { onClick: () => void; label?: string; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group my-1 flex h-5 w-full items-center justify-center transition ${
        highlight ? "text-cyan-100" : "text-white/0 hover:text-white/80"
      }`}
      title={label || "Insert slide here"}
    >
      <span className={`flex h-px flex-1 transition ${
        highlight ? "bg-cyan-300/60" : "bg-transparent group-hover:bg-white/20"
      }`} />
      <span
        className={`mx-2 grid h-4 w-4 place-items-center rounded-full text-[10px] transition ${
          highlight
            ? "border border-cyan-300/70 bg-cyan-500/30 text-cyan-50 deckflow-tip-pulse"
            : "border border-white/20 bg-zinc-950 text-white/0 group-hover:text-white/85"
        }`}
      >
        +
      </span>
      <span className={`flex h-px flex-1 transition ${
        highlight ? "bg-cyan-300/60" : "bg-transparent group-hover:bg-white/20"
      }`} />
      <style jsx>{`
        .deckflow-tip-pulse {
          animation: deckflow-tip-pulse 1.6s ease-in-out infinite;
        }
        @keyframes deckflow-tip-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
          50%      { box-shadow: 0 0 0 8px rgba(34, 211, 238, 0.18); }
        }
      `}</style>
    </button>
  );
}

/**
 * Floating callout shown next to the highlighted "+" insert bar on first
 * visit. Dismisses on its X, on first insert click, or after 14s.
 */
function AddSlideTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Add a slide tip"
      className="pointer-events-auto absolute left-full top-1/2 z-[60] ml-3 w-[220px] -translate-y-1/2 rounded-xl border border-cyan-300/30 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur"
    >
      {/* Pointer arrow */}
      <span
        aria-hidden
        className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-cyan-300/30 bg-zinc-950"
      />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
          ✨ Tip
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="grid h-5 w-5 place-items-center rounded-full text-white/55 hover:bg-white/10 hover:text-white"
        >
          <X size={11} />
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-white/80">
        Click the <span className="font-semibold text-cyan-200">+</span> between slides to add a new one anywhere in your deck.
      </p>
      <button
        onClick={onDismiss}
        className="mt-2 w-full rounded-lg bg-white px-3 py-1 text-[11px] font-medium text-black hover:bg-white/90"
      >
        Got it
      </button>
    </div>
  );
}

function MenuItem({
  icon, label, onClick, disabled, danger,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-white/10"
      } ${danger ? "text-red-300" : ""}`}
    >
      {icon} {label}
    </button>
  );
}
