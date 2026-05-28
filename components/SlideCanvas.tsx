"use client";
import { useRef, useState, useCallback } from "react";
import type {
  Slide, Annotation, Anchor, ElementId, ElementOffset,
  TableData, Reference, UploadedImage,
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
import { decorationDataUri, applyDecorationOverrides } from "@/lib/decorations";
import { resolveFontFamily } from "@/lib/fonts";
import { iconifySvgUrl } from "@/lib/iconify";

const PT = 0.104;
const IN = 7.5;
const pt = (p: number) => `${p * PT}cqw`;
const inches = (i: number) => `${i * IN}cqw`;
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export type SlideUpdater = (patch: Partial<Slide>) => void;
export type ImageSelector = (id: string | null) => void;

export default function SlideCanvas({
  slide, theme, idx, total, deckTitle, graphicId, graphicAccent, fontId,
  interactive = false,
  onUpdate,
  selectedImageId,
  onSelectImage,
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

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onPointerDown={(e) => {
        // Click on bare canvas (not an image / no-drag handle) deselects.
        const target = e.target as HTMLElement;
        if (interactive && onSelectImage) {
          // ImageBox calls onSelect on its own pointerdown; if we fire after,
          // that selection still wins because it's set in the same tick.
          // Only clear when click landed strictly on this container.
          if (target === e.currentTarget) onSelectImage(null);
        }
      }}
      style={{
        aspectRatio: `${SLIDE_W_IN} / ${SLIDE_H_IN}`,
        background: effective.bg,
        color: effective.fg,
        fontFamily,
        containerType: "inline-size",
        overflow: "hidden",
      } as React.CSSProperties}
    >
      {/* Graphic background as an inline SVG block. The SVG itself uses
          preserveAspectRatio="xMidYMid slice" so it crops correctly whatever
          our pixel size is. Inline SVG is reliably handled by html2canvas
          for PDF capture, unlike CSS background-image of a data URI. */}
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
      {/* Floating selection toolbar — appears over highlighted text in
          any [data-editable] element on this canvas. Lives outside the
          canvas DOM (rendered into document.body via fixed positioning)
          so it can escape overflow:hidden boundaries. */}
      <TextFormatBar enabled={!!interactive} canvasRef={containerRef} />
    </div>
  );
}

function Inner(props: any) {
  const { slide } = props;
  if (slide.layout === "title-hero") return <TitleHero {...props} />;
  if (slide.layout === "two-column") return <TwoColumn {...props} />;
  if (slide.layout === "table")      return <TableLayout {...props} />;
  if (slide.layout === "quote")      return <Quote {...props} />;
  if (slide.layout === "section")    return <Section {...props} />;
  if (slide.layout === "references") return <ReferencesLayout {...props} />;
  if (slide.layout === "closing")    return <Closing {...props} />;
  return <Bullets {...props} />;
}

/* ---------------------------- Static decorations --------------------------- */

function AccentBar({ theme }: { theme: Theme }) {
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
  if (isHidden(slide, id)) return null;
  const offset = slide.elementOffsets?.[id] || { dx: 0, dy: 0 };
  const [menuOpen, setMenuOpen] = useState(false);
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

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!interactive || !onUpdate) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
    if (target.isContentEditable) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startDx: offset.dx, startDy: offset.dy,
      pointerId: e.pointerId,
    };
    dragInchesRef.current = { dx: offset.dx, dy: offset.dy };
    if (elRef.current) elRef.current.style.cursor = "grabbing";
  }, [interactive, onUpdate, offset.dx, offset.dy]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current || !elRef.current) return;
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

    // Commit the final offset to deck state in a single update. If the
    // user didn't actually move, skip the update so we don't churn React.
    if (!onUpdate || !finalOffset) return;
    if (finalOffset.dx === offset.dx && finalOffset.dy === offset.dy) return;
    onUpdate({
      elementOffsets: { ...(slide.elementOffsets || {}), [id]: finalOffset },
    });
  }, [onUpdate, offset.dx, offset.dy, slide.elementOffsets, id]);

  const setSize = (size: number) => onUpdate?.({
    elementFontSizes: { ...(slide.elementFontSizes || {}), [id]: size },
  });
  const clearSize = () => onUpdate?.({
    elementFontSizes: { ...(slide.elementFontSizes || {}), [id]: undefined as any },
  });
  const remove = () => onUpdate?.({
    elementHidden: { ...(slide.elementHidden || {}), [id]: true },
  });

  const offsetTransform = `translate(${offset.dx * IN}cqw, ${offset.dy * IN}cqw)`;
  const showControls = interactive && (hover || menuOpen);
  const currentSize = explicitFontSize(slide, id);

  const onContextMenu = (e: React.MouseEvent) => {
    if (!interactive || !onUpdate) return;
    const target = e.target as HTMLElement;
    if (target.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(true);
  };

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
        userSelect: interactive ? "text" : "auto",
        outline: showControls ? `1px dashed ${theme.accent}80` : "none",
        outlineOffset: pt(4),
        // Hint to the compositor that we'll be moving this element.
        // Drops jank on Firefox especially.
        willChange: interactive ? "transform" : undefined,
      }}
    >
      {children}

      {interactive && onUpdate && (
        <button
          data-no-drag
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          style={{
            position: "absolute",
            // Sit INSIDE the element box (top-right corner). Putting this
            // outside (right: -22) gets clipped by the slide canvas's
            // `overflow: hidden`, especially for elements near the right
            // edge of the slide.
            top: pt(2), right: pt(2),
            width: pt(20), height: pt(20),
            display: "grid", placeItems: "center",
            background: "rgba(20,20,22,0.85)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff", borderRadius: "50%",
            cursor: "pointer", fontSize: pt(14),
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            lineHeight: 1,
            opacity: showControls ? 1 : 0,
            transition: "opacity 120ms ease",
            pointerEvents: showControls ? "auto" : "none",
            zIndex: 10,
          }}
          aria-label="Element options"
        >
          ⋮
        </button>
      )}

      {interactive && menuOpen && onUpdate && (
        <div
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            // Drop the menu just below the ⋮ button, anchored to the
            // element's right edge so it stays inside the slide.
            top: pt(26), right: pt(2),
            background: "rgba(20,20,22,0.97)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: pt(8),
            padding: pt(8),
            fontSize: pt(11),
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            boxShadow: "0 12px 24px rgba(0,0,0,0.5)",
            minWidth: pt(180),
            zIndex: 50,
          }}
        >
          <div style={{ marginBottom: pt(6), opacity: 0.6, fontSize: pt(9), textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Font size {currentSize ? `(${currentSize}pt)` : "(auto)"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: pt(2), marginBottom: pt(8) }}>
            {FONT_SIZE_PRESETS.map((sz) => (
              <button
                key={sz}
                onClick={() => setSize(sz)}
                style={{
                  padding: `${pt(4)} ${pt(2)}`,
                  background: currentSize === sz ? "rgba(255,255,255,0.18)" : "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff", borderRadius: pt(4),
                  cursor: "pointer", fontSize: pt(10),
                }}
              >
                {sz}
              </button>
            ))}
          </div>
          <button
            onClick={clearSize}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: `${pt(4)} ${pt(8)}`,
              background: "transparent", border: "none",
              color: "#fff", cursor: "pointer", borderRadius: pt(4),
              fontSize: pt(11),
            }}
          >
            Auto-size
          </button>
          <button
            onClick={() => { onUpdate({ elementOffsets: { ...(slide.elementOffsets || {}), [id]: { dx: 0, dy: 0 } } }); setMenuOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: `${pt(4)} ${pt(8)}`,
              background: "transparent", border: "none",
              color: "#fff", cursor: "pointer", borderRadius: pt(4),
              fontSize: pt(11),
            }}
          >
            Reset position
          </button>
          <button
            onClick={() => { remove(); setMenuOpen(false); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: `${pt(4)} ${pt(8)}`,
              background: "transparent", border: "none",
              color: "#fca5a5", cursor: "pointer", borderRadius: pt(4),
              fontSize: pt(11),
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Layouts -------------------------------- */

function TitleHero(props: any) {
  const { slide } = props;
  const variant = slide.titleVariant || "centered";
  if (variant === "asymmetric")  return <TitleHeroAsymmetric {...props} />;
  if (variant === "big-initial") return <TitleHeroBigInitial {...props} />;
  if (variant === "numbered")    return <TitleHeroNumbered {...props} />;
  if (variant === "underlined")  return <TitleHeroUnderlined {...props} />;
  return <TitleHeroCentered {...props} />;
}

function TitleHeroCentered({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  return (
    <>
      {slide.kicker && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "30%", textAlign: "center" }}
        >
          <div style={{ fontSize: pt(11), letterSpacing: "0.18em", color: theme.accent, fontWeight: 600 }}>
            <EditableText
              value={slide.kicker}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ kicker: v })}
            />
          </div>
        </Movable>
      )}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "40%", textAlign: "center" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 800, lineHeight: 1.1, color: theme.accent,
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
          baseStyle={{ position: "absolute", left: "12%", right: "12%", top: "60%", textAlign: "center" }}
        >
          <div style={{
            fontSize: pt(subtitleSize(sub, "title-hero", slide)),
            color: theme.muted,
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
      {/* Half-bleed accent panel */}
      <div style={{
        position: "absolute", left: 0, top: 0, height: "100%", width: "42%",
        background: theme.accent,
      }} />
      {/* Kicker top-right */}
      {slide.kicker && (
        <div style={{
          position: "absolute", left: "46%", top: inches(0.6),
          fontSize: pt(10), letterSpacing: "0.2em", color: theme.muted, fontWeight: 600,
        }}>
          <EditableText
            value={slide.kicker}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ kicker: v })}
          />
        </div>
      )}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "46%", right: "6%", top: "30%" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 800, lineHeight: 1.05, color: theme.fg,
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
          baseStyle={{ position: "absolute", left: "46%", right: "6%", top: "62%" }}
        >
          <div style={{ fontSize: pt(subtitleSize(sub, "title-hero", slide)), color: theme.muted, lineHeight: 1.4 }}>
            <EditableText
              value={sub}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        </Movable>
      )}
      {/* Decorative chip on the accent panel */}
      <div style={{
        position: "absolute", left: inches(0.6), bottom: inches(0.6),
        fontSize: pt(10), color: theme.bg, opacity: 0.85, letterSpacing: "0.18em", fontWeight: 600,
      }}>
        EZDECK
      </div>
    </>
  );
}

function TitleHeroBigInitial({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  const initial = (title || "D").trim().charAt(0).toUpperCase();
  return (
    <>
      {/* Massive initial cap, centered behind the text */}
      <div style={{
        position: "absolute", left: "4%", top: "-6%",
        fontSize: pt(360), fontWeight: 900, lineHeight: 1,
        color: theme.accent, opacity: 0.18,
      }}>
        {initial}
      </div>
      {slide.kicker && (
        <div style={{
          position: "absolute", left: "10%", top: "32%",
          fontSize: pt(10), letterSpacing: "0.22em", color: theme.accent, fontWeight: 700,
        }}>
          <EditableText
            value={slide.kicker}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ kicker: v })}
          />
        </div>
      )}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "42%" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 800, lineHeight: 1.05, color: theme.fg,
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
          baseStyle={{ position: "absolute", left: "10%", right: "10%", top: "70%" }}
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

function TitleHeroNumbered({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  // If kicker contains a year/number we show it big; otherwise show "01".
  const numMatch = (slide.kicker || "").match(/\b(20\d{2}|Q[1-4]|\d{2,4})\b/);
  const big = numMatch?.[0] || "01";
  const restKicker = (slide.kicker || "").replace(big, "").trim();
  return (
    <>
      <div style={{
        position: "absolute", left: "8%", top: "20%",
        fontSize: pt(120), fontWeight: 900, lineHeight: 1,
        color: theme.accent, letterSpacing: "-0.02em",
      }}>
        {big}
      </div>
      {(restKicker || interactive) && (
        <div style={{
          position: "absolute", left: "8%", top: "48%",
          fontSize: pt(11), letterSpacing: "0.2em", color: theme.muted, fontWeight: 600,
          textTransform: "uppercase",
        }}>
          <EditableText
            value={slide.kicker || ""}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ kicker: v })}
          />
        </div>
      )}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "56%" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 800, lineHeight: 1.05, color: theme.fg,
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
          baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "82%" }}
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
      {slide.kicker && (
        <div style={{
          position: "absolute", left: "8%", top: "26%",
          fontSize: pt(11), letterSpacing: "0.22em", color: theme.accent, fontWeight: 700,
        }}>
          <EditableText
            value={slide.kicker}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ kicker: v })}
          />
        </div>
      )}
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "34%" }}
      >
        <div style={{
          fontSize: pt(titleSize(title, "title-hero", slide)),
          fontWeight: 800, lineHeight: 1.05, color: theme.fg,
        }}>
          <EditableText
            value={title}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>
      {/* Heavy accent rule under the title */}
      <div style={{
        position: "absolute", left: "8%",
        top: "62%", width: inches(2.5), height: pt(8),
        background: theme.accent,
      }} />
      {sub && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "70%" }}
        >
          <div style={{ fontSize: pt(subtitleSize(sub, "title-hero", slide)), color: theme.muted, maxWidth: "80%" }}>
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

function ContentTitle({ slide, theme, interactive, onUpdate, canvasRef }: any) {
  return (
    <>
      <div style={{
        position: "absolute", left: inches(0.6), top: inches(0.85),
        width: inches(0.6), height: pt(6),
        background: theme.accent,
      }} />
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(1.0), right: inches(0.6) }}
      >
        <div style={{
          fontSize: pt(titleSize(slide.title, slide.layout, slide)),
          fontWeight: 700, color: theme.fg, lineHeight: 1.15,
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
  if (variant === "icon-check") return <BulletsIconCheck {...props} />;
  if (variant === "dashed")    return <BulletsDashed {...props} />;
  return <BulletsStandard {...props} />;
}

function BulletsStandard(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  return (
    <>
      <AccentBar theme={theme} />
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
      <AccentBar theme={theme} />
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
              minWidth: pt(22), height: pt(22),
              display: "inline-grid", placeItems: "center",
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
  const editBullet = (i: number, value: string) => {
    const next = [...bullets];
    next[i] = value;
    onUpdate?.({ bullets: next });
  };
  return (
    <>
      <AccentBar theme={theme} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6) }}
      >
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: pt(12),
          fontSize: pt(bulletSize(bullets.length, slide)),
          color: theme.fg,
        }}>
          {bullets.map((b, i) => (
            <div key={i} style={{
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

function BulletsIconCheck(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  return (
    <>
      <AccentBar theme={theme} />
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
              minWidth: pt(18), height: pt(18),
              display: "inline-grid", placeItems: "center",
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
      <AccentBar theme={theme} />
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
      <AccentBar theme={theme} />
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
      <AccentBar theme={theme} />
      <ContentTitle {...props} />
      {/* Vertical divider rule */}
      <div style={{
        position: "absolute", left: "50%", top: inches(2.7), bottom: inches(0.8),
        width: pt(2), background: `${theme.accent}`,
        opacity: 0.35,
      }}/>
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
      <AccentBar theme={theme} />
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
      minWidth: pt(20), height: pt(20),
      display: "inline-grid", placeItems: "center",
      borderRadius: pt(10), fontSize: pt(10), fontWeight: 800,
    }}>{n}</span>
  );
  return (
    <>
      <AccentBar theme={theme} />
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
  const Side = ({ items, offset, kind }: { items: string[]; offset: number; kind: "pro" | "con" }) => (
    <div>
      <div style={{
        marginBottom: pt(10),
        padding: `${pt(6)} ${pt(12)}`,
        borderRadius: pt(6),
        background: kind === "pro" ? `${theme.accent}22` : `${theme.muted}22`,
        color: kind === "pro" ? theme.accent : theme.muted,
        fontSize: pt(11), letterSpacing: "0.18em", fontWeight: 700,
        textAlign: "center", textTransform: "uppercase",
      }}>{kind === "pro" ? "Pros" : "Cons"}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((b, i) => (
          <li key={i} style={{ marginBottom: pt(8), display: "flex", gap: pt(10), alignItems: "flex-start" }}>
            <span style={{
              color: kind === "pro" ? theme.accent : theme.muted,
              fontWeight: 800, minWidth: pt(14),
            }}>{kind === "pro" ? "✓" : "✕"}</span>
            <EditableText value={b} interactive={interactive} onCommit={(v) => editBullet(offset + i, v)} style={{ flex: 1 }}/>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <>
      <AccentBar theme={theme} />
      <ContentTitle {...props} />
      <Movable id="bullets" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{
          position: "absolute", left: inches(0.6), top: inches(2.6), right: inches(0.6),
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: inches(0.5),
          fontSize: pt(bulletSize(all.length, slide)), color: theme.fg, lineHeight: 1.5,
        }}
      >
        <Side items={all.slice(0, half)} offset={0} kind="pro" />
        <Side items={all.slice(half)} offset={half} kind="con" />
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
      <AccentBar theme={theme} />
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
      <div style={{
        position: "absolute", left: inches(0.6), top: inches(1.4), bottom: inches(1.4),
        width: pt(4), background: theme.accent,
      }}/>
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
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "42%", background: theme.accent }} />
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
      <div style={{
        position: "absolute", left: "10%", top: "60%", width: pt(36), height: pt(3),
        background: theme.accent,
      }}/>
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
      <div style={{
        position: "absolute", left: "8%", top: "70%", width: inches(2.2), height: pt(8),
        background: theme.accent,
      }}/>
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
      <AccentBar theme={theme} />
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
      <div style={{
        position: "absolute", left: "10%", top: "48%", width: pt(40), height: pt(3),
        background: theme.accent,
      }}/>
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
