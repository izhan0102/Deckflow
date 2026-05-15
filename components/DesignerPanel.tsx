"use client";
import type { Slide, SlideLayout } from "@/lib/types";
import { Layout, Eye } from "lucide-react";

const LAYOUT_OPTIONS: { id: SlideLayout; label: string }[] = [
  { id: "title-hero", label: "Title hero" },
  { id: "bullets",    label: "Bullets" },
  { id: "two-column", label: "Two columns" },
  { id: "table",      label: "Table" },
  { id: "quote",      label: "Quote" },
  { id: "section",    label: "Section divider" },
  { id: "closing",    label: "Closing" },
];

const ELEMENTS: { id: keyof NonNullable<Slide["elementHidden"]>; label: string }[] = [
  { id: "title",    label: "Title" },
  { id: "subtitle", label: "Subtitle" },
  { id: "bullets",  label: "Bullets" },
  { id: "body",     label: "Body" },
  { id: "table",    label: "Table" },
  { id: "quote",    label: "Quote" },
];

export default function DesignerPanel({
  slide, onUpdate,
}: {
  slide: Slide;
  onUpdate: (patch: Partial<Slide>) => void;
}) {
  const restoreAll = () => onUpdate({ elementHidden: {}, elementOffsets: {}, elementScales: {} });
  const restoreElement = (id: keyof NonNullable<Slide["elementHidden"]>) => onUpdate({
    elementHidden: { ...(slide.elementHidden || {}), [id]: false },
  });

  const hidden = ELEMENTS.filter((e) => slide.elementHidden?.[e.id]);

  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto border-l border-white/10 bg-zinc-950/60 p-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
          <Layout size={12} /> Layout
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {LAYOUT_OPTIONS.map((opt) => {
            const active = slide.layout === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onUpdate({ layout: opt.id })}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  active
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
          <Eye size={12} /> Hidden elements
        </div>
        {hidden.length === 0 ? (
          <p className="text-[11px] text-white/40">
            Use the ⋮ menu on a slide element to hide, resize, or move it. Hidden ones show up here so you can bring them back.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((e) => (
              <button
                key={e.id}
                onClick={() => restoreElement(e.id)}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
              >
                Restore {e.label}
              </button>
            ))}
            <button
              onClick={restoreAll}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      <div className="text-[11px] text-white/40">
        Drag any element to move it. The chat below the slide can change content, colors, fonts, and add corner labels.
      </div>
    </aside>
  );
}
