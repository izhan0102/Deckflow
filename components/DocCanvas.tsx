"use client";
import { useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, X, GripVertical, Image as ImageIcon } from "lucide-react";
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
          <BlockView b={b} t={t} base={base} heading={heading} editable={editable} onUpdate={onUpdate} onFocusBlock={onFocusBlock} />
        </BlockRow>
      ))}

      {editable && doc.blocks.length === 0 && (
        <p style={{ color: "#9ca3af", fontStyle: "italic" }}>Empty document — generate content or add a block.</p>
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
  if (!editable) return <div data-doc-block style={{ marginBottom: 12 }}>{children}</div>;
  return (
    <div className="doc-block" data-doc-block
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
function BlockView({ b, t, base, heading, editable, onUpdate, onFocusBlock }: {
  b: DocBlock; t: ExDoc["theme"]; base: number; heading: string; editable: boolean;
  onUpdate?: (id: string, patch: any) => void; onFocusBlock?: (id: string) => void;
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
      return <TableBlock b={b} t={t} editable={editable} onUpdate={onUpdate} onFocus={focus} base={base} fs={fs} />;
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
      return (
        <figure style={{ margin: 0, textAlign: b.align || "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.url} alt={b.caption || ""} style={{ width: `${b.width || 80}%`, borderRadius: 8, display: "inline-block" }} />
          {(b.caption || editable) && <Edit tag="figcaption" editable={editable} html={b.caption || ""} onFocus={focus} onCommit={(v) => onUpdate?.(b.id, { caption: v })} style={{ marginTop: 4, fontSize: base * 0.82, color: "#6b7280", textAlign: "center" }} ph="Caption (optional)" />}
        </figure>
      );
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

function TableBlock({ b, t, editable, onUpdate, onFocus, base, fs }: any) {
  const headers: string[] = b.headers; const rows: string[][] = b.rows;
  const setHeader = (c: number, v: string) => onUpdate?.(b.id, { headers: headers.map((x, i) => (i === c ? v : x)) });
  const setCell = (r: number, c: number, v: string) => onUpdate?.(b.id, { rows: rows.map((row, ri) => ri === r ? row.map((x, ci) => ci === c ? v : x) : row) });
  const addRow = () => onUpdate?.(b.id, { rows: [...rows, headers.map(() => "")] });
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs ?? base * 0.92 }}>
        <thead>
          <tr style={{ background: t.accent }}>
            {headers.map((h, c) => (
              <th key={c} style={{ border: "1px solid #e5e7eb", padding: "6px 9px", textAlign: "left", color: "#fff", fontWeight: 700 }}>
                <Edit tag="span" editable={editable} html={h} onFocus={onFocus} onCommit={(v) => setHeader(c, v)} style={{ display: "block", color: "#fff" }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} style={{ background: r % 2 ? `${t.accent}0c` : "transparent" }}>
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
    </div>
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
