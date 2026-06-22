"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Download, FileSpreadsheet, FileText, Loader2, Send, Sparkles, Trash2, AlertTriangle, Check,
  Upload, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Baseline, PaintBucket, Eraser, Maximize2, Minimize2,
  DollarSign, Percent, Hash, Pin, X as XIcon,
} from "lucide-react";
import { type Sheet, type CellFormat, type ChartSpec, emptySheet, evaluateSheet, colName, cellRef, parseRef, formatDisplay, normColor, condStyleFor } from "@/lib/sheet";
import SheetChart from "@/components/SheetChart";
import { applyOps, type SheetOp } from "@/lib/sheetOps";
import { exportXlsx, exportSheetPdf } from "@/lib/sheetExport";
import { importXlsx, parseCsv } from "@/lib/sheetImport";
import { downloadBlob } from "@/lib/convert";
import { getIdToken, onAuthStateChange } from "@/lib/auth";

const SLASH_HELP: { cmd: string; desc: string }[] = [
  { cmd: "/clear", desc: "Empty the whole sheet" },
  { cmd: "/bold", desc: "Bold the selection" },
  { cmd: "/italic", desc: "Italicize the selection" },
  { cmd: "/underline", desc: "Underline the selection" },
  { cmd: "/left /center /right", desc: "Align the selection" },
  { cmd: "/color green", desc: "Text color (name or #hex)" },
  { cmd: "/bg lightyellow", desc: "Fill color (name or #hex)" },
  { cmd: "/currency $", desc: "Currency format" },
  { cmd: "/percent", desc: "Percent format" },
  { cmd: "/comma", desc: "Thousands separators" },
  { cmd: "/clearformat", desc: "Remove formatting" },
  { cmd: "/row  /col", desc: "Add a row / column" },
];

/** Heuristic: warn if the user clearly asked for something the AI didn't emit. */
function validateAgainst(text: string, types: Set<string>): string {
  const t = text.toLowerCase();
  const miss: string[] = [];
  if (/(chart|graph|plot)/.test(t) && !types.has("chart")) miss.push("a chart");
  if (/(conditional|highlight|negative|below|above|threshold)/.test(t) && !types.has("condFormat") && !types.has("format")) miss.push("conditional highlighting");
  if (/(currency|inr|usd|rupee|dollar|₹|\$)/.test(t) && !types.has("format")) miss.push("currency formatting");
  if (/\bfreeze\b/.test(t) && !types.has("freeze")) miss.push("freezing panes");
  return miss.length ? `Done — but I may not have added: ${miss.join(", ")}. Try asking for just that part.` : "";
}

export default function SpreadsheetApp() {
  const [sheet, setSheet] = useState<Sheet>(() => emptySheet(8, 20));
  const [focus, setFocus] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [anchor, setAnchor] = useState<string>("A1");
  const [lead, setLead] = useState<string>("A1");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "error" | "info"; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const noticeTimer = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const evaluated = useMemo(() => evaluateSheet(sheet), [sheet]);
  const router = useRouter();

  useEffect(() => { const unsub = onAuthStateChange((u) => { setSignedIn(!!u); setAuthReady(true); }); return () => unsub(); }, []);
  // AI page — require login first.
  useEffect(() => { if (authReady && !signedIn) router.replace(`/auth?redirect=${encodeURIComponent("/spreadsheet")}`); }, [authReady, signedIn, router]);
  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);
  useEffect(() => {
    const onFs = () => setIsFull(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => { document.removeEventListener("fullscreenchange", onFs); document.removeEventListener("webkitfullscreenchange", onFs); };
  }, []);

  const toggleFull = () => {
    const el = rootRef.current; if (!el) return;
    const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fs) { const ex = (document as any).exitFullscreen || (document as any).webkitExitFullscreen; try { ex?.call(document); } catch {} }
    else { const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen; if (req) { try { const p = req.call(el); if (p?.catch) p.catch(() => {}); } catch {} } }
  };

  const showNotice = (type: "ok" | "error" | "info", text: string) => {
    setNotice({ type, text });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), type === "ok" ? 2600 : 5000);
  };

  /* ----------------------------- selection ----------------------------- */
  const selRect = useMemo(() => {
    const a = parseRef(anchor) || { c: 0, r: 0 };
    const l = parseRef(lead) || a;
    return { c0: Math.min(a.c, l.c), c1: Math.max(a.c, l.c), r0: Math.min(a.r, l.r), r1: Math.max(a.r, l.r) };
  }, [anchor, lead]);
  const inSel = (c: number, r: number) => c >= selRect.c0 && c <= selRect.c1 && r >= selRect.r0 && r <= selRect.r1;
  const selRange = (): string => `${cellRef(selRect.c0, selRect.r0)}:${cellRef(selRect.c1, selRect.r1)}`;
  const frozenRows = sheet.frozen?.rows ?? 0;
  const frozenCols = sheet.frozen?.cols ?? 0;
  const HEADER_H = 28, ROW_H = 28, GUTTER_W = 42, COL_W = 110;

  /* ------------------------------ editing ------------------------------ */
  const commit = (ref: string, value: string) => setSheet((s) => { const cells = { ...s.cells }; if (value === "") delete cells[ref]; else cells[ref] = value; return { ...s, cells }; });
  const focusCell = (ref: string) => { const el = document.querySelector<HTMLInputElement>(`input[data-cell="${ref}"]`); el?.focus(); el?.select(); };
  const onCellKey = (e: React.KeyboardEvent<HTMLInputElement>, c: number, r: number) => {
    if (e.key === "Enter") { e.preventDefault(); commit(cellRef(c, r), draft); (e.target as HTMLInputElement).blur(); if (r + 1 < sheet.rows) setTimeout(() => focusCell(cellRef(c, r + 1)), 0); }
    else if (e.key === "Escape") { e.preventDefault(); setDraft(sheet.cells[cellRef(c, r)] ?? ""); (e.target as HTMLInputElement).blur(); }
    else if (e.key === "Tab") { e.preventDefault(); commit(cellRef(c, r), draft); const nc = c + 1 < sheet.cols ? c + 1 : 0; const nr = c + 1 < sheet.cols ? r : r + 1; setTimeout(() => focusCell(cellRef(nc, nr)), 0); }
  };

  /* ---------------------------- structural ----------------------------- */
  const addRow = () => setSheet((s) => ({ ...s, rows: Math.min(2000, s.rows + 1) }));
  const addCol = () => setSheet((s) => ({ ...s, cols: Math.min(60, s.cols + 1) }));
  const clearAll = () => { setSheet(emptySheet(8, 20)); setConfirmClear(false); showNotice("ok", "Cleared the sheet."); };
  const apply = (ops: SheetOp[]) => setSheet((s) => applyOps(s, ops));
  const freeze = (rows?: number, cols?: number) => apply([{ op: "freeze", rows, cols }]);
  const removeChart = (id: string) => setSheet((s) => ({ ...s, charts: (s.charts || []).filter((x) => x.id !== id) }));

  /* ---------------------------- formatting ----------------------------- */
  const allHave = (key: keyof CellFormat): boolean => {
    for (let c = selRect.c0; c <= selRect.c1; c++) for (let r = selRect.r0; r <= selRect.r1; r++) {
      if (!sheet.formats?.[cellRef(c, r)]?.[key]) return false;
    }
    return true;
  };
  const toggle = (which: "bold" | "italic" | "underline") => {
    const key = which === "bold" ? "b" : which === "italic" ? "i" : "u";
    apply([{ op: "format", range: selRange(), [which]: !allHave(key as keyof CellFormat) } as any]);
  };
  const setAlign = (align: "left" | "center" | "right") => apply([{ op: "format", range: selRange(), align }]);
  const setColor = (color: string) => apply([{ op: "format", range: selRange(), color }]);
  const setBg = (bg: string) => apply([{ op: "format", range: selRange(), bg }]);
  const setNum = (numFmt: CellFormat["numFmt"], currency?: string) => apply([{ op: "format", range: selRange(), numFmt, ...(currency ? { currency } : {}) }]);
  const clearFmt = () => apply([{ op: "clearFormat", range: selRange() }]);

  /* ------------------------------ upload ------------------------------- */
  const onUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const lower = file.name.toLowerCase();
      let next: Sheet;
      if (lower.endsWith(".csv") || file.type === "text/csv") next = parseCsv(await file.text());
      else if (lower.endsWith(".xlsx")) next = await importXlsx(file);
      else { showNotice("error", "Upload a .xlsx or .csv file."); setUploading(false); return; }
      setSheet(next); setAnchor("A1"); setLead("A1");
      showNotice("ok", `Loaded ${file.name}.`);
    } catch (e: any) {
      showNotice("error", "Couldn't read that file.");
    } finally { setUploading(false); }
  };

  /* ------------------------------ export ------------------------------- */
  const dlXlsx = async () => { try { const r = await exportXlsx(sheet, evaluated, "spreadsheet.xlsx"); downloadBlob(r.blob, r.filename); } catch { showNotice("error", "Couldn't export the .xlsx."); } };
  const dlPdf = async () => { try { const r = await exportSheetPdf(sheet, evaluated, "spreadsheet.pdf"); downloadBlob(r.blob, r.filename); } catch { showNotice("error", "Couldn't export the PDF."); } };

  /* --------------------------- slash + AI ------------------------------ */
  const runSlash = (text: string): boolean => {
    const parts = text.trim().slice(1).split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const arg = parts[1] || "";
    switch (cmd) {
      case "clear": setSheet(emptySheet(8, 20)); showNotice("ok", "Cleared the sheet."); return true;
      case "bold": toggle("bold"); showNotice("ok", "Toggled bold."); return true;
      case "italic": toggle("italic"); showNotice("ok", "Toggled italic."); return true;
      case "underline": case "under": toggle("underline"); showNotice("ok", "Toggled underline."); return true;
      case "left": case "center": case "right": setAlign(cmd); showNotice("ok", `Aligned ${cmd}.`); return true;
      case "color": { const hex = normColor(arg); if (hex) { setColor(hex); showNotice("ok", "Set text color."); } else showNotice("error", "Use /color <name or #rrggbb>"); return true; }
      case "bg": case "fill": { const hex = normColor(arg); if (hex) { setBg(hex); showNotice("ok", "Set fill color."); } else showNotice("error", "Use /bg <name or #rrggbb>"); return true; }
      case "currency": case "money": setNum("currency", arg || "$"); showNotice("ok", "Formatted as currency."); return true;
      case "percent": setNum("percent"); showNotice("ok", "Formatted as percent."); return true;
      case "comma": setNum("comma"); showNotice("ok", "Added thousands separators."); return true;
      case "clearformat": clearFmt(); showNotice("ok", "Cleared formatting."); return true;
      case "row": addRow(); showNotice("ok", "Added a row."); return true;
      case "col": case "column": addCol(); showNotice("ok", "Added a column."); return true;
      case "freeze": { const rws = parts[1] ? parseInt(parts[1], 10) : 1; const cls = parts[2] ? parseInt(parts[2], 10) : 0; freeze(Number.isFinite(rws) ? rws : 1, Number.isFinite(cls) ? cls : 0); showNotice("ok", "Froze panes."); return true; }
      case "unfreeze": freeze(0, 0); showNotice("ok", "Unfroze panes."); return true;
      default: showNotice("error", `Unknown command "/${cmd}".`); return true;
    }
  };

  const send = async () => {
    const text = aiInput.trim();
    if (!text || aiBusy) return;
    if (text.startsWith("/")) { runSlash(text); setAiInput(""); return; }
    setAiBusy(true);
    try {
      if (authReady && !signedIn) { showNotice("error", "Sign in to use the AI assistant."); setAiBusy(false); return; }
      const token = await getIdToken().catch(() => null);
      if (!token) { showNotice("error", authReady ? "Sign in to use the AI assistant." : "Finishing sign-in — try again in a second."); setAiBusy(false); return; }

      let working = sheet;
      let instr = text;
      let more = true, guard = 0, lastMsg = "";
      const opTypes = new Set<string>();
      while (more && guard < 8) {
        guard++;
        const res = await fetch("/api/sheet-ai", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ cols: working.cols, rows: working.rows, cells: working.cells, instruction: instr }),
        });
        const d = await res.json().catch(() => ({}));
        if (d?.clarify) { showNotice("info", d.clarify); setAiBusy(false); return; }
        if (!res.ok || d?.error) { if (guard === 1) { showNotice("error", d?.error || "The assistant couldn't do that."); setAiBusy(false); return; } break; }
        const ops = Array.isArray(d.ops) ? d.ops : [];
        ops.forEach((o: any) => o?.op && opTypes.add(o.op));
        working = applyOps(working, ops);
        lastMsg = d.message || lastMsg;
        more = !!d.continue;
        if (more) { setSheet(working); showNotice("info", `Working… (part ${guard})`); instr = "Continue the SAME task from where you left off using the updated sheet. Do not repeat rows/ops already applied. Set continue:false when fully done."; }
      }
      setSheet(working);
      setAiInput("");
      const warn = validateAgainst(text, opTypes);
      showNotice(warn ? "info" : "ok", warn || lastMsg || "Done.");
    } catch (e: any) { showNotice("error", e?.message || "Something went wrong."); }
    finally { setAiBusy(false); }
  };

  /* ------------------------------- render ------------------------------ */
  if (!authReady || !signedIn) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div>
          <p className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
            {authReady ? "Sign in to use the AI Spreadsheet" : "Loading…"}
          </p>
          {authReady && (
            <>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>It&rsquo;s free — create an account or log in to start building sheets with AI.</p>
              <Link href={`/auth?redirect=${encodeURIComponent("/spreadsheet")}`} className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>Sign in</Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const ToolBtn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button onClick={onClick} title={title} className="grid h-8 w-8 place-items-center rounded-lg border transition hover:opacity-80" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>{children}</button>
  );

  return (
    <div ref={rootRef} className="relative" style={isFull ? { background: "var(--ezd-bg-page)", padding: 20, overflow: "auto", height: "100%" } : undefined}>
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload .xlsx/.csv</button>
        <button onClick={addRow} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}><Plus size={13} /> Row</button>
        <button onClick={addCol} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}><Plus size={13} /> Column</button>
        <button onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}><Trash2 size={13} /> Clear</button>
        <span className="flex-1" />
        <button onClick={() => freeze(frozenRows > 0 ? 0 : 1, frozenRows > 0 ? 0 : frozenCols)} title={frozenRows > 0 ? "Unfreeze" : "Freeze top row"} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: frozenRows > 0 ? "var(--ezd-fg-strong)" : "var(--ezd-fg-muted)" }}><Pin size={13} /> {frozenRows > 0 ? "Frozen" : "Freeze"}</button>
        <button onClick={toggleFull} title={isFull ? "Exit full screen" : "Full screen"} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>{isFull ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {isFull ? "Exit" : "Full screen"}</button>
        <button onClick={dlXlsx} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}><FileSpreadsheet size={14} /> Excel (.xlsx)</button>
        <button onClick={dlPdf} className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)" }}><FileText size={14} /> PDF</button>
      </div>

      {/* formula bar */}
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 min-w-[42px] place-items-center rounded-md border px-2 text-[12px] font-semibold" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>{anchor}</span>
        <input
          value={sheet.cells[anchor] ?? ""}
          onChange={(e) => commit(anchor, e.target.value)}
          placeholder="Cell content or formula (e.g. =SUM(B2:B10))"
          className="h-8 flex-1 rounded-md border bg-transparent px-2.5 text-[12.5px] outline-none"
          style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)" }}
          spellCheck={false}
        />
      </div>

      <div className="flex gap-3">
        {/* grid */}
        <div className="min-w-0 flex-1 overflow-auto rounded-xl border" style={{ borderColor: "var(--ezd-divider)", maxHeight: isFull ? "82vh" : "60vh" }}>
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30" style={{ width: 42, minWidth: 42, background: "var(--ezd-bg-elev)", borderRight: "1px solid var(--ezd-divider)", borderBottom: "1px solid var(--ezd-divider)" }} />
                {Array.from({ length: sheet.cols }, (_, c) => (
                  <th key={c} className="sticky top-0 px-2 py-1 text-[11px] font-semibold" style={{ width: 110, minWidth: 110, background: "var(--ezd-bg-elev)", color: "var(--ezd-fg-muted)", borderRight: c === frozenCols - 1 ? "2px solid var(--ezd-fg-muted)" : "1px solid var(--ezd-divider)", borderBottom: "1px solid var(--ezd-divider)", ...(c < frozenCols ? { position: "sticky" as const, left: GUTTER_W + c * COL_W, zIndex: 22 } : { zIndex: 10 }) }}>{colName(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sheet.rows }, (_, r) => (
                <tr key={r}>
                  <td className="sticky left-0 text-center text-[11px]" style={{ width: 42, minWidth: 42, background: "var(--ezd-bg-elev)", color: "var(--ezd-fg-quiet)", borderRight: "1px solid var(--ezd-divider)", borderBottom: r === frozenRows - 1 ? "2px solid var(--ezd-fg-muted)" : "1px solid var(--ezd-divider)", ...(r < frozenRows ? { position: "sticky" as const, top: HEADER_H + r * ROW_H, zIndex: 16 } : { zIndex: 12 }) }}>{r + 1}</td>
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
                      <td
                        key={c}
                        onMouseDown={(e) => { if (e.shiftKey) { e.preventDefault(); setLead(ref); } }}
                        style={tdStyle}
                      >
                        <input
                          data-cell={ref}
                          value={focused ? draft : formatDisplay(disp, fmt)}
                          onChange={(e) => setDraft(e.target.value)}
                          onFocus={() => { setFocus(ref); setDraft(sheet.cells[ref] ?? ""); setAnchor(ref); setLead(ref); }}
                          onBlur={() => { commit(ref, draft); setFocus(null); }}
                          onKeyDown={(e) => onCellKey(e, c, r)}
                          className="h-7 w-full px-2 text-[12.5px] outline-none"
                          style={{
                            width: 110, background: "transparent",
                            color: isErr ? "#ef4444" : (cs.color || fmt.color || "var(--ezd-fg-strong)"),
                            fontWeight: fmt.b ? 700 : 400, fontStyle: fmt.i ? "italic" : "normal",
                            textDecoration: fmt.u ? "underline" : "none",
                            textAlign: fmt.align || (!focused && numeric ? "right" : "left"),
                            boxShadow: focused ? "inset 0 0 0 2px var(--ezd-fg-strong)" : (selected ? "inset 0 0 0 1px var(--ezd-fg-muted)" : "none"),
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* command bar */}
        <div className="hidden w-52 shrink-0 rounded-xl border p-3 lg:block" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--ezd-fg-quiet)" }}>Format selection</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ToolBtn onClick={() => toggle("bold")} title="Bold"><Bold size={15} /></ToolBtn>
            <ToolBtn onClick={() => toggle("italic")} title="Italic"><Italic size={15} /></ToolBtn>
            <ToolBtn onClick={() => toggle("underline")} title="Underline"><Underline size={15} /></ToolBtn>
            <ToolBtn onClick={() => setAlign("left")} title="Align left"><AlignLeft size={15} /></ToolBtn>
            <ToolBtn onClick={() => setAlign("center")} title="Align center"><AlignCenter size={15} /></ToolBtn>
            <ToolBtn onClick={() => setAlign("right")} title="Align right"><AlignRight size={15} /></ToolBtn>
            <ToolBtn onClick={() => colorRef.current?.click()} title="Text color"><Baseline size={15} /></ToolBtn>
            <ToolBtn onClick={() => bgRef.current?.click()} title="Fill color"><PaintBucket size={15} /></ToolBtn>
            <ToolBtn onClick={() => setNum("currency", "$")} title="Currency"><DollarSign size={15} /></ToolBtn>
            <ToolBtn onClick={() => setNum("percent")} title="Percent"><Percent size={15} /></ToolBtn>
            <ToolBtn onClick={() => setNum("comma")} title="Thousands separator"><Hash size={15} /></ToolBtn>
            <ToolBtn onClick={clearFmt} title="Clear formatting"><Eraser size={15} /></ToolBtn>
          </div>
          <input ref={colorRef} type="color" className="hidden" onChange={(e) => setColor(e.target.value)} />
          <input ref={bgRef} type="color" className="hidden" onChange={(e) => setBg(e.target.value)} />

          <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--ezd-fg-quiet)" }}>Slash commands</div>
          <div className="mt-2 space-y-1.5">
            {SLASH_HELP.map((s) => (
              <div key={s.cmd} className="text-[11.5px] leading-tight">
                <code style={{ color: "var(--ezd-fg-strong)" }}>{s.cmd}</code>
                <span className="block" style={{ color: "var(--ezd-fg-quiet)" }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[11.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>Type values or formulas (e.g. <code>=SUM(B2:B4)</code>). Shift-click to select a range, then format it. Everything stays on your device.</p>

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

      {/* AI + slash box */}
      <div className="sticky bottom-3 mt-5">
        {notice && (
          <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px]" style={{ borderColor: notice.type === "error" ? "rgba(239,68,68,0.4)" : notice.type === "info" ? "rgba(59,130,246,0.4)" : "var(--ezd-divider)", background: notice.type === "error" ? "rgba(239,68,68,0.1)" : notice.type === "info" ? "rgba(59,130,246,0.1)" : "var(--ezd-bg-card)", color: notice.type === "error" ? "#ef4444" : notice.type === "info" ? "#3b82f6" : "var(--ezd-fg-strong)" }}>
            {notice.type === "error" ? <AlertTriangle size={14} /> : notice.type === "info" ? <Sparkles size={14} /> : <Check size={14} />}<span>{notice.text}</span>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border p-2 shadow-lg" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
          <Sparkles size={16} className="ml-1.5 shrink-0" style={{ color: "var(--ezd-fg-strong)" }} />
          <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }} placeholder='Ask AI or type a /command — e.g. "add a total row" or /bold' className="h-9 flex-1 bg-transparent px-1 text-[13.5px] outline-none" style={{ color: "var(--ezd-fg-strong)" }} />
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
