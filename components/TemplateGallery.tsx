"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Plus, Sparkles, Trash2, X } from "lucide-react";
import { DECK_TEMPLATES, type DeckTemplate } from "@/lib/templates";
import { getTheme, type Theme } from "@/lib/themes";
import { getGraphic } from "@/lib/graphics";
import { resolveFontFamily } from "@/lib/fonts";
import type { CustomTemplate } from "@/lib/customTemplates";
import Skeleton from "./Skeleton";

const PAGE_SIZE_DESKTOP = 6;
const PAGE_SIZE_MOBILE = 3;

/**
 * Modal: paginated, category-filtered gallery of deck templates.
 * Cards use a fixed-height preview so layout is identical to themes
 * step — no scaling, no aspect-ratio CSS, no container queries.
 */
export default function TemplateGallery({
  open, onClose, onPick, customTemplates = [], onDesignNew, onPickCustom, onDeleteCustom,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (t: DeckTemplate) => void;
  customTemplates?: CustomTemplate[];
  onDesignNew?: () => void;
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
  // the "Design your own" card + each saved custom template. They consume
  // grid slots, so page 0 shows fewer presets to avoid overflow/clipping.
  const reserved = filter === "All" ? 1 + customTemplates.length : 0;

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
          {/* Design-your-own + saved custom templates (first page, All filter). */}
          {page === 0 && filter === "All" && (
            <>
              <button
                onClick={() => { onDesignNew?.(); }}
                className="group flex min-h-[224px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-300/30 bg-cyan-400/[0.04] text-center transition hover:border-cyan-300/60 hover:bg-cyan-400/[0.08]"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full border border-cyan-300/40 bg-cyan-400/10 text-cyan-200">
                  <Plus size={20} />
                </span>
                <span className="text-[14px] font-semibold text-white">Design your own template</span>
                <span className="max-w-[80%] text-[11px] text-white/55">Colors, fonts, background, decorations — your look, every deck.</span>
              </button>

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
 * Fixed-height preview card. Real pixel font sizes, no scaling, no
 * container queries. Same approach the working ThemeStep uses.
 */
function TemplatePreview({ template, theme }: { template: DeckTemplate; theme: Theme }) {
  const graphic = getGraphic(template.graphicId);
  const themeForGraphic = template.graphicAccent ? { ...theme, accent: template.graphicAccent } : theme;
  const fontFamily = resolveFontFamily(
    template.fontId,
    theme.font === "serif" ? "Georgia, serif" : "ui-sans-serif, system-ui",
  );

  const v = template.variants;
  const showBigInitial = v.titleVariant === "big-initial";
  const showNumbered   = v.titleVariant === "numbered";
  const showUnderlined = v.titleVariant === "underlined";
  const showAsymmetric = v.titleVariant === "asymmetric";

  const fg = theme.fg;
  const ac = template.graphicAccent || theme.accent;
  const muted = theme.muted;

  return (
    <div
      className="relative h-56 w-full overflow-hidden"
      style={{ background: theme.bg, fontFamily }}
    >
      {/* Graphic background */}
      {graphic.id !== "none" && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          dangerouslySetInnerHTML={{
            __html: graphic.render(themeForGraphic).replace(
              /^<svg /,
              `<svg style="display:block;width:100%;height:100%;" `,
            ),
          }}
        />
      )}

      {/* Asymmetric: half-bleed accent panel */}
      {showAsymmetric && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "38%", background: ac }} />
      )}

      {/* Big-initial faded letter */}
      {showBigInitial && (
        <div style={{
          position: "absolute", left: 8, top: -28,
          fontSize: 180, lineHeight: 1, fontWeight: 900,
          color: ac, opacity: 0.16, letterSpacing: "-0.04em",
          pointerEvents: "none",
          fontFamily,
        }}>
          {(template.name || "D").trim().charAt(0).toUpperCase()}
        </div>
      )}

      {/* Numbered: "01" in top-right */}
      {showNumbered && (
        <div style={{
          position: "absolute", right: 18, top: 6,
          fontSize: 56, lineHeight: 1, fontWeight: 900,
          color: ac, letterSpacing: "-0.02em", opacity: 0.9,
          fontFamily,
        }}>
          01
        </div>
      )}

      {/* Brand chip — hidden when "01" occupies the same corner */}
      <div style={{
        position: "absolute", right: 14, top: 12,
        fontSize: 9, letterSpacing: "0.22em",
        color: muted, opacity: showNumbered ? 0 : 0.65, fontWeight: 700,
      }}>
        EZDECK
      </div>

      {/* Content stack — vertically centered */}
      <div style={{
        position: "absolute",
        left: showAsymmetric ? "44%" : 18,
        right: 18,
        top: "50%",
        transform: "translateY(-50%)",
      }}>
        <div style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          color: showAsymmetric ? muted : ac,
          fontWeight: 700,
          marginBottom: 8,
          textTransform: "uppercase",
        }}>
          {template.category}
        </div>

        <div style={{
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1.05,
          color: fg,
          letterSpacing: "-0.015em",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {template.name}
        </div>

        {showUnderlined && (
          <div style={{ marginTop: 8, width: 48, height: 3, background: ac }} />
        )}

        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: muted,
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {template.tagline}
        </div>
      </div>
    </div>
  );
}
