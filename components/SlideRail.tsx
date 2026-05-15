"use client";
import { useEffect, useRef, useState } from "react";
import type { Deck, Slide, SlideLayout } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import SlideCanvas from "./SlideCanvas";
import { Plus, Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react";

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
          {/* Insert-before bar */}
          <InsertBar onClick={() => insertAt(i)} />

          {/* Drop indicator */}
          {dropIdx === i && dragIdx !== null && dragIdx !== i && (
            <div className="my-1 h-0.5 w-full rounded bg-violet-400" />
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
              <SlideCanvas slide={s} theme={theme} idx={i} total={slides.length} deckTitle={deck.title} />
            </div>
            <div className="flex items-center justify-between bg-black/40 px-2 py-1 text-[10px] text-white/60">
              <span className="truncate">
                {i + 1}. {s.title || (s.layout === "references" ? "References" : "Untitled")}
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
          style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 70 }}
          className="min-w-[180px] rounded-lg border border-white/10 bg-zinc-900/95 p-1 text-xs text-white shadow-2xl backdrop-blur"
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
          <div className="my-1 h-px bg-white/10" />
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

function InsertBar({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="group my-1 flex h-5 w-full items-center justify-center text-white/0 transition hover:text-white/80"
      title={label || "Insert slide here"}
    >
      <span className="flex h-px flex-1 bg-transparent group-hover:bg-white/20" />
      <span className="mx-2 grid h-4 w-4 place-items-center rounded-full border border-white/20 bg-zinc-950 text-[10px] text-white/0 group-hover:text-white/85">
        +
      </span>
      <span className="flex h-px flex-1 bg-transparent group-hover:bg-white/20" />
    </button>
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
