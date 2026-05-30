"use client";
import type { Slide, UploadedImage, Deck } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { Eye, Maximize2, Palette, Shapes, Trash2 } from "lucide-react";
import { getDecoration } from "@/lib/decorations";
import StyleVariants from "./StyleVariants";

const ELEMENTS: { id: keyof NonNullable<Slide["elementHidden"]>; label: string }[] = [
  { id: "title",    label: "Title" },
  { id: "subtitle", label: "Subtitle" },
  { id: "bullets",  label: "Bullets" },
  { id: "body",     label: "Body" },
  { id: "table",    label: "Table" },
  { id: "quote",    label: "Quote" },
];

export default function DesignerPanel({
  slide, theme, deck, onUpdate, onReplace,
  selectedImageId, onDeselectImage,
}: {
  slide: Slide;
  theme: Theme;
  deck: Deck;
  onUpdate: (patch: Partial<Slide>) => void;
  onReplace?: (next: Slide) => void;
  selectedImageId?: string | null;
  onDeselectImage?: () => void;
}) {
  const selectedImage =
    selectedImageId
      ? (slide.uploadedImages || []).find((i) => i.id === selectedImageId) || null
      : null;

  if (selectedImage) {
    return (
      <GraphicPanel
        slide={slide}
        theme={theme}
        image={selectedImage}
        onUpdate={onUpdate}
        onDeselect={onDeselectImage}
      />
    );
  }

  const restoreAll = () => onUpdate({ elementHidden: {}, elementOffsets: {}, elementScales: {}, elementFontSizes: {} });
  const restoreElement = (id: keyof NonNullable<Slide["elementHidden"]>) => onUpdate({
    elementHidden: { ...(slide.elementHidden || {}), [id]: false },
  });
  const hidden = ELEMENTS.filter((e) => slide.elementHidden?.[e.id]);

  return (
    <aside className="flex max-h-[calc(100vh-160px)] flex-col gap-5 overflow-y-auto border-l border-white/10 bg-zinc-950/60 p-4">
      <StyleVariants
        slide={slide}
        deck={deck}
        theme={theme}
        onApply={(next) => {
          if (onReplace) onReplace(next);
          else onUpdate({
            titleVariant: next.titleVariant,
            bulletsVariant: next.bulletsVariant,
            twoColumnVariant: next.twoColumnVariant,
            tableVariant: next.tableVariant,
            quoteVariant: next.quoteVariant,
            sectionVariant: next.sectionVariant,
            closingVariant: next.closingVariant,
          });
        }}
      />

      {slide.layout === "chart" && slide.chart && (
        <ChartSizeRow
          value={typeof slide.chartScale === "number" ? slide.chartScale : 1}
          onChange={(v) => onUpdate({ chartScale: v })}
        />
      )}

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
        Drag any element to move it. Click a graphic to recolor it. The chat
        below the slide can change content, colors, fonts, and add corner
        labels.
      </div>
    </aside>
  );
}

/* ----------------------------- Graphic panel ----------------------------- */

const SWATCH_PRESETS = [
  // Colorful palettes the recolor panel offers as quick picks. Curated to
  // look reasonable on light backgrounds.
  "#1E3A8A", "#1D4ED8", "#3B82F6", "#60A5FA",
  "#0E7490", "#0F766E", "#047857", "#65A30D",
  "#CA8A04", "#B45309", "#C2410C", "#DC2626",
  "#BE123C", "#9D174D", "#7C3AED", "#6D28D9",
  "#4338CA", "#374151", "#171717", "#FFFFFF",
];

function GraphicPanel({
  slide, theme, image, onUpdate, onDeselect,
}: {
  slide: Slide;
  theme: Theme;
  image: UploadedImage;
  onUpdate: (patch: Partial<Slide>) => void;
  onDeselect?: () => void;
}) {
  const isDecoration = image.kind === "decoration" && !!image.decorationId;
  const isIcon = image.kind === "icon" && !!image.iconId;
  const dec = isDecoration ? getDecoration(image.decorationId) : undefined;

  const updateImage = (patch: Partial<UploadedImage>) => {
    const next = (slide.uploadedImages || []).map((i) =>
      i.id === image.id ? { ...i, ...patch } : i,
    );
    onUpdate({ uploadedImages: next });
  };

  const setColor = (key: "accent" | "muted" | "fg", value: string | undefined) => {
    const overrides = { ...(image.colorOverrides || {}) };
    if (value === undefined) delete overrides[key];
    else overrides[key] = value;
    updateImage({ colorOverrides: overrides });
  };

  const removeImage = () => {
    const next = (slide.uploadedImages || []).filter((i) => i.id !== image.id);
    onUpdate({ uploadedImages: next });
    onDeselect?.();
  };

  const resetColors = () => updateImage({ colorOverrides: undefined });

  const accent = image.colorOverrides?.accent || theme.accent;
  const muted  = image.colorOverrides?.muted  || theme.muted;
  const fg     = image.colorOverrides?.fg     || theme.fg;

  // Icons: show only the single accent color row.
  // Decorations: show all three (accent / muted / fg).
  // User-uploaded photos: show none (only delete).
  const showAccent = isDecoration || isIcon;
  const showMuted  = isDecoration;
  const showFg     = isDecoration;

  const headerLabel =
    isIcon ? "Icon" :
    isDecoration ? "Graphic" :
    "Image";

  const friendlyName =
    isIcon ? friendlyIconName(image.iconId!) :
    dec?.name || "Uploaded image";

  return (
    <aside className="flex max-h-[calc(100vh-160px)] flex-col gap-5 overflow-y-auto border-l border-white/10 bg-zinc-950/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
          <Shapes size={12} /> {headerLabel}
        </div>
        <button
          onClick={onDeselect}
          className="text-[10px] text-white/50 hover:text-white/85"
        >
          Deselect
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-medium text-white">{friendlyName}</div>
        {isDecoration && dec && (
          <div className="text-[11px] text-white/50">{dec.category}</div>
        )}
        {isIcon && (
          <div className="text-[11px] text-white/50">
            From <span className="font-mono">{image.iconId?.split(":")[0]}</span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1 text-[10px] text-white/55">
          <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5">
            {image.w.toFixed(1)}″ × {image.h.toFixed(1)}″
          </span>
        </div>
      </div>

      {showAccent && (
        <ColorRow
          label={isIcon ? "Color" : "Primary"}
          value={accent}
          isOverride={!!image.colorOverrides?.accent}
          themeColor={theme.accent}
          onChange={(v) => setColor("accent", v)}
          onReset={() => setColor("accent", undefined)}
        />
      )}
      {showMuted && (
        <ColorRow
          label="Secondary"
          value={muted}
          isOverride={!!image.colorOverrides?.muted}
          themeColor={theme.muted}
          onChange={(v) => setColor("muted", v)}
          onReset={() => setColor("muted", undefined)}
        />
      )}
      {showFg && (
        <ColorRow
          label="Detail"
          value={fg}
          isOverride={!!image.colorOverrides?.fg}
          themeColor={theme.fg}
          onChange={(v) => setColor("fg", v)}
          onReset={() => setColor("fg", undefined)}
        />
      )}

      {(showAccent || showMuted || showFg) && (
        <button
          onClick={resetColors}
          className="self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
        >
          <Palette size={10} className="mr-1 inline" /> Reset to theme
        </button>
      )}

      <div className="mt-auto">
        <button
          onClick={removeImage}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20"
        >
          <Trash2 size={12} /> Delete from slide
        </button>
      </div>
    </aside>
  );
}

function friendlyIconName(iconId: string): string {
  const [, name] = iconId.split(":");
  if (!name) return iconId;
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ColorRow({
  label, value, isOverride, themeColor, onChange, onReset,
}: {
  label: string;
  value: string;
  isOverride: boolean;
  themeColor: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
        {isOverride && (
          <button
            onClick={onReset}
            className="text-[10px] text-white/50 hover:text-white/85"
            title={`Use theme ${label.toLowerCase()} color`}
          >
            Use theme
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded-md border border-white/10 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
            else if (v === "") onReset();
          }}
          className="flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-white/85 outline-none"
        />
      </div>

      <div className="mt-2 grid grid-cols-10 gap-1">
        {SWATCH_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            className={`h-4 w-4 rounded-full border transition ${
              value.toLowerCase() === c.toLowerCase()
                ? "border-white scale-110"
                : "border-white/15 hover:border-white/50"
            }`}
            style={{ background: c }}
          />
        ))}
      </div>

      {!isOverride && (
        <div className="mt-1 text-[10px] text-white/35">
          Currently using theme color {themeColor}
        </div>
      )}
    </div>
  );
}

function normalizeHex(v: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return "#000000";
}

/** Size slider + quick presets for a chart slide's chart. */
function ChartSizeRow({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
          <Maximize2 size={12} /> Chart size
        </span>
        <span className="font-mono text-[11px] text-white/70">{pct}%</span>
      </div>
      <input
        type="range"
        min={60}
        max={160}
        step={5}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-cyan-400"
      />
      <div className="mt-2 flex gap-1.5">
        {[
          { label: "Small", v: 0.75 },
          { label: "Default", v: 1 },
          { label: "Large", v: 1.3 },
          { label: "XL", v: 1.6 },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.v)}
            className={`flex-1 rounded-md border px-2 py-1 text-[10px] transition ${
              Math.abs(value - p.v) < 0.001
                ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                : "border-white/10 bg-black/30 text-white/65 hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
