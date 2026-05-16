"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, X } from "lucide-react";
import { DECK_TEMPLATES, type DeckTemplate } from "@/lib/templates";
import { getTheme, type Theme } from "@/lib/themes";
import { getGraphic } from "@/lib/graphics";
import { resolveFontFamily } from "@/lib/fonts";

const PAGE_SIZE = 6;

/**
 * Modal: paginated, category-filtered gallery of deck templates.
 * Cards use a fixed-height preview so layout is identical to themes
 * step — no scaling, no aspect-ratio CSS, no container queries.
 */
export default function TemplateGallery({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (t: DeckTemplate) => void;
}) {
  const categories = useMemo(() => {
    const set = new Set<string>(DECK_TEMPLATES.map((t) => t.category));
    return ["All", ...Array.from(set)];
  }, []);
  const [filter, setFilter] = useState<string>("All");
  const [page, setPage] = useState(0);

  const visible = useMemo(() => {
    if (filter === "All") return DECK_TEMPLATES;
    return DECK_TEMPLATES.filter((t) => t.category === filter);
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageTemplates = useMemo(
    () => visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [visible, page],
  );

  useEffect(() => { setPage(0); }, [filter]);

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
        <div className="grid grid-cols-1 gap-4 overflow-y-auto px-6 pt-6 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageTemplates.map((t) => (
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

function TemplateCard({ template, onPick }: { template: DeckTemplate; onPick: () => void }) {
  const theme = getTheme(template.themeId);
  if (!theme) return null;

  return (
    <button
      onClick={onPick}
      className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] text-left transition hover:border-white/40 hover:bg-white/[0.04]"
    >
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
        DECKFLOW
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
