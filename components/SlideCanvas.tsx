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

const PT = 0.104;
const IN = 7.5;
const pt = (p: number) => `${p * PT}cqw`;
const inches = (i: number) => `${i * IN}cqw`;
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export type SlideUpdater = (patch: Partial<Slide>) => void;

export default function SlideCanvas({
  slide, theme, idx, total, deckTitle,
  interactive = false,
  onUpdate,
}: {
  slide: Slide;
  theme: Theme;
  idx: number;
  total: number;
  deckTitle: string;
  interactive?: boolean;
  onUpdate?: SlideUpdater;
}) {
  const font = effectiveFont(theme.font, slide);
  const fontFamily =
    font === "serif" ? "Georgia, serif"
    : font === "mono" ? "Consolas, ui-monospace, monospace"
    : "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  const effective: Theme = {
    ...theme,
    fg: slide.textColorOverride || theme.fg,
    accent: slide.accentColorOverride || theme.accent,
    bg: slide.backgroundColorOverride || theme.bg,
  };

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{
        aspectRatio: `${SLIDE_W_IN} / ${SLIDE_H_IN}`,
        background: effective.bg,
        color: effective.fg,
        fontFamily,
        containerType: "inline-size",
        overflow: "hidden",
      } as React.CSSProperties}
    >
      <Inner
        slide={slide} theme={effective} idx={idx} total={total} deckTitle={deckTitle}
        interactive={interactive} onUpdate={onUpdate} canvasRef={containerRef}
      />
      <ImageLayer slide={slide} interactive={interactive} onUpdate={onUpdate} canvasRef={containerRef} theme={effective} />
      <AnnotationLayer slide={slide} theme={effective} />
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
  const dragRef = useRef<{ startX: number; startY: number; startDx: number; startDy: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!interactive || !onUpdate) return;
    const target = e.target as HTMLElement;
    // If the click started inside an editable text or a no-drag handle,
    // do nothing — let the inner control receive normal pointer events.
    if (target.closest("[data-no-drag]")) return;
    // Same for any contentEditable element so caret placement always wins.
    if (target.isContentEditable) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startDx: offset.dx, startDy: offset.dy,
    };
  }, [interactive, onUpdate, offset.dx, offset.dy]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current || !onUpdate) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const inPerPx = SLIDE_W_IN / rect.width;
    const dx = dragRef.current.startDx + (e.clientX - dragRef.current.startX) * inPerPx;
    const dy = dragRef.current.startDy + (e.clientY - dragRef.current.startY) * inPerPx;
    onUpdate({
      elementOffsets: { ...(slide.elementOffsets || {}), [id]: {
        dx: clamp(dx, -SLIDE_W_IN, SLIDE_W_IN),
        dy: clamp(dy, -SLIDE_H_IN, SLIDE_H_IN),
      } },
    });
  }, [canvasRef, onUpdate, slide.elementOffsets, id]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }, []);

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

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...baseStyle,
        transform: [(baseStyle.transform || ""), offsetTransform].filter(Boolean).join(" ").trim(),
        cursor: interactive ? "grab" : "default",
        userSelect: interactive ? "none" : "auto",
        outline: showControls ? `1px dashed ${theme.accent}80` : "none",
        outlineOffset: pt(4),
      }}
    >
      {children}

      {interactive && onUpdate && (
        <button
          data-no-drag
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          style={{
            position: "absolute",
            top: pt(-6), right: pt(-22),
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
            top: pt(20), right: pt(-22),
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

function TitleHero({ slide, theme, deckTitle, interactive, onUpdate, canvasRef }: any) {
  const title = slide.title || deckTitle;
  const sub = slide.subtitle || "";
  return (
    <>
      <Movable id="title" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
        baseStyle={{ position: "absolute", left: "8%", right: "8%", top: "38%", textAlign: "center" }}
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
          baseStyle={{ position: "absolute", left: "12%", right: "12%", top: "58%", textAlign: "center" }}
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
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const bulletText = (slide.bullets || []).join("\n");
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
        />
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function BulletList({
  interactive, theme, slide, fontSize, bullets, onCommit,
}: {
  interactive: boolean; theme: Theme; slide: Slide; fontSize: string;
  bullets: string[]; onCommit: (text: string) => void;
}) {
  return (
    <ul style={{
      margin: 0, padding: 0, listStyle: "none",
      fontSize, color: theme.fg, lineHeight: 1.5,
    }}>
      {bullets.map((b: string, i: number) => (
        <li key={i} style={{ marginBottom: pt(12), display: "flex", gap: pt(10) }}>
          <span style={{ color: theme.accent, fontWeight: 700 }}>•</span>
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

function TableLayout(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const t: TableData | undefined = slide.table;
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
            }}>
              <thead>
                <tr>
                  {t.headers.map((h, i) => (
                    <th key={i} style={{
                      textAlign: "left",
                      padding: `${pt(8)} ${pt(10)}`,
                      borderBottom: `1px solid ${theme.accent}`,
                      color: theme.accent, fontWeight: 700, whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 1 ? `${theme.accent}0d` : "transparent" }}>
                    {r.map((c, ci) => (
                      <td key={ci} style={{
                        padding: `${pt(7)} ${pt(10)}`,
                        borderBottom: `1px solid ${theme.muted}33`,
                      }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {t.source && (
              <div style={{
                marginTop: pt(8), fontSize: pt(10),
                color: theme.muted, fontStyle: "italic",
              }}>Source: {t.source}</div>
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

function Quote(props: any) {
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
          <EditableText
            value={quote}
            multiline
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ body: v })}
          />
        </div>
        {slide.subtitle && (
          <div style={{ marginTop: pt(14), fontSize: pt(16), color: theme.muted }}>
            — <EditableText
              value={slide.subtitle}
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ subtitle: v })}
            />
          </div>
        )}
      </Movable>
      <Footer theme={theme} deckTitle={deckTitle} idx={idx} total={total} />
    </>
  );
}

function Section({ slide, theme, interactive, onUpdate, canvasRef }: any) {
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
          <EditableText
            value={slide.title}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>
      {slide.body && (
        <Movable id="body" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "12%", right: "12%", top: "60%", textAlign: "center" }}
        >
          <div style={{ fontSize: pt(bodySize(slide)), color: textCol, opacity: 0.9 }}>
            <EditableText
              value={slide.body}
              multiline
              interactive={interactive}
              onCommit={(v) => onUpdate?.({ body: v })}
            />
          </div>
        </Movable>
      )}
    </div>
  );
}

function ReferencesLayout(props: any) {
  const { slide, theme, idx, total, deckTitle, interactive, onUpdate, canvasRef } = props;
  const refs: Reference[] = (slide.references as Reference[]) || [];
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
              <span>
                {r.text}
                {r.url && <span style={{ color: theme.muted }}> — {r.url}</span>}
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

function Closing({ slide, theme, interactive, onUpdate, canvasRef }: any) {
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
          <EditableText
            value={slide.title || "Thank you"}
            interactive={interactive}
            onCommit={(v) => onUpdate?.({ title: v })}
          />
        </div>
      </Movable>
      {slide.subtitle && (
        <Movable id="subtitle" slide={slide} theme={theme} interactive={interactive} onUpdate={onUpdate} canvasRef={canvasRef}
          baseStyle={{ position: "absolute", left: "12%", right: "12%", top: "60%", textAlign: "center" }}
        >
          <div style={{ fontSize: pt(18), color: theme.muted }}>
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

/* ----------------------------- Image overlay ------------------------------- */

function ImageLayer({
  slide, interactive, onUpdate, canvasRef, theme,
}: {
  slide: Slide; interactive: boolean; onUpdate?: SlideUpdater;
  canvasRef: React.RefObject<HTMLDivElement>; theme: Theme;
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
        />
      ))}
    </>
  );
}

function ImageBox({
  img, slide, interactive, onUpdate, canvasRef, theme,
}: {
  img: UploadedImage; slide: Slide; interactive: boolean;
  onUpdate?: SlideUpdater; canvasRef: React.RefObject<HTMLDivElement>; theme: Theme;
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
      onPointerDown={(e) => onPointerDown(e, "move")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        left: inches(img.x),
        top: inches(img.y),
        width: inches(img.w),
        height: inches(img.h),
        cursor: interactive ? "grab" : "default",
        outline: interactive && hover ? `2px solid ${theme.accent}` : "none",
        outlineOffset: pt(2),
        userSelect: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.dataUrl}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
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

function AnnotationLayer({ slide, theme }: { slide: Slide; theme: Theme }) {
  const anns = slide.annotations || [];
  if (anns.length === 0) return null;

  const PADDING_IN = 0.5;
  const groups: Record<string, Annotation[]> = {};
  for (const a of anns) (groups[a.anchor] ||= []).push(a);

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
            }}>
              {a.text}
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
