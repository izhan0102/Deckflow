"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Wand2, Loader2, FileDown, Bold, Underline, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Plus, Image as ImageIcon, SlidersHorizontal, Type, X, UploadCloud, Search, Sparkles, Send,
} from "lucide-react";
import Logo from "@/components/Logo";
import DocCanvas from "@/components/DocCanvas";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";
import { DEFAULT_DOC_THEME, blockId, A4, type DocTheme, type DocBlock, type DocBlockType, type DocDensity, type ExDoc } from "@/lib/docTypes";
import { DOC_FONTS, loadDocFonts, getDocFont } from "@/lib/docFonts";
import { DOC_TEMPLATES, applyDocTemplate } from "@/lib/docTemplates";
import { searchPexels, type PexelsPhoto } from "@/lib/pexels";
import { renderPagesToPdf } from "@/lib/docPdf";
import { createDoc, saveDoc, loadDoc } from "@/lib/docStore";
import DocGenOverlay from "@/components/DocGenOverlay";

const DENSITIES: DocDensity[] = ["concise", "balanced", "detailed", "comprehensive"];
const ACC = "var(--ezd-fg-strong)";

export default function DocsStudio() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"prompt" | "template" | "edit">("prompt");

  const [topic, setTopic] = useState("");
  const [pages, setPages] = useState(3);
  const [densityIdx, setDensityIdx] = useState(1);
  const [theme, setTheme] = useState<DocTheme>({ ...DEFAULT_DOC_THEME });
  const [showOpt, setShowOpt] = useState(false);

  const [docTitle, setDocTitle] = useState("");
  const [docSubtitle, setDocSubtitle] = useState<string | undefined>(undefined);
  const [blocks, setBlocks] = useState<DocBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [showOptPanel, setShowOptPanel] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wmEdit, setWmEdit] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [pagedDocs, setPagedDocs] = useState<ExDoc[] | null>(null);
  const pageRefs = useRef<HTMLDivElement[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => { const u = onAuthStateChange((x) => { setUser(x); setReady(true); }); return () => u(); }, []);
  useEffect(() => { loadDocFonts([theme.fontId, theme.headingFontId || theme.fontId]); }, [theme.fontId, theme.headingFontId]);

  // Open an existing document via /docs?id=...
  useEffect(() => {
    if (!user) return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    (async () => {
      const stored = await loadDoc(user.uid, id).catch(() => null);
      if (stored?.doc) {
        setDocTitle(stored.doc.title || "");
        setDocSubtitle(stored.doc.subtitle);
        setTheme({ ...DEFAULT_DOC_THEME, ...stored.doc.theme });
        setBlocks(stored.doc.blocks || []);
        setDocId(stored.id);
        setStep("edit");
      }
    })();
  }, [user]);

  const doc: ExDoc = useMemo(() => ({ title: docTitle, subtitle: docSubtitle, theme, blocks }), [docTitle, docSubtitle, theme, blocks]);

  // Debounced autosave once a document has been created and we're editing.
  useEffect(() => {
    if (!user || !docId || step !== "edit") return;
    const t = setTimeout(() => { saveDoc(user.uid, docId, doc).catch(() => {}); }, 900);
    return () => clearTimeout(t);
  }, [user, docId, step, doc]);

  const generate = async () => {
    if (topic.trim().length < 5) { setErr("Enter a topic (5+ chars)."); return; }
    setLoading(true); setErr(null);
    try {
      const token = await getIdToken().catch(() => null);
      const res = await fetch("/api/generate-doc", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ topic, pages, density: DENSITIES[densityIdx] }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d?.error || "Generation failed."); return; }
      setDocTitle(d.doc.title || topic.slice(0, 80));
      setDocSubtitle(d.doc.subtitle);
      setBlocks(d.doc.blocks || []);
      setStep("template");
      // Persist immediately so it shows up under "My docs".
      if (user && !savingRef.current) {
        savingRef.current = true;
        try {
          const id = await createDoc(user.uid, { title: d.doc.title || topic.slice(0, 80), subtitle: d.doc.subtitle, theme, blocks: d.doc.blocks || [] });
          setDocId(id);
        } catch { /* autosave will retry on edits */ } finally { savingRef.current = false; }
      }
    } catch (e: any) { setErr(e?.message || "Failed."); } finally { setLoading(false); }
  };

  /* block ops */
  const update = (id: string, patch: Partial<DocBlock>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } as DocBlock : b)));
  const move = (id: string, dir: -1 | 1) => setBlocks((bs) => { const i = bs.findIndex((b) => b.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= bs.length) return bs; const n = [...bs]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const del = (id: string) => setBlocks((bs) => bs.filter((b) => b.id !== id));
  const reorder = (fromId: string, toId: string) => setBlocks((bs) => {
    const from = bs.findIndex((b) => b.id === fromId); const to = bs.findIndex((b) => b.id === toId);
    if (from < 0 || to < 0 || from === to) return bs;
    const n = [...bs]; const [moved] = n.splice(from, 1); n.splice(to, 0, moved); return n;
  });
  const addAfter = (id: string) => setBlocks((bs) => { const i = bs.findIndex((b) => b.id === id); const n = [...bs]; n.splice(i + 1, 0, { id: blockId(), type: "paragraph", text: "" }); return n; });

  const makeBlock = (type: DocBlockType): DocBlock => {
    switch (type) {
      case "heading": return { id: blockId(), type: "heading", level: 2, text: "Section heading" };
      case "bullets": return { id: blockId(), type: "bullets", items: ["First point"] };
      case "numbered": return { id: blockId(), type: "numbered", items: ["First step"] };
      case "table": return { id: blockId(), type: "table", headers: ["Column 1", "Column 2"], rows: [["", ""], ["", ""]] };
      case "quote": return { id: blockId(), type: "quote", text: "A relevant quotation.", cite: "" };
      case "callout": return { id: blockId(), type: "callout", tone: "info", text: "Key takeaway." };
      case "divider": return { id: blockId(), type: "divider" };
      default: return { id: blockId(), type: "paragraph", text: "New paragraph." };
    }
  };
  const addBlock = (type: DocBlockType) => setBlocks((bs) => [...bs, makeBlock(type)]);
  const addImage = (url: string) => setBlocks((bs) => [...bs, { id: blockId(), type: "image", url, width: 80, align: "center" }]);

  const exec = (cmd: string) => { try { document.execCommand(cmd, false); } catch { /* ignore */ } };

  // Selection-aware styling: if text is selected, style just that selection
  // (wrap in a span — the editor stays focused via preventDefault, so it
  // commits on blur); otherwise fall back to the focused block, then the doc.
  const hasSel = () => { const s = window.getSelection(); return !!(s && s.rangeCount && !s.isCollapsed && s.toString().trim()); };
  const wrapSel = (styleObj: Record<string, string>) => {
    const s = window.getSelection(); if (!s || !s.rangeCount || s.isCollapsed) return false;
    const r = s.getRangeAt(0);
    const span = document.createElement("span");
    Object.entries(styleObj).forEach(([k, v]) => { (span.style as any)[k] = v; });
    try { r.surroundContents(span); } catch { const f = r.extractContents(); span.appendChild(f); r.insertNode(span); }
    s.removeAllRanges();
    return true;
  };
  const changeFont = (id: string) => { if (hasSel()) wrapSel({ fontFamily: getDocFont(id).family }); else setTheme({ ...theme, fontId: id }); };
  const changeSize = (px: number) => {
    if (hasSel()) { wrapSel({ fontSize: `${px}px` }); return; }
    const activeBlock = blocks.find((b) => b.id === activeId);
    if (activeBlock) update(activeBlock.id, { fontSize: px } as any);
    else setTheme({ ...theme, fontScale: px / 16 });
  };

  const runAiEdit = async () => {
    const instruction = aiInput.trim();
    if (!instruction || aiLoading) return;
    setAiLoading(true); setErr(null);
    try {
      const token = await getIdToken().catch(() => null);
      const res = await fetch("/api/edit-doc", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title: docTitle, subtitle: docSubtitle, blocks, instruction }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d?.error || "Edit failed."); return; }
      setDocTitle(d.doc.title || docTitle);
      setDocSubtitle(d.doc.subtitle);
      setBlocks(d.doc.blocks || blocks);
      setAiInput("");
    } catch (e: any) { setErr(e?.message || "Failed."); } finally { setAiLoading(false); }
  };

  const exportPdf = async () => {
    if (!printRef.current) return;
    setExporting(true); setErr(null);
    try {
      await loadDocFonts([theme.fontId, theme.headingFontId || theme.fontId]);
      await new Promise((r) => setTimeout(r, 60)); // let fonts/layout settle
      const node = printRef.current;
      const els = Array.from(node.querySelectorAll<HTMLElement>("[data-doc-block]"));
      const pad = (theme.marginIn * A4.wPx) / A4.wIn;
      const usable = A4.hPx - pad * 2 - 6;
      const heights = els.map((el) => el.getBoundingClientRect().height + 12); // + block margin
      const hasCover = theme.cover;
      const coverH = hasCover ? heights[0] || 0 : 0;
      const offset = hasCover ? 1 : 0;

      const groups: DocBlock[][] = [];
      let cur: DocBlock[] = [];
      let curH = coverH;
      blocks.forEach((b, i) => {
        const h = heights[offset + i] || 0;
        if (cur.length > 0 && curH + h > usable) { groups.push(cur); cur = []; curH = 0; }
        cur.push(b); curH += h;
      });
      if (cur.length > 0 || groups.length === 0) groups.push(cur);

      const pages: ExDoc[] = groups.map((g, gi) => ({
        title: docTitle, subtitle: docSubtitle,
        theme: { ...theme, cover: hasCover && gi === 0, pageNumbers: theme.pageNumbers },
        blocks: g,
      }));
      pageRefs.current = [];
      setPagedDocs(pages); // capture runs in the effect once these render
    } catch (e: any) { setErr(e?.message || "PDF export failed."); setExporting(false); }
  };

  // Once the paginated page nodes have rendered, capture them to a PDF.
  useEffect(() => {
    if (!pagedDocs) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 80));
      try {
        const nodes = pageRefs.current.slice(0, pagedDocs.length).map((w) => (w?.firstElementChild as HTMLElement) || w).filter(Boolean);
        if (nodes.length) await renderPagesToPdf(nodes, `${(docTitle || "document").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
      } catch (e: any) { if (!cancelled) setErr(e?.message || "PDF export failed."); }
      if (!cancelled) { setPagedDocs(null); pageRefs.current = []; setExporting(false); }
    })();
    return () => { cancelled = true; };
  }, [pagedDocs, docTitle]);

  if (!ready) return <Center>Loading…</Center>;

  /* ----------------------------- prompt step ----------------------------- */
  if (step === "prompt") {
    const INK = "var(--ezd-fg-strong)"; // black in light, white in dark
    return (
      <main style={{ minHeight: "100vh", background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
        {loading && <DocGenOverlay pages={pages} />}
        <TopBar />
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: INK }}>
              <Sparkles size={12} /> Create a document
            </div>
            <h1 style={{ marginTop: 12, fontSize: 38, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.01em", color: INK }}>
              What&rsquo;s your document <span style={{ textDecoration: "underline", textDecorationThickness: 3, textUnderlineOffset: 5 }}>about?</span>
            </h1>
            <p style={{ margin: "12px auto 0", maxWidth: 520, fontSize: 14.5, lineHeight: 1.6, color: "var(--ezd-fg-muted)" }}>
              Describe it in a sentence or two. The AI writes a structured, editable document — headings, real data, tables, charts — and exports a clean PDF.
            </p>
            {!user && <p style={{ marginTop: 12, fontSize: 13, color: "#d97706" }}>Sign in to generate.</p>}
          </div>

          <div style={{ borderRadius: 16, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-card)", padding: 16 }}>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={5}
              placeholder="e.g. A business proposal for a campus food-delivery startup — market analysis, pricing table, growth chart, and a 3-month roadmap"
              style={{ display: "block", width: "100%", resize: "vertical", background: "transparent", padding: 4, fontSize: 15, lineHeight: 1.6, color: "var(--ezd-fg)", outline: "none", border: "none", minHeight: 130 }} />
          </div>

          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 28, rowGap: 16 }}>
            <label style={{ fontSize: 13.5, color: "var(--ezd-fg-muted)" }}>Pages
              <input type="number" min={1} max={20} value={pages} onChange={(e) => setPages(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                style={{ marginLeft: 8, width: 64, borderRadius: 8, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-card)", padding: "7px 9px", color: "var(--ezd-fg)", outline: "none" }} />
            </label>
            <div style={{ minWidth: 220, flex: 1 }}>
              <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ezd-fg-muted)" }}>
                <span>Text density</span><span style={{ fontWeight: 600, textTransform: "capitalize", color: INK }}>{DENSITIES[densityIdx]}</span>
              </div>
              <input type="range" min={0} max={3} value={densityIdx} onChange={(e) => setDensityIdx(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--ezd-fg-strong)" }} />
            </div>
          </div>

          {err && <p style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>{err}</p>}
          <button onClick={generate} disabled={loading}
            style={{ marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "none", background: INK, color: "var(--ezd-bg-page)", padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.55 : 1 }}>
            {loading ? <><Loader2 size={17} className="animate-spin" /> Writing your document…</> : <><Wand2 size={17} /> Generate document</>}
          </button>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--ezd-divider)" }}>
            <button onClick={() => setShowOpt((s) => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", fontSize: 13, color: INK, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>
              <SlidersHorizontal size={14} /> {showOpt ? "Hide" : "Show"} optional design settings
            </button>
            {showOpt && <div style={{ marginTop: 12 }}><OptionalPanel theme={theme} setTheme={setTheme} /></div>}
          </div>
        </div>
      </main>
    );
  }

  /* ---------------------------- template step ---------------------------- */
  if (step === "template") {
    return (
      <main style={{ minHeight: "100vh", background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
        <TopBar />
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: ACC }}>Step 2 · Template</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "var(--ezd-fg-strong)" }}>Pick a look</h1>
          <p style={{ marginTop: 6, color: "var(--ezd-fg-muted)", fontSize: 14 }}>Choose a style for your document — you can fine-tune fonts, colors, patterns, and add a watermark in the editor.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14, marginTop: 22 }}>
            {DOC_TEMPLATES.map((tpl) => {
              const th = { ...theme, ...tpl.theme };
              return (
                <button key={tpl.id} onClick={() => { setTheme(applyDocTemplate(theme, tpl)); setStep("edit"); }}
                  style={{ textAlign: "left", border: "1px solid var(--ezd-divider)", borderRadius: 14, overflow: "hidden", background: "var(--ezd-bg-card)", cursor: "pointer", padding: 0 }}>
                  <div style={{ height: 120, background: th.bg, padding: 14, position: "relative", ...(patternPreview(th.pattern!, th.accent!) || {}) }}>
                    <div style={{ height: 6, width: 44, background: th.accent, borderRadius: 99 }} />
                    <div style={{ marginTop: 10, fontFamily: getDocFont(th.headingFontId).family, color: th.fg, fontWeight: 800, fontSize: 16 }}>Aa Heading</div>
                    <div style={{ marginTop: 4, fontFamily: getDocFont(th.fontId).family, color: th.fg, fontSize: 11, opacity: 0.8 }}>Body text preview in this template&rsquo;s font.</div>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ezd-fg-strong)" }}>{tpl.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ezd-fg-quiet)" }}>{tpl.blurb}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={() => setStep("edit")} style={{ marginTop: 18, background: "none", border: "none", color: "var(--ezd-fg-muted)", fontSize: 13, cursor: "pointer" }}>Skip — use current settings</button>
        </div>
      </main>
    );
  }

  /* ------------------------------ edit step ------------------------------ */
  return (
    <main style={{ minHeight: "100vh", background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {/* toolbar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid var(--ezd-divider)", background: "var(--ezd-nav-bg)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Logo size="sm" href="/" />
          <span style={{ width: 1, height: 22, background: "var(--ezd-divider)" }} />
          {/* font */}
          <FontPicker value={theme.fontId} onChange={changeFont} />
          {(() => {
            const activeBlock = blocks.find((b) => b.id === activeId);
            const curPx = activeBlock && (activeBlock as any).fontSize ? Math.round((activeBlock as any).fontSize) : Math.round(16 * theme.fontScale);
            return <SizePicker value={curPx} onPick={changeSize} />;
          })()}
          <span style={{ width: 1, height: 22, background: "var(--ezd-divider)" }} />
          <TBtn onClick={() => exec("bold")} title="Bold"><Bold size={15} /></TBtn>
          <TBtn onClick={() => exec("italic")} title="Italic"><Italic size={15} /></TBtn>
          <TBtn onClick={() => exec("underline")} title="Underline"><Underline size={15} /></TBtn>
          <span style={{ width: 1, height: 22, background: "var(--ezd-divider)" }} />
          <TBtn onClick={() => exec("justifyLeft")} title="Align left"><AlignLeft size={15} /></TBtn>
          <TBtn onClick={() => exec("justifyCenter")} title="Center"><AlignCenter size={15} /></TBtn>
          <TBtn onClick={() => exec("justifyRight")} title="Align right"><AlignRight size={15} /></TBtn>
          <TBtn onClick={() => exec("justifyFull")} title="Justify"><AlignJustify size={15} /></TBtn>
          <span style={{ width: 1, height: 22, background: "var(--ezd-divider)" }} />
          <AddBlockMenu onAdd={addBlock} />
          <TBtn onClick={() => setImgOpen(true)} title="Add image"><ImageIcon size={15} /></TBtn>
          <TBtn onClick={() => setShowOptPanel((s) => !s)} title="Design"><SlidersHorizontal size={15} /></TBtn>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setStep("prompt")} style={{ ...btn(false), background: "transparent", color: "var(--ezd-fg-muted)", border: "1px solid var(--ezd-divider)" }}>New</button>
            <button onClick={exportPdf} disabled={exporting} style={btn(exporting)}>{exporting ? <><Loader2 size={15} className="animate-spin" /> PDF…</> : <><FileDown size={15} /> Export PDF</>}</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0 }}>
        {/* canvas */}
        <div style={{ flex: 1, overflow: "auto", padding: "28px 16px", background: "var(--ezd-bg-page-deep, #0a0a0a)" }}>
          <DocCanvas doc={doc} editable onUpdate={update} onMove={move} onDelete={del} onAddAfter={addAfter} onTitle={setDocTitle} onSubtitle={(v) => setDocSubtitle(v)} onFocusBlock={setActiveId} onReorder={reorder} onEditWatermark={() => setWmEdit(true)} />
        </div>
        {showOptPanel && (
          <div style={{ width: 280, borderLeft: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-card)", padding: 16, overflow: "auto", maxHeight: "calc(100vh - 50px)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Type size={14} /> Design</h3>
            <OptionalPanel theme={theme} setTheme={setTheme} compact />
          </div>
        )}
      </div>

      {err && <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#ef4444", color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 13, zIndex: 50 }}>{err}</div>}

      {imgOpen && <ImageDialog onClose={() => setImgOpen(false)} onPick={(url) => { addImage(url); setImgOpen(false); }} />}

      {wmEdit && (
        <div onClick={() => setWmEdit(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px,94vw)", background: "var(--ezd-bg-elev)", border: "1px solid var(--ezd-divider)", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ezd-fg-strong)" }}>Background watermark</h3>
              <button onClick={() => setWmEdit(false)} style={{ background: "none", border: "none", color: "var(--ezd-fg-muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <WatermarkField theme={theme} setTheme={setTheme} />
          </div>
        </div>
      )}

      {/* floating AI edit box */}
      <div style={{ position: "fixed", bottom: 18, left: showOptPanel ? "calc(50% - 140px)" : "50%", transform: "translateX(-50%)", zIndex: 40, width: "min(620px, 92vw)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 8px 14px", borderRadius: 14, background: "var(--ezd-bg-elev)", border: "1px solid var(--ezd-divider)", boxShadow: "0 12px 40px rgba(0,0,0,0.28)" }}>
          <Sparkles size={16} style={{ color: ACC, flexShrink: 0 }} />
          <input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runAiEdit(); }}
            disabled={aiLoading}
            placeholder="Ask AI to edit — e.g. add stats to section 2, make the intro bolder, add a comparison table"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--ezd-fg)", fontSize: 13.5 }}
          />
          <button onClick={runAiEdit} disabled={aiLoading || !aiInput.trim()}
            style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, border: "none", background: ACC, color: "var(--ezd-bg-page)", cursor: aiLoading || !aiInput.trim() ? "not-allowed" : "pointer", opacity: aiLoading || !aiInput.trim() ? 0.6 : 1, flexShrink: 0 }}>
            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* hidden clean render for PDF: a measuring node + (during export) one node per page */}
      <div style={{ position: "fixed", left: -99999, top: 0 }} aria-hidden>
        <DocCanvas doc={doc} editable={false} print innerRef={printRef} />
        {pagedDocs?.map((pd, i) => (
          <div key={i} ref={(el) => { if (el) pageRefs.current[i] = el; }}>
            <DocCanvas doc={pd} editable={false} print />
          </div>
        ))}
      </div>
    </main>
  );
}

/* -------------------------- optional design panel -------------------------- */
function OptionalPanel({ theme, setTheme, compact }: { theme: DocTheme; setTheme: (t: DocTheme) => void; compact?: boolean }) {
  const wrap: React.CSSProperties = compact ? { display: "grid", gap: 12 } : { marginTop: 12, padding: 16, border: "1px solid var(--ezd-divider)", borderRadius: 12, background: "var(--ezd-bg-card)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 };
  return (
    <div style={wrap}>
      <Field label="Heading font"><div style={{ marginTop: 2 }}><FontPicker value={theme.headingFontId || theme.fontId} onChange={(id) => setTheme({ ...theme, headingFontId: id })} /></div></Field>
      <Field label="Page background"><select value={theme.bg} onChange={(e) => setTheme({ ...theme, bg: e.target.value })} style={sel(true)}>{[["#FFFFFF", "White"], ["#FBFAFF", "Soft lilac"], ["#FBF7EF", "Cream"], ["#F8FAFC", "Cool gray"], ["#FCFEFC", "Mint"]].map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>
      <Field label="Page pattern"><select value={theme.pattern} onChange={(e) => setTheme({ ...theme, pattern: e.target.value as DocTheme["pattern"] })} style={sel(true)}>{[["none", "None"], ["dots", "Dots"], ["grid", "Grid"], ["lines", "Lines"], ["diagonal", "Diagonal"]].map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>
      <Field label={`Line spacing · ${theme.lineHeight.toFixed(2)}`}><input type="range" min={1.2} max={2.2} step={0.1} value={theme.lineHeight} onChange={(e) => setTheme({ ...theme, lineHeight: Number(e.target.value) })} style={{ width: "100%", accentColor: ACC }} /></Field>
      <Field label={`Page margin · ${theme.marginIn}"`}><input type="range" min={0.5} max={1.5} step={0.1} value={theme.marginIn} onChange={(e) => setTheme({ ...theme, marginIn: Number(e.target.value) })} style={{ width: "100%", accentColor: ACC }} /></Field>
      <Toggle label="Cover header" on={theme.cover} onToggle={() => setTheme({ ...theme, cover: !theme.cover })} />
      <Toggle label="Justify text" on={theme.justify} onToggle={() => setTheme({ ...theme, justify: !theme.justify })} />
      <Toggle label="Page numbers (PDF)" on={theme.pageNumbers} onToggle={() => setTheme({ ...theme, pageNumbers: !theme.pageNumbers })} />
      <WatermarkField theme={theme} setTheme={setTheme} />
    </div>
  );
}

/** Background watermark / logo: upload, set opacity & size, replace or remove. */
function WatermarkField({ theme, setTheme }: { theme: DocTheme; setTheme: (t: DocTheme) => void }) {
  const wm = theme.watermark;
  const pick = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTheme({ ...theme, watermark: { url: String(reader.result), opacity: wm?.opacity ?? 0.12, size: wm?.size ?? 220 } });
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--ezd-divider)", paddingTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ezd-fg-quiet)", marginBottom: 8 }}>Background watermark / logo</div>
      {!wm?.url ? (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px dashed var(--ezd-divider)", borderRadius: 10, cursor: "pointer", fontSize: 13, color: "var(--ezd-fg-muted)" }}>
          <UploadCloud size={15} /> Upload a logo (PNG/JPG)
          <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} style={{ display: "none" }} />
        </label>
      ) : (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: 76, height: 76, borderRadius: 10, border: "1px solid var(--ezd-divider)", background: `#fff url(${wm.url}) center/contain no-repeat` }} />
          <div style={{ flex: 1, minWidth: 180, display: "grid", gap: 8 }}>
            <Field label={`Opacity · ${Math.round((wm.opacity ?? 0.12) * 100)}%`}><input type="range" min={0.03} max={0.5} step={0.01} value={wm.opacity ?? 0.12} onChange={(e) => setTheme({ ...theme, watermark: { ...wm, opacity: Number(e.target.value) } })} style={{ width: "100%", accentColor: ACC }} /></Field>
            <Field label={`Size · ${wm.size ?? 220}px`}><input type="range" min={80} max={500} step={10} value={wm.size ?? 220} onChange={(e) => setTheme({ ...theme, watermark: { ...wm, size: Number(e.target.value) } })} style={{ width: "100%", accentColor: ACC }} /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ fontSize: 12.5, color: ACC, cursor: "pointer" }}>Replace<input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} style={{ display: "none" }} /></label>
              <button onClick={() => setTheme({ ...theme, watermark: undefined })} style={{ fontSize: 12.5, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ image dialog ------------------------------ */
function ImageDialog({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
  const [q, setQ] = useState("");
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const search = async () => { if (!q.trim()) return; setLoading(true); try { setPhotos(await searchPexels(q, { perPage: 24 })); } catch { /* */ } finally { setLoading(false); } };
  const upload = (f?: File) => { if (!f) return; const r = new FileReader(); r.onload = () => onPick(String(r.result)); r.readAsDataURL(f); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(720px,95vw)", maxHeight: "85vh", overflow: "auto", background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", border: "1px solid var(--ezd-divider)", borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Add image</h3>
          <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: ACC, cursor: "pointer" }}>
            <UploadCloud size={14} /> Upload<input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <button onClick={onClose} style={{ color: "var(--ezd-fg-muted)", background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Search Pexels (e.g. office, nature)…"
            style={{ flex: 1, background: "var(--ezd-bg-hover)", border: "1px solid var(--ezd-divider)", borderRadius: 8, padding: "8px 11px", color: "var(--ezd-fg)", outline: "none" }} />
          <button onClick={search} disabled={loading} style={btn(loading)}>{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.src.medium} alt={p.alt} onClick={() => onPick(p.src.large)} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: "1px solid var(--ezd-divider)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- atoms ------------------------------- */
function TopBar() {
  return <div style={{ borderBottom: "1px solid var(--ezd-divider)" }}><div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo size="sm" href="/" /><Link href="/app" style={{ fontSize: 13, color: "var(--ezd-fg-muted)" }}>Back to app</Link></div></div>;
}

function patternPreview(pattern: string, accent: string): React.CSSProperties | null {
  switch (pattern) {
    case "dots": return { backgroundImage: `radial-gradient(${accent}22 1.2px, transparent 1.3px)`, backgroundSize: "14px 14px" };
    case "grid": return { backgroundImage: `linear-gradient(${accent}14 1px,transparent 1px),linear-gradient(90deg,${accent}14 1px,transparent 1px)`, backgroundSize: "18px 18px" };
    case "lines": return { backgroundImage: `repeating-linear-gradient(0deg,${accent}0f,${accent}0f 1px,transparent 1px,transparent 20px)` };
    case "diagonal": return { backgroundImage: `repeating-linear-gradient(45deg,${accent}0e,${accent}0e 1px,transparent 1px,transparent 12px)` };
    default: return null;
  }
}

function FontPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) loadDocFonts(DOC_FONTS.map((f) => f.id)); }, [open]);
  const cur = getDocFont(value);
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setOpen(false)}>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)} title="Font" style={{ ...sel(), minWidth: 130, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <span style={{ flex: 1, fontFamily: cur.family, textAlign: "left" }}>{cur.name}</span><span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: 36, left: 0, zIndex: 50, maxHeight: 320, overflow: "auto", background: "var(--ezd-bg-elev)", border: "1px solid var(--ezd-divider)", borderRadius: 10, padding: 4, minWidth: 210, boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>
          {DOC_FONTS.map((f) => (
            <button key={f.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(f.id); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: f.id === value ? "var(--ezd-bg-hover)" : "none", border: "none", color: "var(--ezd-fg)", fontFamily: f.family, fontSize: 15, cursor: "pointer", borderRadius: 6 }}>
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SizePicker({ value, onPick }: { value: number; onPick: (px: number) => void }) {
  const [open, setOpen] = useState(false);
  const opts = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40];
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setOpen(false)}>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)} title="Text size (px) — styles the selection, else the focused block" style={{ ...sel(), minWidth: 64, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
        <span style={{ flex: 1, textAlign: "left" }}>{value}px</span><span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: 36, left: 0, zIndex: 50, maxHeight: 280, overflow: "auto", background: "var(--ezd-bg-elev)", border: "1px solid var(--ezd-divider)", borderRadius: 10, padding: 4, minWidth: 80, boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>
          {opts.map((px) => (
            <button key={px} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(px); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: px === value ? "var(--ezd-bg-hover)" : "none", border: "none", color: "var(--ezd-fg)", fontSize: 14, cursor: "pointer", borderRadius: 6 }}>
              {px}px
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function AddBlockMenu({ onAdd }: { onAdd: (t: DocBlockType) => void }) {
  const [open, setOpen] = useState(false);
  const types: [DocBlockType, string][] = [["heading", "Heading"], ["paragraph", "Paragraph"], ["bullets", "Bullet list"], ["numbered", "Numbered list"], ["table", "Table"], ["quote", "Quote"], ["callout", "Callout"], ["divider", "Divider"]];
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setOpen(false)}>
      <TBtn onClick={() => setOpen((o) => !o)} title="Add block"><Plus size={15} /></TBtn>
      {open && (
        <div style={{ position: "absolute", top: 34, left: 0, background: "var(--ezd-bg-elev)", border: "1px solid var(--ezd-divider)", borderRadius: 10, padding: 4, zIndex: 30, minWidth: 150, boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>
          {types.map(([t, label]) => <button key={t} onClick={() => { onAdd(t); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", color: "var(--ezd-fg)", fontSize: 13, cursor: "pointer", borderRadius: 6 }}>{label}</button>)}
        </div>
      )}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, color: "var(--ezd-fg-quiet)" }}>{label}{children}</label>;
}
function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return <button onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: "var(--ezd-fg)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
    <span>{label}</span>
    <span style={{ width: 34, height: 20, borderRadius: 99, background: on ? ACC : "var(--ezd-bg-hover)", position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 99, background: "#fff", transition: "left .15s" }} />
    </span>
  </button>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)", fontSize: 14 }}>{children}</main>;
}
function TBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return <button title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 7, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)", cursor: "pointer" }}>{children}</button>;
}
const btn = (disabled: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 8, background: ACC, color: "var(--ezd-bg-page)", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13.5, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 });
const sel = (full?: boolean): React.CSSProperties => ({ background: "var(--ezd-bg-card)", border: "1px solid var(--ezd-divider)", borderRadius: 7, padding: "6px 8px", color: "var(--ezd-fg)", fontSize: 12.5, outline: "none", width: full ? "100%" : undefined });
