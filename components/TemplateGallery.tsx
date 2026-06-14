"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Sparkles, Trash2, X } from "lucide-react";
import { DECK_TEMPLATES, type DeckTemplate } from "@/lib/templates";
import { getTheme, type Theme } from "@/lib/themes";
import type { CustomTemplate } from "@/lib/customTemplates";
import type { Slide } from "@/lib/types";
import SlideCanvas from "./SlideCanvas";
import Skeleton from "./Skeleton";

const PAGE_SIZE_DESKTOP = 6;
const PAGE_SIZE_MOBILE = 3;

/**
 * Modal: paginated, category-filtered gallery of deck templates.
 * Cards use a fixed-height preview so layout is identical to themes
 * step — no scaling, no aspect-ratio CSS, no container queries.
 */
export default function TemplateGallery({
  open, onClose, onPick, customTemplates = [], onPickCustom, onDeleteCustom,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (t: DeckTemplate) => void;
  customTemplates?: CustomTemplate[];
  onPickCustom?: (t: CustomTemplate) => void;
  onDeleteCustom?: (t: CustomTemplate) => void;
}) {
  const categories = useMemo(() => {
    const set = new Set<string>(DECK_TEMPLATES.map((t) => t.category));
    return ["All", ...Array.from(set)];
  }, []);
  const [filter, setFilter] = useState<string>("All");
  const [page, setPage] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);

  // Mobile shows fewer cards per page so none get clipped by the modal.
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DESKTOP);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => setPageSize(window.innerWidth < 640 ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP);
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Brief skeleton flash on page/filter change so paging feels deliberate.
  useEffect(() => {
    setPageLoading(true);
    const t = window.setTimeout(() => setPageLoading(false), 200);
    return () => window.clearTimeout(t);
  }, [page, filter]);

  const visible = useMemo(() => {
    if (filter === "All") return DECK_TEMPLATES;
    return DECK_TEMPLATES.filter((t) => t.category === filter);
  }, [filter]);

  // Cards injected before the presets on page 0 of the "All" view:
  // each saved custom template consumes a grid slot, so page 0 shows fewer
  // presets to avoid overflow/clipping.
  const reserved = filter === "All" ? customTemplates.length : 0;

  // How many presets fit on each page once page 0's reserved slots are taken.
  const firstPagePresetCount = Math.max(0, pageSize - reserved);
  const totalPages = useMemo(() => {
    if (visible.length <= firstPagePresetCount) return 1;
    return 1 + Math.ceil((visible.length - firstPagePresetCount) / pageSize);
  }, [visible.length, firstPagePresetCount, pageSize]);

  const pageTemplates = useMemo(() => {
    if (page === 0) return visible.slice(0, firstPagePresetCount);
    const start = firstPagePresetCount + (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, page, pageSize, firstPagePresetCount]);

  useEffect(() => { setPage(0); }, [filter]);
  // Keep the current page valid when the page size changes (resize/rotate).
  useEffect(() => { setPage((p) => Math.min(p, totalPages - 1)); }, [totalPages]);

  // Whenever the gallery (re)opens, snap back to the first page + All filter
  // so freshly-saved custom templates are always visible.
  useEffect(() => {
    if (open) { setFilter("All"); setPage(0); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative m-4 flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2 text-sm">
            <LayoutGrid size={14} className="text-white/70" />
            <span className="font-medium text-white">Deck styles</span>
            <span className="hidden text-white/40 sm:inline">— pick a template, edit the brief, generate</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close template gallery"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 px-6 py-3">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                filter === c
                  ? "border-white/60 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 overflow-y-auto px-6 pt-6 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Saved custom templates (first page, All filter). */}
          {page === 0 && filter === "All" && customTemplates.length > 0 && (
            <>
              {customTemplates.map((t) => (
                <CustomTemplateCard
                  key={t.id}
                  template={t}
                  onPick={() => { onPickCustom?.(t); onClose(); }}
                  onDelete={onDeleteCustom ? () => onDeleteCustom(t) : undefined}
                />
              ))}
            </>
          )}
          {pageLoading
            ? Array.from({ length: pageSize }).map((_, i) => (
                <Skeleton key={i} height={272} />
              ))
            : pageTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onPick={() => { onPick(t); onClose(); }}
            />
          ))}
        </div>

        {/* Pager */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-3">
          <span className="text-xs text-white/55">
            Page {page + 1} of {totalPages} · {visible.length} templates
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomTemplateCard({
  template, onPick, onDelete,
}: { template: CustomTemplate; onPick: () => void; onDelete?: () => void }) {
  const { bg, fg, accent, muted } = template.colors;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-cyan-300/30 bg-white/[0.02] text-left transition hover:border-cyan-300/60">
      <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-cyan-300/40 bg-gradient-to-br from-cyan-300/30 to-transparent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100 backdrop-blur">
        <Sparkles size={9} /> Yours
      </span>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/40 text-red-200 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/20"
          aria-label="Delete template"
        >
          <Trash2 size={12} />
        </button>
      )}
      <button onClick={onPick} className="flex flex-1 flex-col">
        <div className="relative h-56 w-full overflow-hidden" style={{ background: bg }}>
          <div style={{ position: "absolute", left: 18, top: "50%", right: 18, transform: "translateY(-50%)" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.22em", color: accent, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>{template.fontCategory} template</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.05, color: fg, letterSpacing: "-0.015em" }}>{template.name}</div>
            <div style={{ marginTop: 8, width: 48, height: 3, background: accent }} />
            <div style={{ marginTop: 8, fontSize: 11, color: muted }}>Your saved look</div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5">
          <div className="truncate text-sm font-medium text-white">{template.name}</div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-white/55">Custom</span>
        </div>
      </button>
    </div>
  );
}

function TemplateCard({ template, onPick }: { template: DeckTemplate; onPick: () => void }) {
  const theme = getTheme(template.themeId);
  if (!theme) return null;

  return (
    <button
      onClick={onPick}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] text-left transition hover:border-white/40 hover:bg-white/[0.04]"
    >
      {template.isNew && (
        <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-gradient-to-br from-emerald-300/30 via-emerald-400/20 to-transparent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100 shadow-[0_0_18px_-4px_rgba(52,211,153,0.55)] backdrop-blur">
          <span className="h-1 w-1 rounded-full bg-emerald-300" />
          New
        </span>
      )}
      <TemplatePreview template={template} theme={theme} />
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{template.name}</div>
          <p className="mt-0.5 truncate text-[11px] leading-relaxed text-white/55">{template.tagline}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-white/55">
          {template.category}
        </span>
      </div>
    </button>
  );
}

/* --------------------------- Preview component ---------------------------- */

/**
 * Accurate preview: renders the template's real title slide through the same
 * SlideCanvas used in the editor (theme, font, graphic, and the actual
 * title-hero variant), so the card matches exactly what you'll get.
 */
function TemplatePreview({ template, theme }: { template: DeckTemplate; theme: Theme }) {
  const sample: Slide = {
    layout: "title-hero",
    title: "Pitch Deck",
    subtitle: "Business Presentation",
    kicker: (template.category || "Presentation").toUpperCase(),
    titleVariant: template.variants.titleVariant,
  };
  return (
    <div className="relative w-full overflow-hidden border-b border-white/10">
      <div className="pointer-events-none">
        <SlideCanvas
          slide={sample}
          theme={theme}
          idx={0}
          total={1}
          deckTitle={sample.title}
          graphicId={template.graphicId}
          graphicAccent={template.graphicAccent}
          fontId={template.fontId}
        />
      </div>
    </div>
  );
}
