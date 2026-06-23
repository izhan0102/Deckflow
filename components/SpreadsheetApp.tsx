"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Trash2, Loader2, Send, Sparkles, AlertTriangle, Check,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Baseline, PaintBucket, Eraser,
  DollarSign, Percent, Hash, Pin, Maximize2, Minimize2, FileSpreadsheet, FileText,
  X as XIcon,
} from "lucide-react";
import { type Sheet, type CellFormat, emptySheet, evaluateSheet, colName, cellRef, parseRef, formatDisplay, normColor, condStyleFor } from "@/lib/sheet";
import { applyOps, type SheetOp } from "@/lib/sheetOps";
import { exportXlsx, exportSheetPdf } from "@/lib/sheetExport";
import { downloadBlob } from "@/lib/convert";
import { getIdToken, onAuthStateChange } from "@/lib/auth";
import SheetChart from "@/components/SheetChart";

type ChatMsg = { role: "user" | "assistant"; content: string };

const ROW_H = 28, HEADER_H = 28, GUTTER_W = 42, COL_W = 110;

export default function SpreadsheetApp() {
  const [sheet, setSheet] = useState<Sheet>(() => emptySheet(8, 20));
  const [focus, setFocus] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [anchor, setAnchor] = useState("A1");
  const [lead, setLead] = useState("A1");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [notice, setNotice] = useState<{ type: "ok" | "error" | "info"; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isFull, setIsFull] = useState(false);

  const [panel, setPanel] = useState<"assistant" | null>(null);

  const noticeTimer = useRef<number | null>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const evaluated = useMemo(() => evaluateSheet(sheet), [sheet]);

  useEffect(() => { const u = onAuthStateChange((x) => { setSignedIn(!!x); setAuthReady(true); }); return () => u(); }, []);
  useEffect(() => { if (authReady && !signedIn) router.replace(`/auth?redirect=${encodeURIComponent("/spreadsheet")}`); }, [authReady, signedIn, router]);
  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);
  useEffect(() => {
    const onFs = () => setIsFull(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => { document.removeEventListener("fullscreenchange", onFs); document.removeEventListener("webkitfullscreenchange", onFs); };
  }, []);

  const showNotice = (type: "ok" | "error" | "info", text: string) => {
    setNotice({ type, text });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), type === "ok" ? 2600 : 5000);
  };

  /* selection */
  const selRect = useMemo(() => {
    const a = parseRef(anchor) || { c: 0, r: 0 };
    const l = parseRef(lead) || a;
    return { c0: Math.min(a.c, l.c), c1: Math.max(a.c, l.c), r0: Math.min(a.r, l.r), r1: Math.max(a.r, l.r) };
  }, [anchor, lead]);
  const inSel = (c: number, r: number) => c >= selRect.c0 && c <= selRect.c1 && r >= selRect.r0 && r <= selRect.r1;
  const selRange = () => `${cellRef(selRect.c0, selRect.r0)}:${cellRef(selRect.c1, selRect.r1)}`;
  const frozenRows = sheet.frozen?.rows ?? 0;
  const frozenCols = sheet.frozen?.cols ?? 0;

  /* editing */
  const commit = (ref: string, value: string) => setSheet((s) => { const cells = { ...s.cells }; if (value === "") delete cells[ref]; else cells[ref] = value; return { ...s, cells }; });
  const focusCell = (ref: string) => { const el = document.querySelector<HTMLInputElement>(`input[data-cell="${ref}"]`); el?.focus(); el?.select(); };
  const onCellKey = (e: React.KeyboardEvent<HTMLInputElement>, c: number, r: number) => {
    if (e.key === "Enter") { e.preventDefault(); commit(cellRef(c, r), draft); (e.target as HTMLInputElement).blur(); if (r + 1 < sheet.rows) setTimeout(() => focusCell(cellRef(c, r + 1)), 0); }
    else if (e.key === "Escape") { e.preventDefault(); setDraft(sheet.cells[cellRef(c, r)] ?? ""); (e.target as HTMLInputElement).blur(); }
    else if (e.key === "Tab") { e.preventDefault(); commit(cellRef(c, r), draft); const nc = c + 1 < sheet.cols ? c + 1 : 0; const nr = c + 1 < sheet.cols ? r : r + 1; setTimeout(() => focusCell(cellRef(nc, nr)), 0); }
  };

  /* structural + format helpers */
  const apply = (ops: SheetOp[]) => setSheet((s) => applyOps(s, ops));
  const addRow = () => setSheet((s) => ({ ...s, rows: Math.min(2000, s.rows + 1) }));
  const addCol = () => setSheet((s) => ({ ...s, cols: Math.min(60, s.cols + 1) }));
  const clearAll = () => { setSheet(emptySheet(8, 20)); setConfirmClear(false); showNotice("ok", "Cleared the sheet."); };
  const freeze = (rows?: number, cols?: number) => apply([{ op: "freeze", rows, cols }]);
  const removeChart = (id: string) => setSheet((s) => ({ ...s, charts: (s.charts || []).filter((x) => x.id !== id) }));
  const allHave = (key: keyof CellFormat) => {
    for (let c = selRect.c0; c <= selRect.c1; c++) for (let r = selRect.r0; r <= selRect.r1; r++) if (!sheet.formats?.[cellRef(c, r)]?.[key]) return false;
    return true;
  };
  const toggle = (which: "bold" | "italic" | "underline") => apply([{ op: "format", range: selRange(), [which]: !allHave((which === "bold" ? "b" : which === "italic" ? "i" : "u") as keyof CellFormat) } as any]);
  const setAlign = (align: "left" | "center" | "right") => apply([{ op: "format", range: selRange(), align }]);
  const setColor = (color: string) => apply([{ op: "format", range: selRange(), color }]);
  const setBg = (bg: string) => apply([{ op: "format", range: selRange(), bg }]);
  const setNum = (numFmt: CellFormat["numFmt"], currency?: string) => apply([{ op: "format", range: selRange(), numFmt, ...(currency ? { currency } : {}) }]);
  const clearFmt = () => apply([{ op: "clearFormat", range: selRange() }]);

  /* export */
  const dlXlsx = async () => { try { const r = await exportXlsx(sheet, evaluated, "spreadsheet.xlsx"); downloadBlob(r.blob, r.filename); } catch { showNotice("error", "Couldn't export the .xlsx."); } };
  const dlPdf = async () => { try { const r = await exportSheetPdf(sheet, evaluated, "spreadsheet.pdf"); downloadBlob(r.blob, r.filename); } catch { showNotice("error", "Couldn't export the PDF."); } };

  /* fullscreen */
  const toggleFull = () => {
    const el = rootRef.current; if (!el) return;
    const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fs) { const ex = (document as any).exitFullscreen || (document as any).webkitExitFullscreen; try { ex?.call(document); } catch {} }
    else { const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen; if (req) { try { const p = req.call(el); if (p?.catch) p.catch(() => {}); } catch {} } }
  };

  /* AI builder (natural language → ops, with chunked continuation) */
  const send = async () => {
    const text = aiInput.trim();
    if (!text || aiBusy) return;
    setAiBusy(true);
    try {
      if (authReady && !signedIn) { showNotice("error", "Sign in to use the AI."); setAiBusy(false); return; }
      const token = await getIdToken().catch(() => null);
      if (!token) { showNotice("error", "Finishing sign-in — try again in a second."); setAiBusy(false); return; }
      let working = sheet, instr = text, more = true, guard = 0, lastMsg = "";
      while (more && guard < 8) {
        guard++;
        const res = await fetch("/api/sheet-ai", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ cols: working.cols, rows: working.rows, cells: working.cells, instruction: instr, messages: history }) });
        const d = await res.json().catch(() => ({}));
        if (d?.clarify) { setHistory((h) => [...h, { role: "user" as const, content: text }, { role: "assistant" as const, content: d.clarify }].slice(-12)); setPanel("assistant"); setAiInput(""); setAiBusy(false); return; }
        if (!res.ok || d?.error) { if (guard === 1) { showNotice("error", d?.error || "The AI couldn't do that."); setAiBusy(false); return; } break; }
        working = applyOps(working, Array.isArray(d.ops) ? d.ops : []);
        lastMsg = d.message || lastMsg;
        more = !!d.continue;
        if (more) { setSheet(working); showNotice("info", `Working… (part ${guard})`); instr = "Continue the SAME task from where you left off using the updated sheet. Don't repeat applied ops. Set continue:false when fully done."; }
      }
      setSheet(working);
      setAiInput("");
      setHistory((h) => [...h, { role: "user" as const, content: text }, { role: "assistant" as const, content: lastMsg || "Done." }].slice(-12));
      showNotice("ok", lastMsg || "Done.");
    } catch (e: any) { showNotice("error", e?.message || "Something went wrong."); }
    finally { setAiBusy(false); }
  };

  /* ------------------------------- gate ------------------------------- */
  if (!authReady || !signedIn) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div>
          <p className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{authReady ? "Sign in to use the AI Spreadsheet" : "Loading…"}</p>
          {authReady && <Link href={`/auth?redirect=${encodeURIComponent("/spreadsheet")}`} className="mt-4 inline-flex rounded-xl px-5 py-2.5 text-[14px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>Sign in</Link>}
        </div>
      </div>
    );
  }

  const TBtn = ({ onClick, title, on, children }: { onClick: () => void; title: string; on?: boolean; children: React.ReactNode }) => (
    <button onClick={onClick} title={title} className="grid h-8 w-8 place-items-center rounded-lg border transition hover:opacity-80" style={{ borderColor: "var(--ezd-divider)", color: on ? "var(--ezd-fg-strong)" : "var(--ezd-fg-muted)", background: on ? "var(--ezd-bg-hover)" : "transparent" }}>{children}</button>
  );
  const PillBtn = ({ onClick, title, children, primary }: { onClick: () => void; title?: string; children: React.ReactNode; primary?: boolean }) => (
    <button onClick={onClick} title={title} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium" style={primary ? { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)", borderColor: "transparent" } : { borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>{children}</button>
  );

  return (
    <div ref={rootRef} className="relative" style={isFull ? { background: "var(--ezd-bg-page)", padding: 20, overflow: "auto", height: "100%" } : undefined}>
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <PillBtn onClick={addRow} title="Add row"><Plus size={13} /> Row</PillBtn>
        <PillBtn onClick={addCol} title="Add column"><Plus size={13} /> Column</PillBtn>
        <PillBtn onClick={() => setConfirmClear(true)} title="Clear sheet"><Trash2 size={13} /> Clear</PillBtn>
        <span className="mx-1 h-5 w-px" style={{ background: "var(--ezd-divider)" }} />
        <TBtn onClick={() => toggle("bold")} title="Bold"><Bold size={15} /></TBtn>
        <TBtn onClick={() => toggle("italic")} title="Italic"><Italic size={15} /></TBtn>
        <TBtn onClick={() => toggle("underline")} title="Underline"><Underline size={15} /></TBtn>
        <TBtn onClick={() => setAlign("left")} title="Align left"><AlignLeft size={15} /></TBtn>
        <TBtn onClick={() => setAlign("center")} title="Align center"><AlignCenter size={15} /></TBtn>
        <TBtn onClick={() => setAlign("right")} title="Align right"><AlignRight size={15} /></TBtn>
        <TBtn onClick={() => colorRef.current?.click()} title="Text color"><Baseline size={15} /></TBtn>
        <TBtn onClick={() => bgRef.current?.click()} title="Fill color"><PaintBucket size={15} /></TBtn>
        <TBtn onClick={() => setNum("currency", "$")} title="Currency"><DollarSign size={15} /></TBtn>
        <TBtn onClick={() => setNum("percent")} title="Percent"><Percent size={15} /></TBtn>
        <TBtn onClick={() => setNum("comma")} title="Thousands"><Hash size={15} /></TBtn>
        <TBtn onClick={clearFmt} title="Clear formatting"><Eraser size={15} /></TBtn>
        <input ref={colorRef} type="color" className="hidden" onChange={(e) => setColor(e.target.value)} />
        <input ref={bgRef} type="color" className="hidden" onChange={(e) => setBg(e.target.value)} />
        <span className="flex-1" />
        <PillBtn onClick={() => setPanel((p) => (p === "assistant" ? null : "assistant"))} title="AI assistant chat"><Sparkles size={13} /> Assistant</PillBtn>
        <PillBtn onClick={() => freeze(frozenRows > 0 ? 0 : 1, 0)} title={frozenRows > 0 ? "Unfreeze" : "Freeze top row"}><Pin size={13} /> {frozenRows > 0 ? "Frozen" : "Freeze"}</PillBtn>
        <PillBtn onClick={toggleFull} title="Full screen">{isFull ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {isFull ? "Exit" : "Full screen"}</PillBtn>
        <PillBtn onClick={dlXlsx} primary><FileSpreadsheet size={14} /> Excel</PillBtn>
        <PillBtn onClick={dlPdf}><FileText size={14} /> PDF</PillBtn>
      </div>

      {/* formula bar */}
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-8 min-w-[42px] place-items-center rounded-md border px-2 text-[12px] font-semibold" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>{anchor}</span>
        <input value={sheet.cells[anchor] ?? ""} onChange={(e) => commit(anchor, e.target.value)} placeholder="Cell content or formula (e.g. =SUM(B2:B10))" spellCheck={false} className="h-8 flex-1 rounded-md border bg-transparent px-2.5 text-[12.5px] outline-none" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)" }} />
      </div>

      <div className="flex gap-3">
        {/* grid */}
        <div className="min-w-0 flex-1 overflow-auto rounded-xl border" style={{ borderColor: "var(--ezd-divider)", maxHeight: isFull ? "82vh" : "58vh" }}>
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30" style={{ width: GUTTER_W, minWidth: GUTTER_W, background: "var(--ezd-bg-elev)", borderRight: "1px solid var(--ezd-divider)", borderBottom: "1px solid var(--ezd-divider)" }} />
                {Array.from({ length: sheet.cols }, (_, c) => (
                  <th key={c} className="sticky top-0 px-2 py-1 text-[11px] font-semibold" style={{ width: COL_W, minWidth: COL_W, background: "var(--ezd-bg-elev)", color: "var(--ezd-fg-muted)", borderRight: c === frozenCols - 1 ? "2px solid var(--ezd-fg-muted)" : "1px solid var(--ezd-divider)", borderBottom: "1px solid var(--ezd-divider)", ...(c < frozenCols ? { position: "sticky" as const, left: GUTTER_W + c * COL_W, zIndex: 22 } : { zIndex: 10 }) }}>{colName(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sheet.rows }, (_, r) => (
                <tr key={r}>
                  <td className="sticky left-0 text-center text-[11px]" style={{ width: GUTTER_W, minWidth: GUTTER_W, background: "var(--ezd-bg-elev)", color: "var(--ezd-fg-quiet)", borderRight: "1px solid var(--ezd-divider)", borderBottom: r === frozenRows - 1 ? "2px solid var(--ezd-fg-muted)" : "1px solid var(--ezd-divider)", ...(r < frozenRows ? { position: "sticky" as const, top: HEADER_H + r * ROW_H, zIndex: 16 } : { zIndex: 12 }) }}>{r + 1}</td>
                  {Array.from({ length: sheet.cols }, (_, c) => {
                    const ref = cellRef(c, r);
                    const focused = focus === ref;
                    const fmt = sheet.formats?.[ref] || {};
                    const disp = evaluated[ref] ?? "";
                    const isErr = disp.startsWith("#");
                    const numeric = /^-?\d/.test(disp) && !isErr;
                    const selected = inSel(c, r);
                    const cs = condStyleFor(ref, disp, sheet.condRules);
                    const rowSticky = r < frozenRows, colSticky = c < frozenCols;
                    const tdStyle: React.CSSProperties = {
                      padding: 0,
                      borderRight: c === frozenCols - 1 ? "2px solid var(--ezd-fg-muted)" : "1px solid var(--ezd-divider)",
                      borderBottom: r === frozenRows - 1 ? "2px solid var(--ezd-fg-muted)" : "1px solid var(--ezd-divider)",
                      background: cs.bg || fmt.bg || ((rowSticky || colSticky) ? "var(--ezd-bg-elev)" : (selected && !focused ? "var(--ezd-bg-hover)" : "transparent")),
                      ...((rowSticky || colSticky) ? { position: "sticky" as const } : {}),
                      ...(colSticky ? { left: GUTTER_W + c * COL_W } : {}),
                      ...(rowSticky ? { top: HEADER_H + r * ROW_H } : {}),
                      ...((rowSticky || colSticky) ? { zIndex: rowSticky && colSticky ? 8 : 4 } : {}),
                    };
                    return (
                      <td key={c} onMouseDown={(e) => { if (e.shiftKey) { e.preventDefault(); setLead(ref); } }} style={tdStyle}>
                        <input
                          data-cell={ref}
                          value={focused ? draft : formatDisplay(disp, fmt)}
                          onChange={(e) => setDraft(e.target.value)}
                          onFocus={() => { setFocus(ref); setDraft(sheet.cells[ref] ?? ""); setAnchor(ref); setLead(ref); }}
                          onBlur={() => { commit(ref, draft); setFocus(null); }}
                          onKeyDown={(e) => onCellKey(e, c, r)}
                          className="h-7 w-full px-2 text-[12.5px] outline-none"
                          style={{ width: COL_W, background: "transparent", color: isErr ? "#ef4444" : (cs.color || fmt.color || "var(--ezd-fg-strong)"), fontWeight: fmt.b ? 700 : 400, fontStyle: fmt.i ? "italic" : "normal", textDecoration: fmt.u ? "underline" : "none", textAlign: fmt.align || (!focused && numeric ? "right" : "left"), boxShadow: focused ? "inset 0 0 0 2px var(--ezd-fg-strong)" : (selected ? "inset 0 0 0 1px var(--ezd-fg-muted)" : "none") }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Analyse chat sidebar */}
        {panel === "assistant" && (
          <div className="flex w-[340px] shrink-0 flex-col rounded-xl border" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", maxHeight: isFull ? "82vh" : "58vh" }}>
            <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: "var(--ezd-divider)" }}>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}><Sparkles size={14} /> Assistant</span>
              <span className="flex items-center gap-2">
                {history.length > 0 && <button onClick={() => setHistory([])} title="Clear chat" className="text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>Clear</button>}
                <button onClick={() => setPanel(null)} style={{ color: "var(--ezd-fg-quiet)" }}><XIcon size={16} /></button>
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {history.length === 0 && <p className="px-1 text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>Tell me what to build or change. If I&rsquo;m unsure, I&rsquo;ll ask before touching your sheet.</p>}
              {history.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed" style={m.role === "user" ? { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" } : { background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}>{m.content}</div>
                </div>
              ))}
              {aiBusy && <div className="flex justify-start"><div className="rounded-2xl px-3 py-2" style={{ background: "var(--ezd-bg-hover)" }}><Loader2 size={14} className="animate-spin" style={{ color: "var(--ezd-fg-muted)" }} /></div></div>}
            </div>
            <div className="border-t p-2" style={{ borderColor: "var(--ezd-divider)" }}>
              <div className="flex items-center gap-2">
                <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }} placeholder="Reply, or tell me what to do…" className="h-9 flex-1 rounded-xl border bg-transparent px-3 text-[12.5px] outline-none" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)" }} />
                <button onClick={send} disabled={aiBusy || !aiInput.trim()} className="grid h-9 w-9 place-items-center rounded-xl disabled:opacity-50" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}><Send size={15} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>Type values or formulas (e.g. <code>=SUM(B2:B4)</code>). Shift-click to select a range, then use the format buttons. Everything stays on your device.</p>

      {(sheet.charts || []).length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(sheet.charts || []).map((ch) => (
            <div key={ch.id} className="relative">
              <button onClick={() => removeChart(ch.id)} title="Remove chart" className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-md border" style={{ color: "var(--ezd-fg-quiet)", background: "var(--ezd-bg-page)", borderColor: "var(--ezd-divider)" }}><XIcon size={13} /></button>
              <SheetChart spec={ch} evaluated={evaluated} />
            </div>
          ))}
        </div>
      )}

      {/* AI builder box */}
      <div className="sticky bottom-3 mt-5">
        {notice && (
          <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px]" style={{ borderColor: notice.type === "error" ? "rgba(239,68,68,0.4)" : notice.type === "info" ? "rgba(59,130,246,0.4)" : "var(--ezd-divider)", background: notice.type === "error" ? "rgba(239,68,68,0.1)" : notice.type === "info" ? "rgba(59,130,246,0.1)" : "var(--ezd-bg-card)", color: notice.type === "error" ? "#ef4444" : notice.type === "info" ? "#3b82f6" : "var(--ezd-fg-strong)" }}>
            {notice.type === "error" ? <AlertTriangle size={14} /> : notice.type === "info" ? <Sparkles size={14} /> : <Check size={14} />}<span>{notice.text}</span>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border p-2 shadow-lg" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
          <Sparkles size={16} className="ml-1.5 shrink-0" style={{ color: "var(--ezd-fg-strong)" }} />
          <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }} placeholder='Ask AI to build or edit — e.g. "make a 12-month budget with a total row"' className="h-9 flex-1 bg-transparent px-1 text-[13.5px] outline-none" style={{ color: "var(--ezd-fg-strong)" }} />
          <button onClick={send} disabled={aiBusy || !aiInput.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>{aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
        </div>
      </div>

      {confirmClear && (
        <div className="fixed inset-0 z-[120] grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setConfirmClear(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Clear the whole sheet?</h3>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>This removes all content and formatting. It can&rsquo;t be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmClear(false)} className="rounded-lg border px-4 py-2 text-[13px]" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>Cancel</button>
              <button onClick={clearAll} className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: "#ef4444" }}>Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
