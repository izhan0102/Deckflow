"use client";
import { useState } from "react";
import type { Theme } from "@/lib/themes";
import type { Slide } from "@/lib/types";
import {
  STYLE_BUNDLES, BUNDLE_PREVIEW_ORDER, sampleSlide, applyBundleToSlide,
  type StyleBundle, type BundlePreviewKind,
} from "@/lib/styleBundles";
import SlideCanvas from "./SlideCanvas";
import {
  ArrowLeft, Briefcase, Check, Feather, GraduationCap, Mic, Notebook,
  Palette, Sparkles, Wand2, type LucideIcon,
} from "lucide-react";

const BUNDLE_ICONS: Record<StyleBundle["icon"], LucideIcon> = {
  briefcase: Briefcase,
  mic: Mic,
  graduation: GraduationCap,
  notebook: Notebook,
  feather: Feather,
  palette: Palette,
};

/**
 * Full-screen style-bundle picker shown after the clarify questions, just
 * before generation.
 *
 * Each bundle is a card with a single representative preview. Hovering (or
 * focusing) a card expands it to reveal a preview of every slide type
 * inside — intro, bullets, chart, table, thank-you — all rendered in the
 * theme/font/graphic the user already chose, so only the styling differs
 * between bundles. Clicking selects.
 *
 * Selection forces the bundle's per-layout variants onto every generated
 * slide (so what you preview is what you get), and every slide stays
 * editable later via the Style Variants panel.
 */
export default function StyleBundleStep({
  theme, fontId, graphicId, graphicAccent,
  selectedBundleId, onSelect,
  onBack, onGenerate, loading,
}: {
  theme: Theme;
  fontId: string;
  graphicId: string;
  graphicAccent?: string;
  selectedBundleId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onGenerate: () => void;
  loading?: boolean;
}) {
  const selected = STYLE_BUNDLES.find((b) => b.id === selectedBundleId);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-7xl flex-col">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-1.5 text-[12.5px] text-white/55 transition hover:text-white"
        >
          <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
          <Wand2 size={11} /> Final step
        </div>
      </div>

      {/* Heading */}
      <div className="mb-8 text-center">
        <h1
          className="text-[28px] font-semibold tracking-tight text-white md:text-[36px]"
          style={{ fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', letterSpacing: "-0.022em" }}
        >
          Pick a style for your deck
        </h1>
        <p className="mx-auto mt-2.5 max-w-lg text-[13.5px] leading-relaxed text-white/55">
          Same theme, six distinct looks. Hover any style to preview every
          slide type. You can fine-tune individual slides afterward.
        </p>
      </div>

      {/* Bundle grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {STYLE_BUNDLES.map((bundle) => (
          <BundleCard
            key={bundle.id}
            bundle={bundle}
            theme={theme}
            fontId={fontId}
            graphicId={graphicId}
            graphicAccent={graphicAccent}
            selected={selectedBundleId === bundle.id}
            onSelect={() => onSelect(bundle.id)}
          />
        ))}
      </div>

      {/* Sticky footer action */}
      <div className="sticky bottom-0 z-20 mt-10 -mx-4 border-t border-white/10 bg-[var(--ezd-bg-page)]/85 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0 text-[12.5px] text-white/55">
            {selected ? (
              <span>
                <span className="text-white/85">{selected.name}</span>
                {" — "}{selected.tagline}
              </span>
            ) : (
              <span>Select a style to continue.</span>
            )}
          </div>
          <button
            onClick={onGenerate}
            disabled={loading || !selectedBundleId}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-7 py-2.5 text-[13px] font-semibold text-[#03070F] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={14} />
            {loading ? "Generating…" : "Generate deck"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BundleCard({
  bundle, theme, fontId, graphicId, graphicAccent, selected, onSelect,
}: {
  bundle: StyleBundle;
  theme: Theme;
  fontId: string;
  graphicId: string;
  graphicAccent?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = BUNDLE_ICONS[bundle.icon];

  const renderPreview = (kind: BundlePreviewKind) => {
    const base = sampleSlide(kind);
    const styled: Slide = applyBundleToSlide(base, bundle);
    return (
      <SlideCanvas
        slide={styled}
        theme={theme}
        idx={0}
        total={1}
        deckTitle={base.title}
        graphicId={graphicId}
        graphicAccent={graphicAccent}
        fontId={fontId}
      />
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border text-left outline-none transition-all duration-300 ${
        selected
          ? "border-white/70 ring-2 ring-white/25"
          : "border-white/10 hover:border-white/40 focus-visible:border-white/40"
      }`}
      style={{ background: "var(--ezd-bg-card)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/[0.05] text-white/80"
              aria-hidden
            >
              <Icon size={15} />
            </span>
            <h3 className="text-[15px] font-semibold text-white">{bundle.name}</h3>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-white/50">{bundle.tagline}</p>
        </div>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
            selected
              ? "border-white bg-white text-black"
              : "border-white/25 text-transparent group-hover:border-white/45"
          }`}
        >
          <Check size={13} />
        </span>
      </div>

      {/* Lead preview (always visible) */}
      <div className="px-4 py-3.5">
        <div className="pointer-events-none overflow-hidden rounded-lg border border-white/10 shadow-lg">
          {renderPreview("intro")}
        </div>
      </div>

      {/* Expanding strip of every slide style */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            <div className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-white/40">
              Every slide type
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {BUNDLE_PREVIEW_ORDER.filter((p) => p.kind !== "intro").map((p) => (
                <div key={p.kind}>
                  <div className="pointer-events-none overflow-hidden rounded-md border border-white/10">
                    {renderPreview(p.kind)}
                  </div>
                  <div className="mt-1 text-[9px] uppercase tracking-wider text-white/40">{p.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
