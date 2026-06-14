"use client";
import { useRef, useState, useCallback, createContext, useContext, useMemo } from "react";
import type {
  Slide, Annotation, Anchor, ElementId, ElementOffset,
  TableData, Reference, UploadedImage, TextBox,
} from "@/lib/types";
import type { Theme } from "@/lib/themes";
import {
  titleSize, subtitleSize, bulletSize, quoteSize, bodySize,
  tableFontSize, SLIDE_W_IN, SLIDE_H_IN, effectiveFont,
  isHidden, FONT_SIZE_PRESETS, explicitFontSize,
} from "@/lib/layoutMath";
import EditableText from "./EditableText";
import TextFormatBar from "./TextFormatBar";
import { getGraphic, svgToDataUri } from "@/lib/graphics";
import { getPattern, PATTERN_OPACITY } from "@/lib/patterns";
import { decorationDataUri, applyDecorationOverrides } from "@/lib/decorations";
import { resolveFontFamily } from "@/lib/fonts";
import { iconifySvgUrl } from "@/lib/iconify";
import { chartDataUri } from "@/lib/charts";

const PT = 0.104;
const IN = 7.5;
const pt = (p: number) => `${p * PT}cqw`;
const inches = (i: number) => `${i * IN}cqw`;
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

/** Resolve a per-role template font-family (title/subtitle/kicker/body),
 *  falling back to undefined so the slide's base font applies. */
function roleFontFamily(slide: Slide | undefined, role: "title" | "subtitle" | "kicker" | "body"): string | undefined {
  const id = slide?.templateFonts?.[role];
  return id ? resolveFontFamily(id) : undefined;
}

/* ------------------- Canvas element selection context --------------------- */

/**
 * A unified "what's currently selected on the canvas" channel so clicking
 * any element (a decorative line/bar/the big initial, or a fixed element)
 * can surface its settings in the right sidebar instead of floating menus.
 *
 * `kind` distinguishes the selectable types so the sidebar can render
 * different controls. `key` identifies the specific element (decoKey or
 * ElementId). The deco selection carries a live snapshot of the current
 * override so the sidebar can show current size/color.
 */
export type CanvasSelection =
  | { kind: "deco"; key: string; defaultColor: string }
  | { kind: "element"; id: ElementId; defaultColor: string }
  | null;

type CanvasSelCtx = {
  selection: CanvasSelection;
  select: (sel: CanvasSelection) => void;
};
const CanvasSelectionContext = createContext<CanvasSelCtx>({ selection: null, select: () => {} });
export function useCanvasSelection() { return useContext(CanvasSelectionContext); }

export type SlideUpdater = (patch: Partial<Slide>) => void;
export type ImageSelector = (id: string | null) => void;

export default function SlideCanvas({
  slide, theme, idx, total, deckTitle, graphicId, graphicAccent, fontId,
  interactive = false,
  onUpdate,
  selectedImageId,
  onSelectImage,
  placingText = false,
  onPlaceText,
  selectedTextId,
  onSelectText,
  canvasSelection,
  onCanvasSelect,
  watermark = false,
  onWatermarkClick,
}: {
  slide: Slide;
  theme: Theme;
  idx: number;
  total: number;
  deckTitle: string;
  graphicId?: string;
  graphicAccent?: string;
  fontId?: string;
  interactive?: boolean;
  onUpdate?: SlideUpdater;
  selectedImageId?: string | null;
  onSelectImage?: ImageSelector;
  /** When true, the next click on the canvas drops a new text box. */
  placingText?: boolean;
  /** Called with slide-inch coordinates where the user clicked to place text. */
  onPlaceText?: (x: number, y: number) => void;
  /** Currently selected free text box id. */
  selectedTextId?: string | null;
  /** Select a free text box (or null to clear). */
  onSelectText?: (id: string | null) => void;
  /** Currently selected canvas element (deco / fixed), surfaced in the sidebar. */
  canvasSelection?: CanvasSelection;
  /** Select a canvas element (deco / fixed) for the sidebar. */
  onCanvasSelect?: (sel: CanvasSelection) => void;
  /** Show the "Made with EXdeck" free-plan watermark on the slide. */
  watermark?: boolean;
  /** Click handler for the watermark (e.g. open the upgrade modal). */
  onWatermarkClick?: () => void;
}) {
  const font = effectiveFont(theme.font, slide);
  const themeFontFallback =
    font === "serif" ? "Georgia, serif"
    : font === "mono" ? "Consolas, ui-monospace, monospace"
    : "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const fontFamily = resolveFontFamily(fontId, themeFontFallback);

  const effective: Theme = {
    ...theme,
    fg: slide.textColorOverride || theme.fg,
    accent: slide.accentColorOverride || theme.accent,
    bg: slide.backgroundColorOverride || theme.bg,
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const graphic = getGraphic(graphicId);
  // Apply optional graphic-level accent override; the graphic only reads
  // theme.accent so substituting that single field is sufficient.
  const graphicTheme: Theme = graphicAccent ? { ...effective, accent: graphicAccent } : effective;
  const graphicSvgMarkup = graphic.id === "none" ? null : graphic.render(graphicTheme);

  // Per-slide background pattern (subtle, tiled, low opacity).
  const pattern = slide.pattern?.id ? getPattern(slide.pattern.id) : undefined;
  const patternColor = slide.pattern?.color || effective.fg;
  const patternOpacity = slide.pattern?.opacity ?? PATTERN_OPACITY;
  const patternMarkup = pattern ? pattern.render(patternColor) : null;

  const selectCtx: CanvasSelCtx = {
    selection: canvasSelection ?? null,
    select: (sel) => onCanvasSelect?.(sel),
  };

  return (
    <CanvasSelectionContext.Provider value={selectCtx}>
    <div
      ref={containerRef}
      className="relative w-full"
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        // Placement mode: drop a new text box where the user clicks.
        if (interactive && placingText && onPlaceText && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * SLIDE_W_IN;
          const y = ((e.clientY - rect.top) / rect.height) * SLIDE_H_IN;
          onPlaceText(x, y);
          return;
        }
        // Click on bare canvas (not an image / no-drag handle) deselects.
        if (interactive && target === e.currentTarget) {
          if (onSelectImage) onSelectImage(null);
          if (onSelectText) onSelectText(null);
          if (onCanvasSelect) onCanvasSelect(null);
        }
      }}
      style={{
        aspectRatio: `${SLIDE_W_IN} / ${SLIDE_H_IN}`,
        background: effective.bg,
        color: effective.fg,
        fontFamily,
        containerType: "inline-size",
        overflow: "hidden",
        cursor: interactive && placingText ? "crosshair" : undefined,
      } as React.CSSProperties}
    >
      {/* Graphic background as an inline SVG block. The SVG itself uses
          preserveAspectRatio="xMidYMid slice" so it crops correctly whatever
          our pixel size is. Inline SVG is reliably handled by html2canvas
          for PDF capture, unlike CSS background-image of a data URI. */}
      {patternMarkup && (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            pointerEvents: "none", zIndex: 0, overflow: "hidden",
            opacity: patternOpacity,
          }}
          dangerouslySetInnerHTML={{
            __html: patternMarkup.replace(
              /^<svg /,
              `<svg style="display:block;width:100%;height:100%;" `,
            ),
          }}
        />
      )}
      {graphicSvgMarkup && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            overflow: "hidden",
          }}
          // Inline the SVG markup so it lives directly in the DOM tree.
          dangerouslySetInnerHTML={{
            __html: graphicSvgMarkup.replace(
              /^<svg /,
              `<svg style="display:block;width:100%;height:100%;" `,
            ),
          }}
        />
      )}
      <Inner
        slide={slide} theme={effective} idx={idx} total={total} deckTitle={deckTitle}
        interactive={interactive} onUpdate={onUpdate} canvasRef={containerRef}
      />
      <ImageLayer
        slide={slide} interactive={interactive} onUpdate={onUpdate}
        canvasRef={containerRef} theme={effective}
        selectedImageId={selectedImageId}
        onSelectImage={onSelectImage}
      />
      <AnnotationLayer slide={slide} theme={effective} interactive={interactive} onUpdate={onUpdate} />
      <FreeTextLayer
        slide={slide} theme={effective} interactive={interactive} onUpdate={onUpdate}
        canvasRef={containerRef}
        selectedTextId={selectedTextId} onSelectText={onSelectText}
      />
      {/* Floating selection toolbar — appears over highlighted text in
          any [data-editable] element on this canvas. Lives outside the
          canvas DOM (rendered into document.body via fixed positioning)
          so it can escape overflow:hidden boundaries. */}
      <TextFormatBar enabled={!!interactive} canvasRef={containerRef} />
      {watermark && (
        <WatermarkBadge interactive={interactive} onClick={onWatermarkClick} />
      )}
    </div>
    </CanvasSelectionContext.Provider>
  );
}

function Inner(props: any) {
  const { slide } = props;
  if (slide.layout === "title-hero") return <TitleHero {...props} />;
  if (slide.layout === "two-column") return <TwoColumn {...props} />;
  if (slide.layout === "table")      return <TableLayout {...props} />;
  if (slide.layout === "chart")      return <ChartLayout {...props} />;
  if (slide.layout === "quote")      return <Quote {...props} />;
  if (slide.layout === "section")    return <Section {...props} />;
  if (slide.layout === "references") return <ReferencesLayout {...props} />;
  if (slide.layout === "closing")    return <Closing {...props} />;
  return <Bullets {...props} />;
}

/* ---------------------------- Static decorations --------------------------- */

function AccentBar({ theme, slide, interactive, onUpdate, canvasRef }: any) {
  // When rendered inside an interactive canvas, the left accent bar is a
  // movable/resizable/recolorable/removable decoration. Falls back to a
  // static bar when the editing context isn't available (e.g. thumbnails).
  if (slide && canvasRef) {
    return (
      <Deco
        decoKey="accentBar" slide={slide} theme={theme}
        interactive={!!interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: 0, top: 0, height: "100%" }}
        render={(color, scale) => (
          <div style={{ width: pt(13 * scale), height: "100%", background: color }} />
        )}
      />
    );
  }
  return (
    <div style={{
      position: "absolute", left: 0, top: 0,
      width: pt(13), height: "100%",
      background: theme.accent,
    }} />
  );
}

function Footer({ theme, deckTitle, idx, total }: any) {
  return (
    <>
      <div style={{
        position: "absolute", left: inches(0.6), bottom: inches(0.25),
        fontSize: pt(9), color: theme.muted, opacity: 0.9,
      }}>{deckTitle}</div>
      <div style={{
        position: "absolute", right: inches(0.6), bottom: inches(0.25),
        fontSize: pt(9), color: theme.muted, opacity: 0.9,
      }}>{idx + 1} / {total}</div>
    </>
  );
}

/* -------------------------- Movable element wrapper ------------------------ */

function Movable({
  id, slide, theme, interactive, onUpdate, canvasRef,
  baseStyle, children,
}: {
  id: ElementId;
  slide: Slide;
  theme: Theme;
  interactive: boolean;
  onUpdate?: SlideUpdater;
  canvasRef: React.RefObject<HTMLDivElement>;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
}) {
  const offset = slide.elementOffsets?.[id] || { dx: 0, dy: 0 };
  const sel = useCanvasSelection();
  const [hover, setHover] = useState(false);

  // Direct ref to our wrapper element so the drag handler can mutate the
  // CSS transform without going through React. Drag is one of the few
  // places where bypassing React is the right call: we'd otherwise
  // re-render the entire SlideCanvas (and re-run the floating-toolbar
  // selection observer) on every pointermove, which made dragging stutter.
  const elRef = useRef<HTMLDivElement>(null);

  // Drag state lives in refs so re-renders during a drag don't reset it.
  // dragInchesRef tracks the live (in-flight) dx/dy in slide inches so
  // we can read it on pointerup and commit a single state update.
  const dragRef = useRef<{
    startX: number; startY: number;
    startDx: number; startDy: number;
    pointerId: number;
  } | null>(null);
  const dragInchesRef = useRef<{ dx: number; dy: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const movedRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!interactive || !onUpdate) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    // Start a *potential* drag even when the press lands on the editable
    // text (the text fills the whole box, so otherwise these elements could
    // never be moved). We only treat it as a drag once the pointer actually
    // moves; a press without movement falls through to a normal click so the
    // caret can be placed for editing.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startDx: offset.dx, startDy: offset.dy,
      pointerId: e.pointerId,
    };
    dragInchesRef.current = { dx: offset.dx, dy: offset.dy };
    movedRef.current = false;
  }, [interactive, onUpdate, offset.dx, offset.dy]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current || !elRef.current) return;
    if (!movedRef.current) {
      const moved = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY);
      if (moved < 4) return;
      movedRef.current = true;
      if (elRef.current) elRef.current.style.cursor = "grabbing";
      try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ }
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const inPerPx = SLIDE_W_IN / rect.width;
    const dx = clamp(
      dragRef.current.startDx + (e.clientX - dragRef.current.startX) * inPerPx,
      -SLIDE_W_IN, SLIDE_W_IN,
    );
    const dy = clamp(
      dragRef.current.startDy + (e.clientY - dragRef.current.startY) * inPerPx,
      -SLIDE_H_IN, SLIDE_H_IN,
    );
    dragInchesRef.current = { dx, dy };

    // Throttle DOM writes to one per animation frame. The browser would
    // batch them anyway, but pinning to rAF keeps things buttery smooth
    // and avoids redundant work when the user moves the pointer fast.
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const node = elRef.current;
      const cur = dragInchesRef.current;
      if (!node || !cur) return;
      // Combine the static base transform with the live offset.
      const offsetTransform = `translate(${cur.dx * IN}cqw, ${cur.dy * IN}cqw)`;
      const baseTransform = (baseStyle.transform || "").trim();
      node.style.transform = [baseTransform, offsetTransform].filter(Boolean).join(" ");
    });
  }, [canvasRef, baseStyle.transform]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const finalOffset = dragInchesRef.current;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (elRef.current) elRef.current.style.cursor = "grab";

    // Commit the final offset only if the user actually dragged. A press
    // without movement is a click (handled by onClick → select/edit).
    if (!onUpdate || !finalOffset || !movedRef.current) return;
    if (finalOffset.dx === offset.dx && finalOffset.dy === offset.dy) return;
    onUpdate({
      elementOffsets: { ...(slide.elementOffsets || {}), [id]: finalOffset },
    });
  }, [onUpdate, offset.dx, offset.dy, slide.elementOffsets, id]);

  // Hidden elements render nothing — but only AFTER all hooks have run,
  // so the hook count stays stable across show/hide (rules of hooks).
  if (isHidden(slide, id)) return null;

  const offsetTransform = `translate(${offset.dx * IN}cqw, ${offset.dy * IN}cqw)`;
  const selected = sel.selection?.kind === "element" && sel.selection.id === id;
  const showControls = interactive && (hover || selected);

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        if (!interactive || !onUpdate) return;
        if (movedRef.current) { movedRef.current = false; return; }
        e.stopPropagation();
        sel.select({ kind: "element", id, defaultColor: theme.accent });
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-element-id={id}
      style={{
        ...baseStyle,
        transform: [(baseStyle.transform || ""), offsetTransform].filter(Boolean).join(" ").trim(),
        cursor: interactive ? "grab" : "default",
        userSelect: interactive ? "text" : "auto",
        outline: selected ? `1.5px solid ${theme.accent}` : showControls ? `1px dashed ${theme.accent}80` : "none",
        outlineOffset: pt(4),
        willChange: interactive ? "transform" : undefined,
      }}
    >
      {children}
    </div>
  );
}

/* ----------------------- Movable decorative element ----------------------- */

/**
 * Wraps a decorative (non-text) element — oversized initial, accent bars,
 * underline rules — and makes it draggable, resizable, recolorable, and
 * removable, mirroring uploaded images. State persists via elementOffsets /
 * elementSizeScale / elementColors / elementHidden, keyed by ElementId.
 */
function MovableDeco({
  id, slide, theme, interactive, onUpdate, canvasRef,
  baseStyle, defaultColor, children,
}: {
  id: ElementId;
  slide: Slide;
  theme: Theme;
  interactive: boolean;
  onUpdate?: SlideUpdater;
  canvasRef: React.RefObject<HTMLDivElement>;
  baseStyle: React.CSSProperties;
  defaultColor: string;
  children: React.ReactNode;
}) {
  const offset = slide.elementOffsets?.[id] || { dx: 0, dy: 0 };
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startDx: number; startDy: number } | null>(null);
  const dragInchesRef = useRef<{ dx: number; dy: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!interactive || !onUpdate) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startDx: offset.dx, startDy: offset.dy };
    dragInchesRef.current = { dx: offset.dx, dy: offset.dy };
    if (elRef.current) elRef.current.style.cursor = "grabbing";
  }, [interactive, onUpdate, offset.dx, offset.dy]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current || !elRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const inPerPx = SLIDE_W_IN / rect.width;
    const dx = clamp(dragRef.current.startDx + (e.clientX - dragRef.current.startX) * inPerPx, -SLIDE_W_IN, SLIDE_W_IN);
    const dy = clamp(dragRef.current.startDy + (e.clientY - dragRef.current.startY) * inPerPx, -SLIDE_H_IN, SLIDE_H_IN);
    dragInchesRef.current = { dx, dy };
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const node = elRef.current;
      const cur = dragInchesRef.current;
      if (!node || !cur) return;
      const offsetTransform = `translate(${cur.dx * IN}cqw, ${cur.dy * IN}cqw)`;
      const baseTransform = (baseStyle.transform || "").trim();
      node.style.transform = [baseTransform, offsetTransform].filter(Boolean).join(" ");
    });
  }, [canvasRef, baseStyle.transform]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const finalOffset = dragInchesRef.current;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (elRef.current) elRef.current.style.cursor = "grab";
    if (!onUpdate || !finalOffset) return;
    if (finalOffset.dx === offset.dx && finalOffset.dy === offset.dy) return;
    onUpdate({ elementOffsets: { ...(slide.elementOffsets || {}), [id]: finalOffset } });
  }, [onUpdate, offset.dx, offset.dy, slide.elementOffsets, id]);

  // Hidden — render nothing, but only after hooks ran (rules of hooks).
  if (isHidden(slide, id)) return null;

  const setScale = (mult: number) => onUpdate?.({
    elementSizeScale: { ...(slide.elementSizeScale || {}), [id]: mult },
  });
  const setColor = (c: string) => onUpdate?.({
    elementColors: { ...(slide.elementColors || {}), [id]: c },
  });
  const remove = () => onUpdate?.({
    elementHidden: { ...(slide.elementHidden || {}), [id]: true },
  });

  const offsetTransform = `translate(${offset.dx * IN}cqw, ${offset.dy * IN}cqw)`;
  const showControls = interactive && (hover || menuOpen);
  const curScale = slide.elementSizeScale?.[id] ?? 1;
  const curColor = slide.elementColors?.[id] || defaultColor;

  const onContextMenu = (e: React.MouseEvent) => {
    if (!interactive || !onUpdate) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(true);
  };

  const SWATCHES = [theme.accent, theme.fg, theme.muted, "#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#A855F7"];

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-element-id={id}
      style={{
        ...baseStyle,
        transform: [(baseStyle.transform || ""), offsetTransform].filter(Boolean).join(" ").trim(),
        cursor: interactive ? "grab" : "default",
        outline: showControls ? `1px dashed ${theme.accent}80` : "none",
        outlineOffset: pt(3),
        willChange: interactive ? "transform" : undefined,
      }}
    >
      {children}

      {interactive && onUpdate && (
        <button
          data-no-drag
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          style={{
            position: "absolute", top: pt(1), right: pt(1),
            width: pt(18), height: pt(18),
            display: "grid", placeItems: "center",
            background: "rgba(20,20,22,0.85)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff", borderRadius: "50%",
            cursor: "pointer", fontSize: pt(12), lineHeight: 1,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            opacity: showControls ? 1 : 0,
            transition: "opacity 120ms ease",
            pointerEvents: showControls ? "auto" : "none",
            zIndex: 10,
          }}
          aria-label="Decoration options"
        >
          ⋮
        </button>
      )}

      {interactive && menuOpen && onUpdate && (
        <div
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: pt(22), right: pt(1),
            background: "rgba(20,20,22,0.97)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: pt(8),
            padding: pt(8), fontSize: pt(11),
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            boxShadow: "0 12px 24px rgba(0,0,0,0.5)",
            minWidth: pt(180), zIndex: 50,
          }}
        >
          <div style={{ marginBottom: pt(5), opacity: 0.6, fontSize: pt(9), textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Size
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: pt(2), marginBottom: pt(8) }}>
            {[0.5, 0.75, 1, 1.5, 2].map((m) => (
              <button
                key={m}
                onClick={() => setScale(m)}
                style={{
                  padding: `${pt(4)} ${pt(2)}`,
                  background: curScale === m ? "rgba(255,255,255,0.18)" : "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff", borderRadius: pt(4), cursor: "pointer", fontSize: pt(10),
                }}
              >
                {m}×
              </button>
            ))}
          </div>
          <div style={{ marginBottom: pt(5), opacity: 0.6, fontSize: pt(9), textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Color
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: pt(4), marginBottom: pt(8) }}>
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: pt(16), height: pt(16), borderRadius: "50%",
                  background: c,
                  border: curColor.toLowerCase() === c.toLowerCase() ? "2px solid #fff" : "1px solid rgba(255,255,255,0.25)",
                  cursor: "pointer", padding: 0,
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <button
            onClick={() => { onUpdate({ elementOffsets: { ...(slide.elementOffsets || {}), [id]: { dx: 0, dy: 0 } }, elementSizeScale: { ...(slide.elementSizeScale || {}), [id]: 1 } }); setMenuOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: `${pt(4)} ${pt(8)}`, background: "transparent", border: "none", color: "#fff", cursor: "pointer", borderRadius: pt(4), fontSize: pt(11) }}
          >
            Reset
          </button>
          <button
            onClick={() => { remove(); setMenuOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: `${pt(4)} ${pt(8)}`, background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", borderRadius: pt(4), fontSize: pt(11) }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------- Generic decorative element (any key) ------------------ */

/**
 * Makes ANY decorative element (a line, bar, panel, ghost letter, divider)
 * on ANY layout draggable, resizable, recolorable, and removable. Overrides
 * are stored under slide.deco[decoKey] so they're independent of the fixed
 * ElementId text slots. The render function receives the resolved color and
 * scale so the decoration can apply them.
 */
function Deco({
  decoKey, slide, theme, interactive, onUpdate, canvasRef,
  baseStyle, defaultColor, render,
}: {
  decoKey: string;
  slide: Slide;
  theme: Theme;
  interactive: boolean;
  onUpdate?: SlideUpdater;
  canvasRef: React.RefObject<HTMLDivElement>;
  baseStyle: React.CSSProperties;
  defaultColor: string;
  render: (color: string, scale: number) => React.ReactNode;
}) {
  const ov = useMemo(() => slide.deco?.[decoKey] || {}, [slide.deco, decoKey]);
  const sel = useCanvasSelection();
  const [hover, setHover] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startDx: number; startDy: number } | null>(null);
  const dragInchesRef = useRef<{ dx: number; dy: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const dx = ov.dx || 0;
  const dy = ov.dy || 0;
  const scale = ov.scale ?? 1;
  const color = ov.color || defaultColor;

  const patch = useCallback((next: Partial<typeof ov>) => onUpdate?.({
    deco: { ...(slide.deco || {}), [decoKey]: { ...ov, ...next } },
  }), [onUpdate, slide.deco, decoKey, ov]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!interactive || !onUpdate) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startDx: dx, startDy: dy };
    dragInchesRef.current = { dx, dy };
    if (elRef.current) elRef.current.style.cursor = "grabbing";
  }, [interactive, onUpdate, dx, dy]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current || !elRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const inPerPx = SLIDE_W_IN / rect.width;
    const ndx = clamp(dragRef.current.startDx + (e.clientX - dragRef.current.startX) * inPerPx, -SLIDE_W_IN, SLIDE_W_IN);
    const ndy = clamp(dragRef.current.startDy + (e.clientY - dragRef.current.startY) * inPerPx, -SLIDE_H_IN, SLIDE_H_IN);
    dragInchesRef.current = { dx: ndx, dy: ndy };
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const node = elRef.current;
      const cur = dragInchesRef.current;
      if (!node || !cur) return;
      const offsetTransform = `translate(${cur.dx * IN}cqw, ${cur.dy * IN}cqw)`;
      const baseTransform = (baseStyle.transform || "").trim();
      node.style.transform = [baseTransform, offsetTransform].filter(Boolean).join(" ");
    });
  }, [canvasRef, baseStyle.transform]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const finalOffset = dragInchesRef.current;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (elRef.current) elRef.current.style.cursor = "grab";
    if (!onUpdate || !finalOffset) return;
    if (finalOffset.dx === dx && finalOffset.dy === dy) return;
    patch({ dx: finalOffset.dx, dy: finalOffset.dy });
  }, [onUpdate, dx, dy, patch]);

  // Hidden — render nothing, after hooks have run (rules of hooks).
  if (ov.hidden) return null;

  const selected = sel.selection?.kind === "deco" && sel.selection.key === decoKey;
  const showControls = interactive && (hover || selected);
  const offsetTransform = `translate(${dx * IN}cqw, ${dy * IN}cqw)`;

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => { if (interactive && onUpdate) { e.stopPropagation(); sel.select({ kind: "deco", key: decoKey, defaultColor }); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-deco-key={decoKey}
      style={{
        ...baseStyle,
        transform: [(baseStyle.transform || ""), offsetTransform].filter(Boolean).join(" ").trim(),
        cursor: interactive ? "grab" : "default",
        outline: selected ? `1.5px solid ${theme.accent}` : showControls ? `1px dashed ${theme.accent}80` : "none",
        outlineOffset: pt(3),
        willChange: interactive ? "transform" : undefined,
      }}
    >
      {render(color, scale)}
    </div>
  );
}

/* --------------------------------- Layouts -------------------------------- */

function TitleHero(props: any) {
  const { slide } = props;
  const variant = slide.titleVariant || "centered";
  if (variant === "asymmetric")  return <TitleHeroAsymmetric {...props} />;
  if (variant === "big-initial") return <TitleHeroBigInitial {...props} />;
  if (variant === "concept-hero") return <TitleHeroConcept {...props} />;
  if (variant === "numbered")    return <TitleHeroNumbered {...props} />;
  if (variant === "underlined")  return <TitleHeroUnderlined {...props} />;
  if (variant === "editorial-serif") return <TitleHeroEditorial {...props} />;
  return <TitleHeroCentered {...props} />;
}

function TitleHeroConcept({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle || "Presentation";
  const sub = slide.subtitle || "";
  const initial = String(title).trim().charAt(0).toUpperCase() || "•";
  // Length-aware title size so long titles shrink instead of overflowing /
  // colliding with the subtitle. Honors a manual titleScale override.
  const tlen = String(title).trim().length;
  const baseTitleFs = tlen <= 14 ? 78 : tlen <= 24 ? 60 : tlen <= 40 ? 46 : tlen <= 64 ? 36 : 30;
  const titleFs = baseTitleFs * (slide.titleScale || 1);
  return (
    <>
      {/* Large soft concentric circles bleeding off the right edge */}
      <div aria-hidden style={{
        position: "absolute", right: inches(-1.4), top: "50%", transform: "translateY(-50%)",
        width: inches(7.2), height: inches(7.2),
        display: "grid", placeItems: "center", pointerEvents: "none",
      }}>
        <div style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: `${theme.accent}0d` }} />
        <div style={{ position: "absolute", width: "74%", height: "74%", borderRadius: "50%", border: `${pt(1.5)} solid ${theme.accent}26` }} />
        <div style={{ position: "absolute", width: "48%", height: "48%", borderRadius: "50%", border: `${pt(1.5)} solid ${theme.accent}1f` }} />
      </div>

      {/* Top-left: monogram mark */}
      <div aria-hidden style={{
        position: "absolute", left: "6%", top: "9%",
        display: "flex", alignItems: "center", gap: pt(10),
      }}>
        <span style={{
          width: pt(34), height: pt(34), borderRadius: pt(9), background: theme.accent,
          color: theme.bg, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: pt(17),
        }}>{initial}</span>
      </div>

      {/* Top-right: kicker pill (like a date/tag chip) */}
      <Movable id="kicker" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "40%", right: "6%", top: "9%", textAlign: "right" }}
      >
        <span style={{
          display: "inline-block", maxWidth: "100%", fontSize: pt(10), letterSpacing: "0.16em", color: theme.muted, fontWeight: 600,
          textTransform: "uppercase", padding: `${pt(6)} ${pt(16)}`,
          border: `1px solid ${theme.muted}44`, borderRadius: pt(40), whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          <EditableText value={slide.kicker || "PRESENTATION"} interactive={interactive} onCommit={(v) => onUpdate?.({ kicker: v })} />
        </span>
      </Movable>

      {/* Title + subtitle in ONE flowing block so they can never overlap —
          the subtitle always sits a fixed gap below the title, no matter how
          many lines the title wraps to. Vertically centered in the safe zone
          between the top chrome and the bottom edge. */}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "6%", right: "30%", top: "22%", bottom: "12%", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "left" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: pt(14) }}>
          <div style={{
            fontSize: pt(titleFs),
            fontWeight: 800, lineHeight: 1.02, color: theme.fg, letterSpacing: "-0.03em",
            overflowWrap: "anywhere",
          }}>
            <EditableText value={title} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })} />
          </div>
          {sub && (
            <div style={{ fontSize: pt(Math.min(20, subtitleSize(sub, "title-hero", slide) * 1.05)), color: theme.muted, lineHeight: 1.35, fontWeight: 500, overflowWrap: "anywhere" }}>
              <EditableText value={sub} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })} />
            </div>
          )}
        </div>
      </Movable>
    </>
  );
}

function TitleHeroCentered({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  return (
    <>
      {/* Symmetric framing rules top & bottom */}
      <Deco decoKey="topRule" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "50%", top: "16%", transform: "translateX(-50%)" }}
        render={(color, scale) => <div style={{ width: inches(0.9 * scale), height: pt(3), background: color, borderRadius: pt(2) }} />}
      />
      <Deco decoKey="bottomRule" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "50%", bottom: "14%", transform: "translateX(-50%)" }}
        render={(color, scale) => <div style={{ width: inches(0.5 * scale), height: pt(3), background: color, opacity: 0.5, borderRadius: pt(2) }} />}
      />

      <Movable id="kicker" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "27%", textAlign: "center" }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
          <span style={{
            fontSize: pt(10.5), letterSpacing: "0.26em", color: theme.accent, fontWeight: 700,
            textTransform: "uppercase", padding: `${pt(5)} ${pt(14)}`,
            border: `1px solid ${theme.accent}66`, borderRadius: pt(40),
          }}>
            <EditableText
              value={slide.kicker || "PRESENTATION"}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ kicker: v })}
            />
          </span>
        </div>
      </Movable>

      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "40%", textAlign: "center" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 800, lineHeight: 1.08, color: theme.fg, letterSpacing: "-0.02em",
        }}>
          <EditableText
            value={title}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>
      {sub && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "16%", right: "16%", top: "62%", textAlign: "center" }}
        >
          <div style={{
            fontSize: pt(subtitleSize(sub, "title-hero", slide)),
            color: theme.muted, lineHeight: 1.5,
          }}>
            <EditableText
              value={sub}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        </Movable>
      )}
    </>
  );
}

function TitleHeroAsymmetric({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  return (
    <>
      {/* Full-bleed accent panel with layered tonal blocks */}
      <Deco decoKey="panelMain" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: 0, top: 0, height: "100%" }}
        render={(color, scale) => <div style={{ height: "100%", width: `${40 * scale}cqw`, background: color }} />}
      />
      <Deco decoKey="panelAccent" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "28%", top: 0, height: "100%" }}
        render={(color, scale) => <div style={{ height: "100%", width: `${12 * scale}cqw`, background: color, opacity: 0.4 }} />}
      />
      {/* Vertical brand label on the panel */}
      <div style={{
        position: "absolute", left: inches(0.55), top: "50%",
        transform: "translateY(-50%) rotate(180deg)", writingMode: "vertical-rl",
        fontSize: pt(10), color: theme.bg, opacity: 0.9, letterSpacing: "0.3em", fontWeight: 700,
      }}>
        EXDECK
      </div>
      {/* Big quiet number on the panel */}
      <div style={{
        position: "absolute", left: inches(1.0), top: "12%",
        fontSize: pt(64), fontWeight: 900, color: theme.bg, opacity: 0.22, lineHeight: 1,
      }}>
        01
      </div>

      {/* Kicker + title + rule + subtitle as ONE flowing, vertically-centered
          block so a long title can never overlap the rule or subtitle. */}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "46%", right: "6%", top: "12%", bottom: "12%", display: "flex", flexDirection: "column", justifyContent: "center" }}
      >
        {(() => {
          const tlen = String(title || "").trim().length;
          const baseTitleFs = tlen <= 14 ? 58 : tlen <= 24 ? 48 : tlen <= 40 ? 39 : tlen <= 64 ? 32 : 27;
          const titleFs = baseTitleFs * (slide.titleScale || 1);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: pt(13) }}>
              {slide.kicker && (
                <div style={{ fontSize: pt(10.5), letterSpacing: "0.22em", color: theme.accent, fontWeight: 700, textTransform: "uppercase" }}>
                  <EditableText value={slide.kicker} interactive={interactive} onCommit={(v) => onUpdate?.({ kicker: v })} />
                </div>
              )}
              <div style={{ fontSize: pt(titleFs), fontWeight: 800, lineHeight: 1.04, color: theme.fg, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>
                <EditableText value={title} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })} />
              </div>
              <div aria-hidden style={{ width: inches(1.2), height: pt(4), background: theme.accent, borderRadius: pt(2) }} />
              {sub && (
                <div style={{ fontSize: pt(Math.min(18, subtitleSize(sub, "title-hero", slide))), color: theme.muted, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                  <EditableText value={sub} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })} />
                </div>
              )}
            </div>
          );
        })()}
      </Movable>
    </>
  );
}

function TitleHeroBigInitial({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  const initial = (title || "D").trim().charAt(0).toUpperCase();
  return (
    <>
      {/* Massive ghost initial, aligned LEFT. Click to edit in the sidebar. */}
      <Deco decoKey="bigInitial" slide={slide} theme={theme} interactive={interactive}
        onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "2%", top: "2%", lineHeight: 1 }}
        render={(color, scale) => (
          <div style={{
            fontSize: pt(360 * scale), fontWeight: 900, lineHeight: 0.8,
            color, opacity: 0.14, letterSpacing: "-0.04em", userSelect: "none",
          }}>
            {initial}
          </div>
        )}
      />

      {/* Accent tab */}
      <Deco decoKey="keynoteTab" slide={slide} theme={theme} interactive={interactive}
        onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "10%", top: "28%" }}
        render={(color, scale) => (
          <div style={{ width: inches(0.7 * scale), height: pt(5), background: color, borderRadius: pt(3) }} />
        )}
      />

      {slide.kicker && (
        <div style={{
          position: "absolute", left: "10%", top: "33%",
          fontSize: pt(10.5), letterSpacing: "0.24em", color: theme.accent, fontWeight: 700, textTransform: "uppercase",
        }}>
          <EditableText
            value={slide.kicker}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ kicker: v })}
          />
        </div>
      )}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "10%", right: "12%", top: "42%" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 900, lineHeight: 1.02, color: theme.fg, letterSpacing: "-0.025em",
        }}>
          <EditableText
            value={title}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>
      {sub && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "10%", right: "20%", top: "72%" }}
        >
          <div style={{ fontSize: pt(subtitleSize(sub, "title-hero", slide)), color: theme.muted, lineHeight: 1.45 }}>
            <EditableText
              value={sub}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        </Movable>
      )}
    </>
  );
}

function TitleHeroNumbered({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  // If kicker contains a year/number we show it big; otherwise show "01".
  const numMatch = (slide.kicker || "").match(/\b(20\d{2}|Q[1-4]|\d{2,4})\b/);
  const big = numMatch?.[0] || "01";
  return (
    <>
      {/* Left accent spine */}
      <Deco decoKey="studentSpine" slide={slide} theme={theme} interactive={interactive}
        onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "8%", top: "16%" }}
        render={(color, scale) => (
          <div style={{ width: pt(4), height: inches(3.4 * scale), background: color, borderRadius: pt(2) }} />
        )}
      />

      {/* Oversized index number — sits higher now */}
      <div style={{
        position: "absolute", left: "12%", top: "14%",
        fontSize: pt(116), fontWeight: 900, lineHeight: 1,
        color: theme.accent, letterSpacing: "-0.03em",
      }}>
        {big}
      </div>
      <div style={{
        position: "absolute", left: "12%", top: "42%",
        fontSize: pt(11), letterSpacing: "0.22em", color: theme.muted, fontWeight: 600, textTransform: "uppercase",
      }}>
        <EditableText
          value={slide.kicker || ""}
          interactive={interactive}
          onCommit={(v) => onUpdate?.({ kicker: v })}
        />
      </div>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "12%", right: "10%", top: "48%" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 800, lineHeight: 1.05, color: theme.fg, letterSpacing: "-0.02em",
        }}>
          <EditableText
            value={title}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>
      {sub && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "12%", right: "10%", top: "72%" }}
        >
          <div style={{ fontSize: pt(subtitleSize(sub, "title-hero", slide)), color: theme.muted }}>
            <EditableText
              value={sub}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        </Movable>
      )}
    </>
  );
}

function TitleHeroUnderlined({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  return (
    <>
      {/* Soft tonal band behind the lower third */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "30%", background: theme.accent, opacity: 0.06 }} />

      {slide.kicker && (
        <div style={{
          position: "absolute", left: "8%", top: "24%",
          display: "inline-flex", alignItems: "center", gap: pt(8),
          fontSize: pt(11), letterSpacing: "0.22em", color: theme.accent, fontWeight: 700, textTransform: "uppercase",
          fontFamily: roleFontFamily(slide, "kicker"),
        }}>
          <Deco decoKey="ulKickerTick" slide={slide} theme={theme} interactive={interactive}
            onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
            baseStyle={{ position: "relative", display: "inline-block" }}
            render={(color, scale) => (
              <span style={{ width: pt(22 * scale), height: pt(3), background: color, borderRadius: pt(2), display: "inline-block" }} />
            )}
          />
          <EditableText
            value={slide.kicker}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ kicker: v })}
          />
        </div>
      )}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "33%" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 800, lineHeight: 1.05, color: theme.fg, letterSpacing: "-0.02em",
          fontFamily: roleFontFamily(slide, "title"),
        }}>
          <EditableText
            value={title}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>
      {/* Heavy accent rule under the title — click to edit in the sidebar */}
      <Deco decoKey="ulTitleRule" slide={slide} theme={theme} interactive={interactive}
        onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "8%", top: "62%" }}
        render={(color, scale) => (
          <div style={{ width: inches(2.5 * scale), height: pt(8), background: color, borderRadius: pt(2) }} />
        )}
      />
      {sub && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "70%" }}
        >
          <div style={{ fontSize: pt(subtitleSize(sub, "title-hero", slide)), color: theme.muted, maxWidth: "80%", lineHeight: 1.45, fontFamily: roleFontFamily(slide, "subtitle") }}>
            <EditableText
              value={sub}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        </Movable>
      )}
    </>
  );
}

function TitleHeroEditorial({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  return (
    <>
      {/* Thin framing rules top and bottom — editorial / masthead feel */}
      <Deco decoKey="edTopRule" slide={slide} theme={theme} interactive={interactive}
        onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.fg}
        baseStyle={{ position: "absolute", left: "8%", top: "20%" }}
        render={(color, scale) => (
          <div style={{ width: inches(8.5 * scale), height: pt(1.5), background: color, opacity: 0.55 }} />
        )}
      />

      {/* Kicker centered above the title */}
      {slide.kicker && (
        <div style={{
          position: "absolute", left: "8%", right: "8%", top: "26%", textAlign: "center",
          fontSize: pt(10.5), letterSpacing: "0.34em", color: theme.muted, fontWeight: 600, textTransform: "uppercase",
        }}>
          <EditableText
            value={slide.kicker}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ kicker: v })}
          />
        </div>
      )}

      {/* Large serif-leaning, centered title in the accent color */}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "37%", textAlign: "center" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 700, lineHeight: 1.06, color: theme.accent, letterSpacing: "-0.01em",
          fontStyle: "italic",
        }}>
          <EditableText
            value={title}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>

      {sub && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "16%", right: "16%", top: "62%", textAlign: "center" }}
        >
          <div style={{ fontSize: pt(subtitleSize(sub, "title-hero", slide)), color: theme.muted, lineHeight: 1.5 }}>
            <EditableText
              value={sub}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        </Movable>
      )}

      {/* Bottom framing rule */}
      <Deco decoKey="edBottomRule" slide={slide} theme={theme} interactive={interactive}
        onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.fg}
        baseStyle={{ position: "absolute", left: "8%", top: "80%" }}
        render={(color, scale) => (
          <div style={{ width: inches(8.5 * scale), height: pt(1.5), background: color, opacity: 0.55 }} />
        )}
      />
    </>
  );
}

function ContentTitle({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      <Deco
        decoKey="titleTab" slide={slide} theme={theme}
        interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(0.85) }}
        render={(color, scale) => (
          <div style={{ width: inches(0.6 * scale), height: pt(6), background: color }} />
        )}
      />
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(1.0), right: inches(0.6) }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title, slide.layout, slide)),
          fontWeight: 700, color: theme.fg, lineHeight: 1.15,
          fontFamily: roleFontFamily(slide, "title"),
        }}>
          <EditableText
            value={slide.title}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>
      {slide.subtitle && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: inches(0.6), top: inches(1.95), right: inches(0.6) }}
        >
          <div style={{
            fontSize: pt(subtitleSize(slide.subtitle, slide.layout, slide)),
            color: theme.muted,
            fontFamily: roleFontFamily(slide, "subtitle"),
          }}>
            <EditableText
              value={slide.subtitle}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        </Movable>
      )}
    </>
  );
}

function Bullets(props: any) {
  const { slide } = props;
  const variant = slide.bulletsVariant || "standard";
  if (variant === "numbered")  return <BulletsNumbered {...props} />;
  if (variant === "cards")     return <BulletsCards {...props} />;
  if (variant === "concept-cards") return <BulletsConcept {...props} />;
  if (variant === "icon-check") return <BulletsIconCheck {...props} />;
  if (variant === "dashed")    return <BulletsDashed {...props} />;
  return <BulletsStandard {...props} />;
}

function BulletsStandard(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6) }}
      >
        <BulletList
          interactive={interactive}
          theme={theme}
          slide={slide}
          fontSize={pt(bulletSize(slide.bullets?.length || 0, slide))}
          bullets={slide.bullets || []}
          onCommit={(text) => {
            const next = text.split("\n").map((b) => b.trim()).filter(Boolean);
            onUpdate?.({ bullets: next });
          }}
          renderMarker={(_b, i) => (
            <span style={{ color: theme.accent, fontWeight: 700 }}>•</span>
          )}
        />
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function BulletsNumbered(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6) }}
      >
        <BulletList
          interactive={interactive}
          theme={theme}
          slide={slide}
          fontSize={pt(bulletSize(slide.bullets?.length || 0, slide))}
          bullets={slide.bullets || []}
          onCommit={(text) => {
            const next = text.split("\n").map((b) => b.trim()).filter(Boolean);
            onUpdate?.({ bullets: next });
          }}
          renderMarker={(_b, i) => (
            <span style={{
              color: theme.bg, background: theme.accent,
              fontWeight: 800,
              minWidth: pt(22), width: pt(22), height: pt(22),
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              textAlign: "center", lineHeight: 1,
              borderRadius: pt(11), fontSize: pt(11),
            }}>{String(i + 1).padStart(2, "0")}</span>
          )}
        />
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function BulletsCards(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const bullets: string[] = slide.bullets || [];
  const cols = bullets.length <= 4 ? 2 : 3;
  // Flex-wrap (not grid) so a trailing orphan row auto-centers between the
  // cards above it instead of sticking to the left.
  const gap = pt(12);
  const cardWidth = `calc((100% - ${cols - 1} * ${gap}) / ${cols})`;
  const editBullet = (i: number, value: string) => {
    const next = [...bullets];
    next[i] = value;
    onUpdate?.({ bullets: next });
  };
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6) }}
      >
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap,
          fontSize: pt(bulletSize(bullets.length, slide)),
          color: theme.fg,
        }}>
          {bullets.map((b, i) => (
            <div key={i} style={{
              width: cardWidth,
              flexGrow: 0,
              flexShrink: 0,
              padding: pt(14),
              borderRadius: pt(8),
              border: `1px solid ${theme.muted}33`,
              background: `${theme.accent}0d`,
              borderLeft: `3px solid ${theme.accent}`,
              lineHeight: 1.4,
            }}>
              <div style={{ color: theme.accent, fontSize: pt(10), letterSpacing: "0.18em", fontWeight: 700, marginBottom: pt(6) }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <EditableText
                value={b}
                interactive={interactive}
                onCommit={(v) => editBullet(i, v)}
              />
            </div>
          ))}
        </div>
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function BulletsConcept(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const bullets: string[] = slide.bullets || [];
  // Fixed playful rainbow palette — the identity of this design. Rotates per
  // card so the look is the same in any template/theme it's dropped onto.
  const PALETTE = ["#8B5CF6", "#E5645A", "#2BB3A3", "#E0A82E", "#EC4899", "#3B82F6", "#10B981", "#F97316"];
  const cols = bullets.length <= 3 ? 1 : 2;
  const gap = pt(12);
  const cardWidth = cols === 1 ? "100%" : `calc((100% - ${gap}) / 2)`;
  const editBullet = (i: number, value: string) => {
    const next = [...bullets];
    next[i] = value;
    onUpdate?.({ bullets: next });
  };
  const badge = pt(42);
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6) }}
      >
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap,
          fontSize: pt(bulletSize(bullets.length, slide)),
          color: theme.fg,
        }}>
          {bullets.map((b, i) => {
            const c = PALETTE[i % PALETTE.length];
            return (
              <div key={i} style={{
                width: cardWidth,
                flexGrow: 0,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: pt(12),
                padding: pt(12),
                borderRadius: pt(14),
                background: `${c}20`,
                lineHeight: 1.4,
              }}>
                <div style={{
                  flexShrink: 0,
                  width: badge,
                  height: badge,
                  borderRadius: "50%",
                  background: c,
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: pt(15),
                  letterSpacing: "0.01em",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <EditableText
                    value={b}
                    interactive={interactive}
                    onCommit={(v) => editBullet(i, v)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function BulletsIconCheck(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6) }}
      >
        <BulletList
          interactive={interactive}
          theme={theme}
          slide={slide}
          fontSize={pt(bulletSize(slide.bullets?.length || 0, slide))}
          bullets={slide.bullets || []}
          onCommit={(text) => {
            const next = text.split("\n").map((b) => b.trim()).filter(Boolean);
            onUpdate?.({ bullets: next });
          }}
          renderMarker={() => (
            <span style={{
              minWidth: pt(18), width: pt(18), height: pt(18),
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              textAlign: "center",
              borderRadius: "50%",
              border: `1.5px solid ${theme.accent}`,
              color: theme.accent,
              fontSize: pt(11), fontWeight: 800,
              lineHeight: 1,
            }}>✓</span>
          )}
        />
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function BulletsDashed(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6) }}
      >
        <BulletList
          interactive={interactive}
          theme={theme}
          slide={slide}
          fontSize={pt(bulletSize(slide.bullets?.length || 0, slide))}
          bullets={slide.bullets || []}
          onCommit={(text) => {
            const next = text.split("\n").map((b) => b.trim()).filter(Boolean);
            onUpdate?.({ bullets: next });
          }}
          renderMarker={() => (
            <span style={{
              display: "inline-block",
              width: pt(14), height: pt(2),
              background: theme.accent,
              marginTop: pt(10),
              borderRadius: pt(1),
            }}/>
          )}
        />
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function BulletList({
  interactive, theme, slide, fontSize, bullets, onCommit, renderMarker,
}: {
  interactive: boolean; theme: Theme; slide: Slide; fontSize: string;
  bullets: string[]; onCommit: (text: string) => void;
  renderMarker?: (b: string, i: number) => React.ReactNode;
}) {
  const marker = renderMarker || ((_b: string, _i: number) => (
    <span style={{ color: theme.accent, fontWeight: 700 }}>•</span>
  ));
  return (
    <ul style={{
      margin: 0, padding: 0, listStyle: "none",
      fontSize, color: theme.fg, lineHeight: 1.5,
    }}>
      {bullets.map((b: string, i: number) => (
        <li key={i} style={{ marginBottom: pt(12), display: "flex", gap: pt(10), alignItems: "flex-start" }}>
          {marker(b, i)}
          <EditableText
            value={b}
            interactive={interactive}
            onCommit={(v) => {
              const next = [...bullets];
              next[i] = v;
              onCommit(next.join("\n"));
            }}
            style={{ flex: 1 }}
          />
        </li>
      ))}
    </ul>
  );
}

function TwoColumn(props: any) {
  const { slide } = props;
  const variant = slide.twoColumnVariant || "classic";
  if (variant === "divider")  return <TwoColumnDivider {...props} />;
  if (variant === "cards")    return <TwoColumnCards {...props} />;
  if (variant === "numbered") return <TwoColumnNumbered {...props} />;
  if (variant === "compare")  return <TwoColumnCompare {...props} />;
  return <TwoColumnClassic {...props} />;
}

function TwoColumnClassic(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const all: string[] = slide.bullets || [];
  const half = Math.ceil(all.length / 2);
  const colW = inches((SLIDE_W_IN - 0.6 * 3) / 2);

  const editBullet = (idxIn: number, value: string) => {
    const next = [...all];
    next[idxIn] = value;
    onUpdate?.({ bullets: next });
  };

  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{
          position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6),
          display: "flex", gap: inches(0.6),
          fontSize: pt(bulletSize(all.length, slide)), color: theme.fg, lineHeight: 1.5,
        }}
      >
        <ul style={{ width: colW, margin: 0, padding: 0, listStyle: "none" }}>
          {all.slice(0, half).map((b: string, i: number) => (
            <li key={i} style={{ marginBottom: pt(10), display: "flex", gap: pt(10) }}>
              <span style={{ color: theme.accent, fontWeight: 700 }}>•</span>
              <EditableText
                value={b} interactive={interactive}
                onCommit={(v) => editBullet(i, v)}
                style={{ flex: 1 }}
              />
            </li>
          ))}
        </ul>
        <ul style={{ width: colW, margin: 0, padding: 0, listStyle: "none" }}>
          {all.slice(half).map((b: string, i: number) => (
            <li key={i} style={{ marginBottom: pt(10), display: "flex", gap: pt(10) }}>
              <span style={{ color: theme.accent, fontWeight: 700 }}>•</span>
              <EditableText
                value={b} interactive={interactive}
                onCommit={(v) => editBullet(half + i, v)}
                style={{ flex: 1 }}
              />
            </li>
          ))}
        </ul>
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function TwoColumnDivider(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const all: string[] = slide.bullets || [];
  const half = Math.ceil(all.length / 2);
  const editBullet = (i: number, value: string) => {
    const next = [...all]; next[i] = value; onUpdate?.({ bullets: next });
  };
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      {/* Vertical divider rule — movable / resizable / recolorable / removable */}
      <Deco
        decoKey="colDivider" slide={slide} theme={theme}
        interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "50%", top: inches(2.7) }}
        render={(color, scale) => (
          <div style={{ width: pt(2 * scale), height: inches(7.5 - 2.7 - 0.8), background: color, opacity: 0.35 }} />
        )}
      />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{
          position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6),
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: inches(0.7),
          fontSize: pt(bulletSize(all.length, slide)), color: theme.fg, lineHeight: 1.5,
        }}
      >
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {all.slice(0, half).map((b, i) => (
            <li key={i} style={{ marginBottom: pt(10), display: "flex", gap: pt(10) }}>
              <span style={{ color: theme.accent }}>›</span>
              <EditableText value={b} interactive={interactive} onCommit={(v) => editBullet(i, v)} style={{ flex: 1 }}/>
            </li>
          ))}
        </ul>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {all.slice(half).map((b, i) => (
            <li key={i} style={{ marginBottom: pt(10), display: "flex", gap: pt(10) }}>
              <span style={{ color: theme.accent }}>›</span>
              <EditableText value={b} interactive={interactive} onCommit={(v) => editBullet(half + i, v)} style={{ flex: 1 }}/>
            </li>
          ))}
        </ul>
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function TwoColumnCards(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const all: string[] = slide.bullets || [];
  const half = Math.ceil(all.length / 2);
  const editBullet = (i: number, value: string) => {
    const next = [...all]; next[i] = value; onUpdate?.({ bullets: next });
  };
  const Col = ({ items, offset }: { items: string[]; offset: number }) => (
    <div style={{
      padding: pt(16), borderRadius: pt(10),
      border: `1px solid ${theme.muted}33`,
      background: `${theme.accent}08`,
      lineHeight: 1.5,
    }}>
      {items.map((b, i) => (
        <div key={i} style={{ marginBottom: pt(8), display: "flex", gap: pt(10) }}>
          <span style={{ color: theme.accent, fontWeight: 700 }}>•</span>
          <EditableText value={b} interactive={interactive} onCommit={(v) => editBullet(offset + i, v)} style={{ flex: 1 }}/>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{
          position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6),
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: pt(14),
          fontSize: pt(bulletSize(all.length, slide)), color: theme.fg,
        }}
      >
        <Col items={all.slice(0, half)} offset={0} />
        <Col items={all.slice(half)} offset={half} />
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function TwoColumnNumbered(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const all: string[] = slide.bullets || [];
  const half = Math.ceil(all.length / 2);
  const editBullet = (i: number, value: string) => {
    const next = [...all]; next[i] = value; onUpdate?.({ bullets: next });
  };
  const numberMarker = (n: number) => (
    <span style={{
      color: theme.bg, background: theme.accent,
      minWidth: pt(20), width: pt(20), height: pt(20),
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", lineHeight: 1,
      borderRadius: pt(10), fontSize: pt(10), fontWeight: 800,
    }}>{n}</span>
  );
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{
          position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6),
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: inches(0.6),
          fontSize: pt(bulletSize(all.length, slide)), color: theme.fg, lineHeight: 1.5,
        }}
      >
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {all.slice(0, half).map((b, i) => (
            <li key={i} style={{ marginBottom: pt(10), display: "flex", gap: pt(10), alignItems: "flex-start" }}>
              {numberMarker(i + 1)}
              <EditableText value={b} interactive={interactive} onCommit={(v) => editBullet(i, v)} style={{ flex: 1 }}/>
            </li>
          ))}
        </ul>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {all.slice(half).map((b, i) => (
            <li key={i} style={{ marginBottom: pt(10), display: "flex", gap: pt(10), alignItems: "flex-start" }}>
              {numberMarker(half + i + 1)}
              <EditableText value={b} interactive={interactive} onCommit={(v) => editBullet(half + i, v)} style={{ flex: 1 }}/>
            </li>
          ))}
        </ul>
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function TwoColumnCompare(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const all: string[] = slide.bullets || [];
  const half = Math.ceil(all.length / 2);
  const editBullet = (i: number, value: string) => {
    const next = [...all]; next[i] = value; onUpdate?.({ bullets: next });
  };
  // Use real column labels when provided. Only treat the slide as a true
  // pros/cons comparison (with ✓/✕ marks and accent/muted coloring) when the
  // labels actually read as positive vs negative. Otherwise it's a neutral
  // two-sided comparison with both columns styled the same.
  const left = slide.columnLabels?.left || "Pros";
  const right = slide.columnLabels?.right || "Cons";
  const isProsCons = /^(pros?|advantages?|benefits?|strengths?|upsides?)$/i.test(left.trim())
    && /^(cons?|disadvantages?|drawbacks?|weaknesses?|risks?|downsides?)$/i.test(right.trim());

  const Side = ({ items, offset, side }: { items: string[]; offset: number; side: "left" | "right" }) => {
    const label = side === "left" ? left : right;
    const positive = side === "left";
    const headColor = isProsCons ? (positive ? theme.accent : theme.muted) : theme.accent;
    const headBg = isProsCons
      ? (positive ? `${theme.accent}22` : `${theme.muted}22`)
      : `${theme.accent}1a`;
    const marker = isProsCons ? (positive ? "✓" : "✕") : "•";
    const markerColor = isProsCons ? (positive ? theme.accent : theme.muted) : theme.accent;
    return (
      <div>
        <div style={{
          marginBottom: pt(10),
          padding: `${pt(6)} ${pt(12)}`,
          borderRadius: pt(6),
          background: headBg,
          color: headColor,
          fontSize: pt(11), letterSpacing: "0.12em", fontWeight: 700,
          textAlign: "center", textTransform: "uppercase",
        }}>{label}</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((b, i) => (
            <li key={i} style={{ marginBottom: pt(8), display: "flex", gap: pt(10), alignItems: "flex-start" }}>
              <span style={{ color: markerColor, fontWeight: 800, minWidth: pt(14) }}>{marker}</span>
              <EditableText value={b} interactive={interactive} onCommit={(v) => editBullet(offset + i, v)} style={{ flex: 1 }}/>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{
          position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6),
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: inches(0.5),
          fontSize: pt(bulletSize(all.length, slide)), color: theme.fg, lineHeight: 1.5,
        }}
      >
        <Side items={all.slice(0, half)} offset={0} side="left" />
        <Side items={all.slice(half)} offset={half} side="right" />
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function TableLayout(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const t: TableData | undefined = slide.table;
  const variant = slide.tableVariant || "zebra";
  const updateHeader = (i: number, value: string) => {
    if (!t || !onUpdate) return;
    const headers = [...t.headers];
    headers[i] = value;
    onUpdate({ table: { ...t, headers } });
  };
  const updateCell = (ri: number, ci: number, value: string) => {
    if (!t || !onUpdate) return;
    const rows = t.rows.map((r, r2) =>
      r2 === ri ? r.map((c, c2) => (c2 === ci ? value : c)) : r,
    );
    onUpdate({ table: { ...t, rows } });
  };
  const updateSource = (value: string) => {
    if (!t || !onUpdate) return;
    onUpdate({ table: { ...t, source: value } });
  };

  // Per-variant style toggles
  const styles = tableStylesFor(variant, theme);

  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="table" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.7), right: inches(0.6) }}
      >
        {t ? (
          <>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: pt(tableFontSize(t.rows.length, t.headers.length, slide)),
              color: theme.fg,
              ...styles.table,
            }}>
              <thead>
                <tr style={styles.headRow}>
                  {t.headers.map((h, i) => (
                    <th key={i} style={{
                      textAlign: "left",
                      padding: styles.headPad,
                      ...styles.headCell,
                    }}>
                      <EditableText
                        value={h}
                        interactive={interactive}
                        onCommit={(v) => updateHeader(i, v)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, ri) => (
                  <tr key={ri} style={styles.bodyRow(ri)}>
                    {r.map((c, ci) => (
                      <td key={ci} style={{
                        padding: styles.bodyPad,
                        ...styles.bodyCell,
                      }}>
                        <EditableText
                          value={c}
                          interactive={interactive}
                          onCommit={(v) => updateCell(ri, ci, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {(t.source || interactive) && (
              <div style={{
                marginTop: pt(8), fontSize: pt(10),
                color: theme.muted, fontStyle: "italic",
              }}>
                Source:{" "}
                <EditableText
                  value={t.source || ""}
                  interactive={interactive}
                  onCommit={updateSource}
                />
              </div>
            )}
          </>
        ) : (
          <div style={{ color: theme.muted, fontSize: pt(14) }}>
            No table data. Use the chat to add rows.
          </div>
        )}
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function ChartLayout(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const spec = slide.chart;
  const src = spec ? chartDataUri(spec, theme) : "";
  // chartScale lets the user grow/shrink the chart. 1 = fill the box.
  const scale = typeof slide.chartScale === "number"
    ? Math.max(0.6, Math.min(1.6, slide.chartScale)) : 1;
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="chart" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.5), right: inches(0.6), bottom: inches(0.9) }}
      >
        {spec && src ? (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={spec.title || "chart"}
              draggable={false}
              style={{
                width: `${Math.round(scale * 100)}%`,
                height: `${Math.round(scale * 100)}%`,
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />
          </div>
        ) : (
          <div style={{ color: theme.muted, fontSize: pt(14) }}>
            No chart data. Use the chat to add a chart.
          </div>
        )}
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function tableStylesFor(variant: string, theme: Theme) {
  if (variant === "bordered") {
    return {
      table: { border: `1px solid ${theme.muted}55` },
      headRow: { background: `${theme.accent}14` },
      headCell: {
        color: theme.accent, fontWeight: 700,
        border: `1px solid ${theme.muted}55`,
        whiteSpace: "nowrap" as const,
      },
      headPad: `${pt(8)} ${pt(10)}`,
      bodyRow: () => ({}),
      bodyCell: { border: `1px solid ${theme.muted}55` },
      bodyPad: `${pt(7)} ${pt(10)}`,
    };
  }
  if (variant === "minimal") {
    return {
      table: {},
      headRow: {},
      headCell: {
        color: theme.muted, fontWeight: 700,
        textTransform: "uppercase" as const, letterSpacing: "0.12em",
        fontSize: "0.85em", whiteSpace: "nowrap" as const,
      },
      headPad: `${pt(6)} ${pt(8)}`,
      bodyRow: () => ({}),
      bodyCell: { borderBottom: `1px solid ${theme.muted}26` },
      bodyPad: `${pt(8)} ${pt(8)}`,
    };
  }
  if (variant === "accent-header") {
    return {
      table: {},
      headRow: { background: theme.accent },
      headCell: {
        color: theme.bg, fontWeight: 800,
        whiteSpace: "nowrap" as const,
      },
      headPad: `${pt(9)} ${pt(12)}`,
      bodyRow: (i: number) => ({
        background: i % 2 === 1 ? `${theme.accent}0d` : "transparent",
      }),
      bodyCell: { borderBottom: `1px solid ${theme.muted}33` },
      bodyPad: `${pt(7)} ${pt(12)}`,
    };
  }
  if (variant === "compact") {
    return {
      table: {},
      headRow: {},
      headCell: {
        color: theme.accent, fontWeight: 700,
        borderBottom: `1px solid ${theme.accent}`,
        whiteSpace: "nowrap" as const,
      },
      headPad: `${pt(5)} ${pt(8)}`,
      bodyRow: () => ({}),
      bodyCell: { borderBottom: `1px solid ${theme.muted}1f` },
      bodyPad: `${pt(4)} ${pt(8)}`,
    };
  }
  // zebra (default)
  return {
    table: {},
    headRow: {},
    headCell: {
      color: theme.accent, fontWeight: 700,
      borderBottom: `1px solid ${theme.accent}`,
      whiteSpace: "nowrap" as const,
    },
    headPad: `${pt(8)} ${pt(10)}`,
    bodyRow: (i: number) => ({
      background: i % 2 === 1 ? `${theme.accent}0d` : "transparent",
    }),
    bodyCell: { borderBottom: `1px solid ${theme.muted}33` },
    bodyPad: `${pt(7)} ${pt(10)}`,
  };
}

function Quote(props: any) {
  const { slide } = props;
  const variant = slide.quoteVariant || "giant-mark";
  if (variant === "centered")  return <QuoteCentered {...props} />;
  if (variant === "card")      return <QuoteCard {...props} />;
  if (variant === "editorial") return <QuoteEditorial {...props} />;
  if (variant === "stacked")   return <QuoteStacked {...props} />;
  return <QuoteGiantMark {...props} />;
}

function QuoteGiantMark(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const quote = slide.body || slide.title;
  return (
    <>
      <div style={{
        position: "absolute", left: inches(0.6), top: inches(0.4),
        fontSize: pt(220), color: theme.accent, fontWeight: 800, lineHeight: 1,
      }}>“</div>
      <Movable id="quote" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(1.6), top: inches(2.0), right: inches(1.6) }}
      >
        <div style={{
          fontSize: pt(quoteSize(quote, slide)),
          fontWeight: 700, fontStyle: "italic", color: theme.fg, lineHeight: 1.2,
        }}>
          <EditableText value={quote} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
        </div>
        {slide.subtitle && (
          <div style={{ marginTop: pt(14), fontSize: pt(16), color: theme.muted }}>
            — <EditableText value={slide.subtitle} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
          </div>
        )}
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function QuoteCentered(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const quote = slide.body || slide.title;
  return (
    <>
      <Movable id="quote" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "30%", textAlign: "center" }}
      >
        <div style={{
          fontSize: pt(quoteSize(quote, slide)),
          fontWeight: 600, fontStyle: "italic", color: theme.fg, lineHeight: 1.25,
        }}>
          <EditableText value={quote} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
        </div>
        <div style={{
          margin: `${pt(20)} auto 0`, width: pt(40), height: pt(2),
          background: theme.accent,
        }}/>
        {slide.subtitle && (
          <div style={{ marginTop: pt(14), fontSize: pt(13), color: theme.muted, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            <EditableText value={slide.subtitle} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
          </div>
        )}
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function QuoteCard(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const quote = slide.body || slide.title;
  return (
    <>
      <Movable id="quote" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "12%", right: "12%", top: "22%" }}
      >
        <div style={{
          padding: pt(28),
          borderRadius: pt(14),
          border: `1px solid ${theme.muted}33`,
          background: `${theme.accent}10`,
          borderLeft: `4px solid ${theme.accent}`,
        }}>
          <div style={{
            fontSize: pt(quoteSize(quote, slide)),
            fontWeight: 600, fontStyle: "italic", color: theme.fg, lineHeight: 1.25,
          }}>
            <EditableText value={quote} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
          </div>
          {slide.subtitle && (
            <div style={{ marginTop: pt(16), fontSize: pt(13), color: theme.accent, fontWeight: 700 }}>
              — <EditableText value={slide.subtitle} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
            </div>
          )}
        </div>
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function QuoteEditorial(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const quote = slide.body || slide.title;
  return (
    <>
      {/* Left rule */}
      <Deco decoKey="quoteRule" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(1.4) }}
        render={(color, scale) => <div style={{ width: pt(4 * scale), height: inches(7.5 - 1.4 - 1.4), background: color }} />}
      />
      <Movable id="quote" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(1.0), top: inches(1.6), right: inches(0.8) }}
      >
        <div style={{ color: theme.muted, fontSize: pt(11), letterSpacing: "0.22em", fontWeight: 700, marginBottom: pt(14) }}>
          PULL QUOTE
        </div>
        <div style={{
          fontSize: pt(quoteSize(quote, slide) * 1.05),
          fontWeight: 700, color: theme.fg, lineHeight: 1.15,
        }}>
          <EditableText value={quote} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
        </div>
        {slide.subtitle && (
          <div style={{ marginTop: pt(18), fontSize: pt(13), color: theme.muted, fontStyle: "italic" }}>
            — <EditableText value={slide.subtitle} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
          </div>
        )}
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function QuoteStacked(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const quote = slide.body || slide.title;
  // Split on hard line breaks for visual emphasis lines
  const lines = (quote || "").split(/\n+/).filter(Boolean);
  return (
    <>
      <Movable id="quote" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "20%" }}
      >
        {lines.length > 1 ? (
          <div>
            {lines.map((ln: string, i: number) => (
              <div key={i} style={{
                fontSize: pt(quoteSize(quote, slide) * (i === 0 ? 1.15 : 0.85)),
                fontWeight: i === 0 ? 800 : 600,
                color: i === 0 ? theme.accent : theme.fg,
                lineHeight: 1.05, marginBottom: pt(10),
              }}>{ln}</div>
            ))}
            {/* Single editable surface for the whole quote so users can re-edit */}
            <div style={{ marginTop: pt(14), fontSize: pt(11), color: theme.muted, fontStyle: "italic" }}>
              <EditableText value={quote} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: pt(quoteSize(quote, slide) * 1.05),
            fontWeight: 800, color: theme.fg, lineHeight: 1.05,
          }}>
            <EditableText value={quote} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
          </div>
        )}
        {slide.subtitle && (
          <div style={{ marginTop: pt(20), fontSize: pt(13), color: theme.accent, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
            — <EditableText value={slide.subtitle} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
          </div>
        )}
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function Section(props: any) {
  const { slide } = props;
  const variant = slide.sectionVariant || "panel";
  if (variant === "split")        return <SectionSplit {...props} />;
  if (variant === "minimal")      return <SectionMinimal {...props} />;
  if (variant === "chapter")      return <SectionChapter {...props} />;
  if (variant === "kicker-hero")  return <SectionKickerHero {...props} />;
  return <SectionPanel {...props} />;
}

function SectionPanel({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  const overridden = !!slide.backgroundColorOverride;
  const panel = overridden ? theme.bg : theme.accent;
  const textCol = overridden ? theme.fg : theme.bg;
  return (
    <div style={{ position: "absolute", inset: 0, background: panel }}>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "42%", textAlign: "center" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title, "section", slide)), fontWeight: 800,
          color: textCol, lineHeight: 1.1,
        }}>
          <EditableText value={slide.title} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      {slide.body && (
        <Movable id="body" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "12%", right: "12%", top: "60%", textAlign: "center" }}
        >
          <div style={{ fontSize: pt(bodySize(slide)), color: textCol, opacity: 0.9 }}>
            <EditableText value={slide.body} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
          </div>
        </Movable>
      )}
    </div>
  );
}

function SectionSplit({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      <Deco decoKey="sectionPanel" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: 0, top: 0, bottom: 0 }}
        render={(color, scale) => <div style={{ height: "100%", width: `${42 * scale}cqw`, background: color }} />}
      />
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "46%", right: "8%", top: "32%" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title, "section", slide)),
          fontWeight: 800, color: theme.fg, lineHeight: 1.05,
        }}>
          <EditableText value={slide.title} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      {slide.body && (
        <Movable id="body" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "46%", right: "8%", top: "62%" }}
        >
          <div style={{ fontSize: pt(bodySize(slide)), color: theme.muted, lineHeight: 1.4 }}>
            <EditableText value={slide.body} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
          </div>
        </Movable>
      )}
      {slide.kicker && (
        <div style={{
          position: "absolute", left: inches(0.6), bottom: inches(0.6),
          fontSize: pt(11), color: theme.bg, opacity: 0.9, letterSpacing: "0.2em", fontWeight: 700,
        }}>
          <EditableText value={slide.kicker} interactive={interactive} onCommit={(v) => onUpdate?.({ kicker: v })}/>
        </div>
      )}
    </>
  );
}

function SectionMinimal({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "44%" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title, "section", slide)),
          fontWeight: 700, color: theme.fg, lineHeight: 1.1,
        }}>
          <EditableText value={slide.title} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      <Deco decoKey="sectionRule" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "10%", top: "60%" }}
        render={(color, scale) => <div style={{ width: pt(36 * scale), height: pt(3), background: color }} />}
      />
      {slide.body && (
        <Movable id="body" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "66%" }}
        >
          <div style={{ fontSize: pt(bodySize(slide)), color: theme.muted, lineHeight: 1.4 }}>
            <EditableText value={slide.body} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
          </div>
        </Movable>
      )}
    </>
  );
}

function SectionChapter({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  // Picks a chapter number from kicker when the kicker is numeric; otherwise "01".
  const num = (slide.kicker || "").match(/\b(20\d{2}|Q[1-4]|\d{1,3})\b/)?.[0] || "01";
  return (
    <>
      <div style={{
        position: "absolute", left: "8%", top: "20%",
        fontSize: pt(140), fontWeight: 900, lineHeight: 1,
        color: theme.accent, letterSpacing: "-0.03em",
      }}>{num}</div>
      <div style={{
        position: "absolute", left: "8%", top: "50%",
        fontSize: pt(11), letterSpacing: "0.22em", color: theme.muted, fontWeight: 700,
      }}>
        CHAPTER
      </div>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "58%" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title, "section", slide)),
          fontWeight: 800, color: theme.fg, lineHeight: 1.1,
        }}>
          <EditableText value={slide.title} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      {slide.body && (
        <Movable id="body" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "78%" }}
        >
          <div style={{ fontSize: pt(bodySize(slide)), color: theme.muted, lineHeight: 1.4 }}>
            <EditableText value={slide.body} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
          </div>
        </Movable>
      )}
    </>
  );
}

function SectionKickerHero({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      {(slide.kicker || interactive) && (
        <div style={{
          position: "absolute", left: "8%", top: "30%",
          fontSize: pt(13), letterSpacing: "0.24em", color: theme.accent, fontWeight: 700,
        }}>
          <EditableText value={slide.kicker || ""} interactive={interactive} onCommit={(v) => onUpdate?.({ kicker: v })}/>
        </div>
      )}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "40%" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title, "section", slide) * 1.05),
          fontWeight: 900, color: theme.fg, lineHeight: 1.0,
          letterSpacing: "-0.02em",
        }}>
          <EditableText value={slide.title} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      <Deco decoKey="sectionRule" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "8%", top: "70%" }}
        render={(color, scale) => <div style={{ width: inches(2.2 * scale), height: pt(8), background: color }} />}
      />
      {slide.body && (
        <Movable id="body" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "78%" }}
        >
          <div style={{ fontSize: pt(bodySize(slide)), color: theme.muted, lineHeight: 1.4 }}>
            <EditableText value={slide.body} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ body: v })}/>
          </div>
        </Movable>
      )}
    </>
  );
}

function ReferencesLayout(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const refs: Reference[] = (slide.references as Reference[]) || [];
  const updateRef = (i: number, patch: Partial<Reference>) => {
    if (!onUpdate) return;
    const next = refs.map((r, ix) => (ix === i ? { ...r, ...patch } : r));
    onUpdate({ references: next });
  };
  return (
    <>
      <AccentBar theme={theme} slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6) }}
      >
        <ol style={{
          margin: 0, padding: 0, listStyle: "none",
          fontSize: pt(refs.length > 6 ? 12 : 14),
          color: theme.fg, lineHeight: 1.45,
        }}>
          {refs.map((r, i) => (
            <li key={i} style={{ marginBottom: pt(8), display: "flex", gap: pt(8) }}>
              <span style={{ color: theme.accent, fontWeight: 700, minWidth: pt(20) }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>
                <EditableText
                  value={r.text}
                  interactive={interactive}
                  onCommit={(v) => updateRef(i, { text: v })}
                />
                {(r.url || interactive) && (
                  <span style={{ color: theme.muted }}>
                    {" — "}
                    <EditableText
                      value={r.url || ""}
                      interactive={interactive}
                      onCommit={(v) => updateRef(i, { url: v })}
                    />
                  </span>
                )}
              </span>
            </li>
          ))}
          {refs.length === 0 && (
            <li style={{ color: theme.muted, fontStyle: "italic" }}>
              No references. Use the chat to add some.
            </li>
          )}
        </ol>
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function Closing(props: any) {
  const { slide } = props;
  const variant = slide.closingVariant || "centered";
  if (variant === "qa")        return <ClosingQA {...props} />;
  if (variant === "contact")   return <ClosingContact {...props} />;
  if (variant === "cta")       return <ClosingCta {...props} />;
  if (variant === "signature") return <ClosingSignature {...props} />;
  return <ClosingCentered {...props} />;
}

function ClosingCentered({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: pt(13), background: theme.accent }} />
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "40%", textAlign: "center" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title || "Thank you", "closing", slide)),
          fontWeight: 800, lineHeight: 1.1, color: theme.accent,
        }}>
          <EditableText value={slide.title || "Thank you"} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      {slide.subtitle && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "12%", right: "12%", top: "60%", textAlign: "center" }}
        >
          <div style={{ fontSize: pt(18), color: theme.muted }}>
            <EditableText value={slide.subtitle} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
          </div>
        </Movable>
      )}
    </>
  );
}

function ClosingQA({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      <div style={{
        position: "absolute", left: "8%", top: "26%",
        fontSize: pt(220), fontWeight: 900, color: theme.accent, lineHeight: 1,
        letterSpacing: "-0.02em",
      }}>?</div>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "30%", right: "8%", top: "38%" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title || "Questions", "closing", slide)),
          fontWeight: 800, color: theme.fg, lineHeight: 1.1,
        }}>
          <EditableText value={slide.title || "Questions"} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      {slide.subtitle && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "30%", right: "8%", top: "60%" }}
        >
          <div style={{ fontSize: pt(15), color: theme.muted, lineHeight: 1.4 }}>
            <EditableText value={slide.subtitle} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
          </div>
        </Movable>
      )}
    </>
  );
}

function ClosingContact({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "26%" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title || "Stay in touch", "closing", slide) * 0.95),
          fontWeight: 800, color: theme.fg, lineHeight: 1.05,
        }}>
          <EditableText value={slide.title || "Stay in touch"} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      <Deco decoKey="closingRule" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef} defaultColor={theme.accent}
        baseStyle={{ position: "absolute", left: "10%", top: "48%" }}
        render={(color, scale) => <div style={{ width: pt(40 * scale), height: pt(3), background: color }} />}
      />
      {slide.subtitle && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "55%" }}
        >
          <div style={{ fontSize: pt(15), color: theme.fg, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            <EditableText
              value={slide.subtitle}
              multiline
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        </Movable>
      )}
    </>
  );
}

function ClosingCta({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <div style={{ position: "absolute", inset: 0, background: theme.accent }}>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "30%", textAlign: "center" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title || "Let's go", "closing", slide)),
          fontWeight: 900, color: theme.bg, lineHeight: 1.05,
          letterSpacing: "-0.02em",
        }}>
          <EditableText value={slide.title || "Let's go"} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      {slide.subtitle && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "12%", right: "12%", top: "55%", textAlign: "center" }}
        >
          <div style={{ fontSize: pt(15), color: theme.bg, opacity: 0.85, lineHeight: 1.4 }}>
            <EditableText value={slide.subtitle} interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
          </div>
        </Movable>
      )}
      {slide.kicker && (
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)", top: "70%",
          padding: `${pt(10)} ${pt(20)}`,
          background: theme.bg, color: theme.accent,
          fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
          borderRadius: pt(6), fontSize: pt(12),
        }}>
          <EditableText value={slide.kicker} interactive={interactive} onCommit={(v) => onUpdate?.({ kicker: v })}/>
        </div>
      )}
    </div>
  );
}

function ClosingSignature({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "30%" }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title || "Thank you", "closing", slide) * 1.1),
          fontWeight: 800, color: theme.fg, lineHeight: 1.0,
          fontStyle: "italic",
        }}>
          <EditableText value={slide.title || "Thank you"} interactive={interactive} onCommit={(v) => onUpdate?.({ title: v })}/>
        </div>
      </Movable>
      <div style={{
        position: "absolute", left: "10%", top: "55%", width: inches(3.5), height: pt(3),
        background: theme.accent,
      }}/>
      {(slide.subtitle || interactive) && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "62%" }}
        >
          <div style={{ fontSize: pt(13), color: theme.muted, lineHeight: 1.5, letterSpacing: "0.02em" }}>
            <EditableText value={slide.subtitle || "Presented by"} multiline interactive={interactive} onCommit={(v) => onUpdate?.({ subtitle: v })}/>
          </div>
        </Movable>
      )}
    </>
  );
}

/* ----------------------------- Image overlay ------------------------------- */

function ImageLayer({
  slide, interactive, onUpdate, canvasRef, theme,
  selectedImageId, onSelectImage,
}: {
  slide: Slide; interactive: boolean; onUpdate?: SlideUpdater;
  canvasRef: React.RefObject<HTMLDivElement>; theme: Theme;
  selectedImageId?: string | null;
  onSelectImage?: ImageSelector;
}) {
  const images = slide.uploadedImages || [];
  if (images.length === 0) return null;

  return (
    <>
      {images.map((img) => (
        <ImageBox
          key={img.id} img={img} slide={slide}
          interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          theme={theme}
          selected={selectedImageId === img.id}
          onSelect={onSelectImage}
        />
      ))}
    </>
  );
}

function ImageBox({
  img, slide, interactive, onUpdate, canvasRef, theme,
  selected, onSelect,
}: {
  img: UploadedImage; slide: Slide; interactive: boolean;
  onUpdate?: SlideUpdater; canvasRef: React.RefObject<HTMLDivElement>; theme: Theme;
  selected?: boolean;
  onSelect?: ImageSelector;
}) {
  const [hover, setHover] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number; mode: "move" | "resize" } | null>(null);

  const updateImg = (patch: Partial<UploadedImage>) => {
    if (!onUpdate) return;
    const next = (slide.uploadedImages || []).map((x) => x.id === img.id ? { ...x, ...patch } : x);
    onUpdate({ uploadedImages: next });
  };
  const removeImg = () => {
    if (!onUpdate) return;
    const next = (slide.uploadedImages || []).filter((x) => x.id !== img.id);
    onUpdate({ uploadedImages: next });
  };

  const onPointerDown = (e: React.PointerEvent, mode: "move" | "resize") => {
    if (!interactive || !onUpdate) return;
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      ox: mode === "move" ? img.x : img.w,
      oy: mode === "move" ? img.y : img.h,
      mode,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const inPerPx = SLIDE_W_IN / rect.width;
    const dx = (e.clientX - dragRef.current.startX) * inPerPx;
    const dy = (e.clientY - dragRef.current.startY) * inPerPx;
    if (dragRef.current.mode === "move") {
      updateImg({
        x: clamp(dragRef.current.ox + dx, -img.w / 2, SLIDE_W_IN - img.w / 2),
        y: clamp(dragRef.current.oy + dy, -img.h / 2, SLIDE_H_IN - img.h / 2),
      });
    } else {
      const newW = clamp(dragRef.current.ox + dx, 0.6, SLIDE_W_IN);
      // preserve aspect via current ratio
      const ratio = img.h / img.w;
      updateImg({ w: newW, h: clamp(newW * ratio, 0.4, SLIDE_H_IN) });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  return (
    <div
      onPointerDown={(e) => { onSelect?.(img.id); onPointerDown(e, "move"); }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => {
        if (!interactive || !onUpdate) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect?.(img.id);
        if (window.confirm("Delete this graphic from the slide?")) removeImg();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        left: inches(img.x),
        top: inches(img.y),
        width: inches(img.w),
        height: inches(img.h),
        cursor: interactive ? "grab" : "default",
        outline: interactive && (selected || hover)
          ? `${selected ? 2.5 : 2}px solid ${theme.accent}` : "none",
        outlineOffset: pt(2),
        userSelect: "none",
        zIndex: selected ? 5 : 1,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          img.kind === "decoration" && img.decorationId
            ? decorationDataUri(img.decorationId, applyDecorationOverrides(theme, img.colorOverrides))
          : img.kind === "icon" && img.iconId
            ? iconifySvgUrl(img.iconId, img.colorOverrides?.accent || theme.accent)
            : img.dataUrl
        }
        alt=""
        draggable={false}
        crossOrigin="anonymous"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          opacity: typeof img.opacity === "number" ? Math.max(0, Math.min(1, img.opacity)) : undefined,
        }}
      />
      {interactive && hover && onUpdate && (
        <>
          <button
            data-no-drag
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); removeImg(); }}
            style={{
              position: "absolute", top: pt(-10), right: pt(-10),
              width: pt(20), height: pt(20),
              background: "rgba(20,20,22,0.9)",
              color: "#fca5a5",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "50%", cursor: "pointer", fontSize: pt(11),
              lineHeight: 1, fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
            aria-label="Delete image"
          >
            ✕
          </button>
          <div
            data-no-drag
            onPointerDown={(e) => onPointerDown(e, "resize")}
            style={{
              position: "absolute", right: pt(-6), bottom: pt(-6),
              width: pt(14), height: pt(14),
              background: theme.accent,
              border: "2px solid #fff",
              borderRadius: pt(2),
              cursor: "nwse-resize",
            }}
          />
        </>
      )}
    </div>
  );
}

/* ----------------------------- Watermark badge ---------------------------- */

/**
 * Bold "Made with EXdeck" badge shown on free-plan slides (editor canvas,
 * PDF export via the hidden renderer). Clickable in the editor to prompt an
 * upgrade. Uses container query units so it scales with the slide.
 */
function WatermarkBadge({
  interactive, onClick,
}: { interactive: boolean; onClick?: () => void }) {
  const clickable = interactive && !!onClick;
  return (
    <button
      type="button"
      onClick={clickable ? (e) => { e.stopPropagation(); onClick!(); } : undefined}
      aria-label="Made with EXdeck — upgrade to remove"
      title={clickable ? "Upgrade to remove this watermark" : "Made with EXdeck"}
      style={{
        position: "absolute",
        right: "2.2cqw",
        bottom: "2.6cqw",
        zIndex: 40,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.6cqw",
        padding: "0.8cqw 1.6cqw",
        borderRadius: "999px",
        border: "none",
        background: "rgba(0,0,0,0.55)",
        color: "#ffffff",
        fontWeight: 800,
        fontSize: "2.4cqw",
        letterSpacing: "0.02em",
        lineHeight: 1,
        cursor: clickable ? "pointer" : "default",
        pointerEvents: clickable ? "auto" : "none",
        backdropFilter: "blur(2px)",
        boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ fontSize: "2.6cqw" }}>✦</span>
      Made with EXdeck
    </button>
  );
}

/* ----------------------------- Annotation layer ---------------------------- */

function AnnotationLayer({
  slide, theme, interactive, onUpdate,
}: {
  slide: Slide; theme: Theme;
  interactive?: boolean; onUpdate?: SlideUpdater;
}) {
  const anns = slide.annotations || [];
  if (anns.length === 0) return null;

  const PADDING_IN = 0.5;
  const groups: Record<string, Annotation[]> = {};
  for (const a of anns) (groups[a.anchor] ||= []).push(a);

  const updateAnnotation = (id: string, value: string) => {
    if (!onUpdate) return;
    onUpdate({
      annotations: (slide.annotations || []).map((a) =>
        a.id === id ? { ...a, text: value } : a,
      ),
    });
  };

  return (
    <>
      {Object.entries(groups).map(([anchor, list]) => (
        <div key={anchor} style={positionFor(anchor as Anchor, PADDING_IN)}>
          {list.map((a) => (
            <div key={a.id} style={{
              fontSize: pt(a.fontSize ?? 12),
              color: a.color || theme.fg,
              fontWeight: a.bold ? 700 : 400,
              fontStyle: a.italic ? "italic" : undefined,
              textAlign: a.align || alignFor(anchor as Anchor),
              lineHeight: 1.3, whiteSpace: "pre-wrap",
              marginBottom: pt(2),
              pointerEvents: interactive ? "auto" : "none",
            }}>
              <EditableText
                value={a.text}
                interactive={!!interactive}
                onCommit={(v) => updateAnnotation(a.id, v)}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function positionFor(anchor: Anchor, pad: number): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    maxWidth: inches(SLIDE_W_IN - pad * 2),
    // Children opt back into pointer events when interactive (each annotation
    // text element sets its own pointerEvents). Keep the wrapper transparent
    // so dragging the slide canvas behind annotations still works.
    pointerEvents: "none",
  };
  const [v, h] = anchor.split("-") as [string, string];
  if (v === "top")    base.top = inches(pad);
  if (v === "middle") base.top = "50%";
  if (v === "bottom") base.bottom = inches(pad);
  if (h === "left")   base.left = inches(pad);
  if (h === "center") base.left = "50%";
  if (h === "right")  base.right = inches(pad);
  if (h === "center") base.transform = (base.transform || "") + " translateX(-50%)";
  if (v === "middle") base.transform = (base.transform || "") + " translateY(-50%)";
  if (base.transform) base.transform = base.transform.trim();
  return base;
}

function alignFor(anchor: Anchor): "left" | "center" | "right" {
  if (anchor.endsWith("-center")) return "center";
  if (anchor.endsWith("-right")) return "right";
  return "left";
}


/* ---------------------------- Free text layer ----------------------------- */

function FreeTextLayer({
  slide, theme, interactive, onUpdate, canvasRef, selectedTextId, onSelectText,
}: {
  slide: Slide; theme: Theme; interactive?: boolean; onUpdate?: SlideUpdater;
  canvasRef: React.RefObject<HTMLDivElement>;
  selectedTextId?: string | null;
  onSelectText?: (id: string | null) => void;
}) {
  const boxes = slide.textBoxes || [];
  if (boxes.length === 0) return null;
  return (
    <>
      {boxes.map((tb) => (
        <FreeTextBox
          key={tb.id} tb={tb} slide={slide} theme={theme}
          interactive={!!interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          selected={selectedTextId === tb.id} onSelect={onSelectText}
        />
      ))}
    </>
  );
}

function FreeTextBox({
  tb, slide, theme, interactive, onUpdate, canvasRef, selected, onSelect,
}: {
  tb: TextBox; slide: Slide; theme: Theme; interactive: boolean;
  onUpdate?: SlideUpdater; canvasRef: React.RefObject<HTMLDivElement>;
  selected?: boolean; onSelect?: (id: string | null) => void;
}) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number; moved: boolean } | null>(null);

  const update = (patch: Partial<TextBox>) => {
    if (!onUpdate) return;
    onUpdate({ textBoxes: (slide.textBoxes || []).map((x) => x.id === tb.id ? { ...x, ...patch } : x) });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || !onUpdate || editing) return;
    e.preventDefault(); e.stopPropagation();
    onSelect?.(tb.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: tb.x, oy: tb.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const inPerPx = SLIDE_W_IN / rect.width;
    const dx = (e.clientX - dragRef.current.startX) * inPerPx;
    const dy = (e.clientY - dragRef.current.startY) * inPerPx;
    if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) dragRef.current.moved = true;
    update({
      x: clamp(dragRef.current.ox + dx, 0, SLIDE_W_IN - 0.5),
      y: clamp(dragRef.current.oy + dy, 0, SLIDE_H_IN - 0.3),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  const showOutline = interactive && (hover || selected || editing);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => { if (interactive) { e.stopPropagation(); setEditing(true); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        left: inches(tb.x), top: inches(tb.y),
        width: inches(tb.w),
        cursor: interactive ? (editing ? "text" : "move") : "default",
        outline: showOutline ? `1px solid ${theme.accent}` : "none",
        outlineOffset: pt(3),
        zIndex: 6,
      }}
    >
      <EditableText
        value={tb.text}
        interactive={interactive && editing}
        multiline
        onCommit={(v) => { update({ text: v }); setEditing(false); }}
        style={{
          display: "block",
          fontSize: pt(tb.fontSize),
          fontFamily: tb.fontId ? resolveFontFamily(tb.fontId) : undefined,
          fontWeight: tb.bold ? 800 : 400,
          fontStyle: tb.italic ? "italic" : "normal",
          textDecoration: tb.underline ? "underline" : "none",
          color: tb.color || theme.fg,
          textAlign: tb.align || "left",
          lineHeight: 1.3,
          outline: "none",
          width: "100%",
          pointerEvents: editing ? "auto" : "none",
        }}
      />
      {/* Hint while selected but not editing */}
      {interactive && selected && !editing && (
        <div
          data-no-drag
          style={{
            position: "absolute", left: 0, top: pt(-16),
            fontSize: pt(8), color: theme.accent, whiteSpace: "nowrap",
            fontFamily: "ui-sans-serif, system-ui, sans-serif", opacity: 0.85,
          }}
        >
          drag to move · double-click to edit
        </div>
      )}
    </div>
  );
}
