"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, X, GripVertical, Image as ImageIcon, Move } from "lucide-react";
import type { ExDoc, DocBlock } from "@/lib/docTypes";
import { A4 } from "@/lib/docTypes";
import { getDocFont } from "@/lib/docFonts";
import { renderChartSvg } from "@/lib/charts";

/**
 * DocCanvas — renders an ExDoc onto a portrait A4 page with inline editing.
 * One render path is used for the editor and for PDF capture.
 */
export default function DocCanvas({
  doc, editable, scale = 1, print = false, innerRef,
  onUpdate, onMove, onDelete, onAddAfter, onTitle, onSubtitle, onFocusBlock, onReorder, onEditWatermark,
}: {
  doc: ExDoc;
  editable: boolean;
  scale?: number;
  print?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
  onUpdate?: (id: string, patch: Partial<DocBlock>) => void;
  onMove?: (id: string, dir: -1 | 1) => void;
  onDelete?: (id: string) => void;
  onAddAfter?: (id: string) => void;
  onTitle?: (v: string) => void;
  onSubtitle?: (v: string) => void;
  onFocusBlock?: (id: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
  onEditWatermark?: () => void;
}) {
  const t = doc.theme;
  const body = getDocFont(t.fontId).family;
  const heading = getDocFont(t.headingFontId || t.fontId).family;
  const base = 16 * t.fontScale;
  const pad = t.marginIn * A4.wPx / A4.wIn; // margin in px (relative to page width)

  type CtxItem = { label: string; danger?: boolean; onClick: () => void };
  const [ctx, setCtx] = useState<{ x: number; y: number; items: CtxItem[] } | null>(null);
  const openCtx = (e: React.MouseEvent, items: CtxItem[]) => {
    if (!editable) return;
    e.preventDefault(); e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, items });
  };

  return (
    <div
      ref={innerRef}
      data-doc-page
      style={{
        position: "relative", overflow: "hidden",
        width: A4.wPx, minHeight: A4.hPx, margin: "0 auto",
        background: t.bg, color: t.fg, fontFamily: body, fontSize: base, lineHeight: t.lineHeight,
        padding: pad, boxShadow: print ? "none" : "0 10px 40px rgba(0,0,0,0.18)", borderRadius: print ? 0 : 2,
        transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top center",
      }}
    >
      {patternBg(t.pattern, t.accent) && (
        <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, ...patternBg(t.pattern, t.accent)! }} />
      )}
      {t.watermark?.url && (
        <div aria-hidden style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          backgroundImage: `url(${t.watermark.url})`, backgroundRepeat: "repeat", backgroundPosition: "center",
          backgroundSize: `${t.watermark.size || 220}px`, opacity: t.watermark.opacity ?? 0.12,
        }} />
      )}

      {t.watermark?.url && editable && onEditWatermark && (
        <button onClick={onEditWatermark} title="Edit watermark"
          style={{ position: "absolute", top: 10, right: 10, zIndex: 5, display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-elev)", color: "var(--ezd-fg-muted)", fontSize: 11.5, cursor: "pointer" }}>
          <ImageIcon size={13} /> Watermark
        </button>
      )}

      <div style={{ position: "relative", zIndex: 1 }}>
      {t.cover && (
        <header data-doc-block style={{ marginBottom: base * 1.5, paddingBottom: base, borderBottom: `2px solid ${t.accent}` }}>
          <Edit tag="h1" editable={editable} html={doc.title} onCommit={(v) => onTitle?.(v)}
            style={{ fontFamily: heading, fontSize: base * 2.4, fontWeight: 800, lineHeight: 1.1, color: t.fg, margin: 0 }} ph="Document title" />
          {(doc.subtitle || editable) && (
            <Edit tag="p" editable={editable} html={doc.subtitle || ""} onCommit={(v) => onSubtitle?.(v)}
              style={{ marginTop: base * 0.5, fontSize: base * 1.05, color: t.accent, fontWeight: 600 }} ph="Subtitle (optional)" />
          )}
        </header>
      )}

      {doc.blocks.map((b) => (
        <BlockRow key={b.id} editable={editable} onMove={onMove} onDelete={onDelete} onAddAfter={onAddAfter} onReorder={onReorder} id={b.id}>
          <BlockView b={b} t={t} base={base} heading={heading} editable={editable} onUpdate={onUpdate} onFocusBlock={onFocusBlock} onDelete={onDelete} openCtx={openCtx} onReorder={onReorder} />
        </BlockRow>
      ))}

      {editable && doc.blocks.length === 0 && (
        <p style={{ color: "#9ca3af", fontStyle: "italic" }}>Empty document — generate content or add a block.</p>
      )}

      {ctx && (
        <>
          <div onClick={() => setCtx(null)} onContextMenu={(e) => { e.preventDefault(); setCtx(null); }} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
          <div style={{ position: "fixed", left: Math.min(ctx.x, (typeof window !== "undefined" ? window.innerWidth : 9999) - 180), top: ctx.y, zIndex: 1000, minWidth: 160, background: "var(--ezd-bg-elev)", border: "1px solid var(--ezd-divider)", borderRadius: 10, padding: 5, boxShadow: "0 12px 32px rgba(0,0,0,0.3)" }}>
            {ctx.items.map((it, i) => (
              <button key={i} onClick={() => { it.onClick(); setCtx(null); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", color: it.danger ? "#ef4444" : "var(--ezd-fg)" }}>
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

/** CSS background for a page pattern, tinted with the accent at low opacity. */
function patternBg(pattern: string, accent: string): React.CSSProperties | null {
  const a = (hex: string, alpha: string) => `${hex}${alpha}`;
  switch (pattern) {
    case "dots":
      return { backgroundImage: `radial-gradient(${a(accent, "22")} 1.2px, transparent 1.3px)`, backgroundSize: "18px 18px" };
    case "grid":
      return { backgroundImage: `linear-gradient(${a(accent, "14")} 1px, transparent 1px), linear-gradient(90deg, ${a(accent, "14")} 1px, transparent 1px)`, backgroundSize: "24px 24px" };
    case "lines":
      return { backgroundImage: `repeating-linear-gradient(0deg, ${a(accent, "0f")}, ${a(accent, "0f")} 1px, transparent 1px, transparent 28px)` };
    case "diagonal":
      return { backgroundImage: `repeating-linear-gradient(45deg, ${a(accent, "0e")}, ${a(accent, "0e")} 1px, transparent 1px, transparent 14px)` };
    default:
      return null;
  }
}

/* hover rail with block controls + drag-to-reorder */
function BlockRow({ id, editable, children, onMove, onDelete, onAddAfter, onReorder }: {
  id: string; editable: boolean; children: React.ReactNode;
  onMove?: (id: string, d: -1 | 1) => void; onDelete?: (id: string) => void; onAddAfter?: (id: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
}) {
  const [over, setOver] = useState(false);
  if (!editable) return <div data-doc-block data-block-id={id} style={{ marginBottom: 12 }}>{children}</div>;
  return (
    <div className="doc-block" data-doc-block data-block-id={id}
      onDragOver={(e) => { if (onReorder) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); const from = e.dataTransfer.getData("text/doc-block"); if (from && from !== id) onReorder?.(from, id); }}
      style={{ position: "relative", marginBottom: 12, borderTop: over ? "2px solid var(--ezd-accent, #7C5CFF)" : "2px solid transparent" }}>
      <div className="doc-rail" style={{ position: "absolute", left: -42, top: 0, display: "flex", flexDirection: "column", gap: 2, opacity: 0, transition: "opacity .15s" }}>
        <button title="Drag to reorder" draggable onDragStart={(e) => { e.dataTransfer.setData("text/doc-block", id); e.dataTransfer.effectAllowed = "move"; }}
          style={{ width: 24, height: 22, display: "grid", placeItems: "center", borderRadius: 5, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)", cursor: "grab" }}><GripVertical size={13} /></button>
        <RailBtn onClick={() => onMove?.(id, -1)}><ChevronUp size={13} /></RailBtn>
        <RailBtn onClick={() => onMove?.(id, 1)}><ChevronDown size={13} /></RailBtn>
        <RailBtn onClick={() => onAddAfter?.(id)}><Plus size={13} /></RailBtn>
        <RailBtn onClick={() => onDelete?.(id)} danger><Trash2 size={12} /></RailBtn>
      </div>
      {children}
      <style>{`.doc-block:hover .doc-rail{opacity:1}`}</style>
    </div>
  );
}
function RailBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onMouseDown={(e) => e.preventDefault()} onClick={onClick}
    style={{ width: 24, height: 22, display: "grid", placeItems: "center", borderRadius: 5, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-card)", color: danger ? "#ef4444" : "var(--ezd-fg-muted)", cursor: "pointer" }}>{children}</button>;
}

/* per-block rendering */
function BlockView({ b, t, base, heading, editable, onUpdate, onFocusBlock, onDelete, openCtx, onReorder }: {
  b: DocBlock; t: ExDoc["theme"]; base: number; heading: string; editable: boolean;
  onUpdate?: (id: string, patch: any) => void; onFocusBlock?: (id: string) => void;
  onDelete?: (id: string) => void;
  openCtx?: (e: React.MouseEvent, items: { label: string; danger?: boolean; onClick: () => void }[]) => void;
  onReorder?: (fromId: string, toId: string) => void;
}) {
  const focus = () => onFocusBlock?.(b.id);
  const fs = (b as any).fontSize as number | undefined;
  const align = (a?: string): React.CSSProperties => ({ textAlign: (a as any) || (t.justify && b.type === "paragraph" ? "justify" : "left") });

  switch (b.type) {
    case "heading":
      return <Edit tag={b.level === 3 ? "h3" : "h2"} editable={editable} html={b.text} onFocus={focus}
        onCommit={(v) => onUpdate?.(b.id, { text: v })}
        style={{ fontFamily: heading, fontWeight: 700, color: t.fg, margin: `${base * 0.6}px 0 ${base * 0.2}px`, fontSize: fs ?? (b.level === 3 ? base * 1.2 : base * 1.5), ...align(b.align) }} />;
    case "paragraph":
      return <Edit tag="p" editable={editable} html={b.text} onFocus={focus} onCommit={(v) => onUpdate?.(b.id, { text: v })} style={{ margin: 0, ...(fs ? { fontSize: fs } : {}), ...align(b.align) }} ph="Paragraph…" />;
    case "bullets":
    case "numbered":
      return <ListBlock b={b} editable={editable} onUpdate={onUpdate} onFocus={focus} base={base} fs={fs} />;
    case "table":
      return <TableBlock b={b} t={t} editable={editable} onUpdate={onUpdate} onFocus={focus} base={base} fs={fs} onDelete={onDelete} openCtx={openCtx} onReorder={onReorder} />;
    case "quote":
      return (
        <blockquote style={{ margin: 0, paddingLeft: base, borderLeft: `3px solid ${t.accent}`, fontStyle: "italic", color: "#374151", ...(fs ? { fontSize: fs } : {}) }}>
          <Edit tag="div" editable={editable} html={b.text} onFocus={focus} onCommit={(v) => onUpdate?.(b.id, { text: v })} style={{}} />
          {(b.cite || editable) && <Edit tag="div" editable={editable} html={b.cite || ""} onFocus={focus} onCommit={(v) => onUpdate?.(b.id, { cite: v })} style={{ marginTop: 4, fontStyle: "normal", fontSize: base * 0.85, color: t.accent }} ph="— citation" />}
        </blockquote>
      );
    case "callout": {
      const tones: Record<string, string> = { info: "#2563eb", success: "#10b981", warning: "#d97706", neutral: "#6b7280" };
      const c = tones[b.tone] || tones.info;
      return (
        <div style={{ background: `${c}14`, borderLeft: `4px solid ${c}`, borderRadius: 8, padding: `${base * 0.6}px ${base * 0.8}px`, ...(fs ? { fontSize: fs } : {}) }}>
          <Edit tag="div" editable={editable} html={b.text} onFocus={focus} onCommit={(v) => onUpdate?.(b.id, { text: v })} style={{}} />
        </div>
      );
    }
    case "chart": {
      const svg = renderChartSvg(b.chart, { bg: t.bg, fg: t.fg, accent: t.accent, muted: "#9ca3af", font: "sans" } as any);
      return (
        <figure style={{ margin: 0, textAlign: "center" }}>
          <div style={{ width: "78%", display: "inline-block" }} dangerouslySetInnerHTML={{ __html: svg }} />
          {(b.caption || editable) && <Edit tag="figcaption" editable={editable} html={b.caption || ""} onFocus={focus} onCommit={(v) => onUpdate?.(b.id, { caption: v })} style={{ marginTop: 4, fontSize: base * 0.82, color: "#6b7280", textAlign: "center" }} ph="Chart caption (optional)" />}
        </figure>
      );
    }
    case "image":
      return <ImageBlock b={b} t={t} base={base} editable={editable} onUpdate={onUpdate} onFocus={focus} onDelete={onDelete} openCtx={openCtx} onReorder={onReorder} />;
    case "divider":
      return <hr style={{ border: "none", borderTop: `1px solid #d1d5db`, margin: `${base * 0.4}px 0` }} />;
    default:
      return null;
  }
}

function ListBlock({ b, editable, onUpdate, onFocus, base, fs }: any) {
  const Tag = b.type === "numbered" ? "ol" : "ul";
  const items: string[] = b.items;
  const setItem = (i: number, v: string) => onUpdate?.(b.id, { items: items.map((x, idx) => (idx === i ? v : x)) });
  const removeItem = (i: number) => onUpdate?.(b.id, { items: items.filter((_: any, idx: number) => idx !== i) });
  return (
    <Tag style={{ margin: 0, paddingLeft: base * 1.4, ...(fs ? { fontSize: fs } : {}) }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: 3, position: "relative" }}>
          <Edit tag="span" editable={editable} html={it} onFocus={onFocus} onCommit={(v) => setItem(i, v)} style={{ display: "inline-block", width: "100%" }} ph="List item" />
          {editable && <button onMouseDown={(e) => e.preventDefault()} onClick={() => removeItem(i)} style={{ position: "absolute", right: -2, top: 0, color: "#ef4444", background: "none", border: "none", cursor: "pointer", opacity: 0.5 }}><X size={12} /></button>}
        </li>
      ))}
      {editable && <li style={{ listStyle: "none", marginLeft: -base * 0.6 }}><button onMouseDown={(e) => e.preventDefault()} onClick={() => onUpdate?.(b.id, { items: [...items, ""] })} style={{ fontSize: base * 0.8, color: "var(--ezd-accent, #7C5CFF)", background: "none", border: "none", cursor: "pointer" }}>+ item</button></li>}
    </Tag>
  );
}

function TableBlock({ b, t, editable, onUpdate, onFocus, base, fs, onDelete, openCtx, onReorder }: any) {
  const headers: string[] = b.headers; const rows: string[][] = b.rows;
  const setHeader = (c: number, v: string) => onUpdate?.(b.id, { headers: headers.map((x, i) => (i === c ? v : x)) });
  const setCell = (r: number, c: number, v: string) => onUpdate?.(b.id, { rows: rows.map((row, ri) => ri === r ? row.map((x, ci) => ci === c ? v : x) : row) });
  const addRow = () => onUpdate?.(b.id, { rows: [...rows, headers.map(() => "")] });
  const delRow = (r: number) => onUpdate?.(b.id, { rows: rows.filter((_, i) => i !== r) });
  const delCol = (c: number) => onUpdate?.(b.id, { headers: headers.filter((_, i) => i !== c), rows: rows.map((row) => row.filter((_, i) => i !== c)) });
  const rowMenu = (r: number) => [
    { label: "Delete row", danger: true, onClick: () => delRow(r) },
    { label: "Delete table", danger: true, onClick: () => onDelete?.(b.id) },
  ];
  const colMenu = (c: number) => [
    { label: "Delete column", danger: true, onClick: () => delCol(c) },
    { label: "Delete table", danger: true, onClick: () => onDelete?.(b.id) },
  ];
  return (
    <PositionedBlock t={t} editable={editable} widthPct={b.width || 100} offsetX={b.offsetX} gap={b.gap != null ? b.gap : 10} defaultFull onCommit={(p) => onUpdate?.(b.id, p)} onFocus={onFocus} blockId={b.id} onReorder={onReorder}>
      {() => (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs ?? base * 0.92 }}>
            <thead>
              <tr style={{ background: t.accent }}>
                {headers.map((h, c) => (
                  <th key={c} onContextMenu={(e) => openCtx?.(e, colMenu(c))} style={{ border: "1px solid #e5e7eb", padding: "6px 9px", textAlign: "left", color: "#fff", fontWeight: 700 }}>
                    <Edit tag="span" editable={editable} html={h} onFocus={onFocus} onCommit={(v) => setHeader(c, v)} style={{ display: "block", color: "#fff" }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} onContextMenu={(e) => openCtx?.(e, rowMenu(r))} style={{ background: r % 2 ? `${t.accent}0c` : "transparent" }}>
                  {row.map((cell, c) => (
                    <td key={c} style={{ border: "1px solid #e5e7eb", padding: "6px 9px", verticalAlign: "top" }}>
                      <Edit tag="span" editable={editable} html={cell} onFocus={onFocus} onCommit={(v) => setCell(r, c, v)} style={{ display: "block" }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {editable && <button onMouseDown={(e) => e.preventDefault()} onClick={addRow} style={{ marginTop: 4, fontSize: base * 0.8, color: "var(--ezd-accent, #7C5CFF)", background: "none", border: "none", cursor: "pointer" }}>+ row</button>}
        </>
      )}
    </PositionedBlock>
  );
}

/* Shared horizontal-drag + resize wrapper. A subtle grip moves the block
   left/right anywhere on the page; a corner handle resizes its width. Text
   above/below flows normally (block layout), with space (gap) around it. */
function PositionedBlock({ t, editable, widthPct, offsetX, gap, defaultFull, onCommit, onFocus, blockId, onReorder, children }: {
  t: ExDoc["theme"]; editable: boolean; widthPct: number; offsetX?: number; gap: number; defaultFull?: boolean;
  onCommit: (patch: { offsetX: number; width: number }) => void; onFocus?: () => void;
  blockId?: string; onReorder?: (fromId: string, toId: string) => void;
  children: (moveProps: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties }) => React.ReactNode;
}) {
  const pad = (t.marginIn * A4.wPx) / A4.wIn;
  const contentW = A4.wPx - pad * 2;
  const wpct = Math.max(20, Math.min(100, widthPct || (defaultFull ? 100 : 80)));
  const baseW = (wpct / 100) * contentW;
  const maxOffset = Math.max(0, contentW - baseW);
  const baseLeft = offsetX != null ? Math.max(0, Math.min(maxOffset, offsetX)) : (wpct >= 100 ? 0 : maxOffset / 2);

  const [tmp, setTmp] = useState<{ left: number; width: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number; left: number; width: number; mode: "move" | "resize" } | null>(null);
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const left = tmp ? tmp.left : baseLeft;
  const w = tmp ? tmp.width : baseW;
  const dy = tmp ? tmp.dy : 0;

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const s = startRef.current; if (!s) return;
      lastPos.current = { x: e.clientX, y: e.clientY };
      if (s.mode === "move") {
        const nl = Math.max(0, Math.min(contentW - s.width, s.left + (e.clientX - s.x)));
        setTmp({ left: nl, width: s.width, dy: e.clientY - s.y });
      } else {
        const nw = Math.max(0.2 * contentW, Math.min(contentW, s.width + (e.clientX - s.x)));
        const nl = Math.max(0, Math.min(contentW - nw, s.left));
        setTmp({ left: nl, width: nw, dy: 0 });
      }
    };
    const up = () => {
      const cur = startRef.current;
      // Vertical drag → reorder this block to wherever it was dropped.
      if (cur?.mode === "move" && blockId && onReorder) {
        try {
          const target = (document.elementFromPoint(lastPos.current.x, lastPos.current.y) as HTMLElement | null)?.closest?.("[data-block-id]") as HTMLElement | null;
          const toId = target?.getAttribute("data-block-id");
          if (toId && toId !== blockId) onReorder(blockId, toId);
        } catch { /* ignore */ }
      }
      setTmp((d) => { if (d && cur) onCommit({ offsetX: Math.round(d.left), width: Math.round((d.width / contentW) * 100) }); return null; });
      startRef.current = null; setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const down = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (!editable) return;
    e.preventDefault(); e.stopPropagation();
    startRef.current = { x: e.clientX, y: e.clientY, left, width: w, mode };
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTmp({ left, width: w, dy: 0 }); setDragging(true); onFocus?.();
  };

  return (
    <div className="doc-pos" style={{ margin: `${gap}px 0`, width: "100%", position: "relative" }}>
      <div style={{ position: "relative", marginLeft: left, width: w, transform: dy ? `translateY(${dy}px)` : undefined, zIndex: dragging ? 50 : undefined, opacity: dragging && dy ? 0.85 : 1, transition: dragging ? "none" : "transform .12s" }}>
        {editable && (
          <div onPointerDown={down("move")} title="Drag to move"
            style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", zIndex: 4, display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: t.accent, color: "#fff", fontSize: 10.5, fontWeight: 600, cursor: dragging ? "grabbing" : "grab", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", touchAction: "none", opacity: 0, transition: "opacity .15s", userSelect: "none" }}>
            <Move size={11} /> drag
          </div>
        )}
        {children({ onPointerDown: editable ? down("move") : () => {}, style: { cursor: editable ? (dragging ? "grabbing" : "grab") : "default" } })}
        {editable && (
          <div onPointerDown={down("resize")} title="Drag to resize"
            style={{ position: "absolute", right: -7, bottom: -7, zIndex: 4, width: 16, height: 16, borderRadius: 5, background: t.accent, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)", cursor: "nwse-resize", touchAction: "none" }} />
        )}
      </div>
      {editable && <style>{`.doc-pos:hover > div > div[title="Drag to move"]{opacity:1 !important}`}</style>}
    </div>
  );
}

/* draggable + resizable image */
function ImageBlock({ b, t, base, editable, onUpdate, onFocus, onDelete, openCtx, onReorder }: {
  b: any; t: ExDoc["theme"]; base: number; editable: boolean;
  onUpdate?: (id: string, patch: any) => void; onFocus?: () => void; onDelete?: (id: string) => void;
  openCtx?: (e: React.MouseEvent, items: { label: string; danger?: boolean; onClick: () => void }[]) => void;
  onReorder?: (fromId: string, toId: string) => void;
}) {
  const opacity = b.opacity != null ? b.opacity : 1;
  const ctxItems = [
    { label: "Opacity 100%", onClick: () => onUpdate?.(b.id, { opacity: 1 }) },
    { label: "Opacity 75%", onClick: () => onUpdate?.(b.id, { opacity: 0.75 }) },
    { label: "Opacity 50%", onClick: () => onUpdate?.(b.id, { opacity: 0.5 }) },
    { label: "Opacity 25%", onClick: () => onUpdate?.(b.id, { opacity: 0.25 }) },
    { label: "Delete image", danger: true, onClick: () => onDelete?.(b.id) },
  ];
  return (
    <PositionedBlock t={t} editable={editable} widthPct={b.width || 60} offsetX={b.offsetX} gap={b.gap != null ? b.gap : 12}
      onCommit={(p) => onUpdate?.(b.id, p)} onFocus={onFocus} blockId={b.id} onReorder={onReorder}>
      {(mv) => (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.url} alt={b.caption || ""} draggable={false}
            onPointerDown={mv.onPointerDown}
            onContextMenu={(e) => openCtx?.(e, ctxItems)}
            style={{ width: "100%", borderRadius: 8, display: "block", userSelect: "none", opacity, ...mv.style,
              outline: editable ? "1px dashed rgba(124,92,255,0.45)" : "none", outlineOffset: 2 }} />
          {(b.caption || editable) && (
            <Edit tag="figcaption" editable={editable} html={b.caption || ""} onFocus={onFocus} onCommit={(v) => onUpdate?.(b.id, { caption: v })}
              style={{ marginTop: 6, fontSize: base * 0.82, color: "#6b7280", textAlign: "center" }} ph="Caption (optional)" />
          )}
        </>
      )}
    </PositionedBlock>
  );
}

/* contentEditable wrapper that commits HTML on blur */
function Edit({ tag, html, onCommit, onFocus, editable, style, ph }: {
  tag: keyof JSX.IntrinsicElements; html: string; onCommit: (v: string) => void; onFocus?: () => void;
  editable: boolean; style: React.CSSProperties; ph?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const Tag = tag as any;
  if (!editable) return <Tag style={style} dangerouslySetInnerHTML={{ __html: html || "" }} />;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={onFocus}
      onBlur={() => onCommit((ref.current as HTMLElement)?.innerHTML || "")}
      data-ph={ph}
      style={{ outline: "none", ...style }}
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
}
