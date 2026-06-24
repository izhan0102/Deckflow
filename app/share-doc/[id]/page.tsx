"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, Check, FileDown, Eye, Pencil, Sparkles, Loader2, Link as LinkIcon } from "lucide-react";
import Logo from "@/components/Logo";
import DocCanvas from "@/components/DocCanvas";
import { blockId, type ExDoc, type DocBlock } from "@/lib/docTypes";
import { watchSharedDoc, writeSharedDoc, type DocShareMode } from "@/lib/docShare";
import { exportDocNodeToPdf } from "@/lib/docPdf";

/**
 * Shared document viewer. Read-only ("view") shows a live A4 preview;
 * read-write ("edit") lets anyone with the link edit, with changes synced
 * back live. Both can download a PDF.
 */
export default function SharedDocViewer({ params }: { params: { id: string } }) {
  const [data, setData] = useState<{ doc: ExDoc; mode: DocShareMode; title: string } | null>(null);
  const [missing, setMissing] = useState(false);
  const [editDoc, setEditDoc] = useState<ExDoc | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const seededRef = useRef(false);
  const printRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = watchSharedDoc(params.id, (result) => {
      if (!result) { setMissing(true); return; }
      setMissing(false);
      setData({ doc: result.doc, mode: result.mode, title: result.title });
      if (result.mode === "edit" && !seededRef.current) {
        seededRef.current = true;
        setEditDoc(result.doc);
      }
    });
    return () => unsub();
  }, [params.id]);

  // Debounced write-back for edit mode.
  const pushEdit = useCallback((next: ExDoc) => {
    setEditDoc(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { writeSharedDoc(params.id, next).catch(() => {}); }, 700);
  }, [params.id]);

  const mode = data?.mode ?? "view";
  const current = mode === "edit" ? (editDoc ?? data?.doc) : data?.doc;

  /* ---- edit handlers (only used in edit mode) ---- */
  const mutateBlocks = (fn: (blocks: DocBlock[]) => DocBlock[]) => {
    if (!current) return;
    pushEdit({ ...current, blocks: fn(current.blocks) });
  };
  const onUpdate = (id: string, patch: Partial<DocBlock>) => mutateBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } as DocBlock : b)));
  const onMove = (id: string, dir: -1 | 1) => mutateBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === id); if (i < 0) return bs;
    const j = i + dir; if (j < 0 || j >= bs.length) return bs;
    const copy = [...bs]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });
  const onDelete = (id: string) => mutateBlocks((bs) => bs.filter((b) => b.id !== id));
  const onAddAfter = (id: string) => mutateBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === id);
    const nb: DocBlock = { id: blockId(), type: "paragraph", text: "" } as DocBlock;
    const copy = [...bs]; copy.splice(i < 0 ? bs.length : i + 1, 0, nb); return copy;
  });
  const onReorder = (fromId: string, toId: string) => mutateBlocks((bs) => {
    const from = bs.findIndex((b) => b.id === fromId); const to = bs.findIndex((b) => b.id === toId);
    if (from < 0 || to < 0) return bs;
    const copy = [...bs]; const [m] = copy.splice(from, 1); copy.splice(to, 0, m); return copy;
  });
  const onTitle = (v: string) => current && pushEdit({ ...current, title: v });
  const onSubtitle = (v: string) => current && pushEdit({ ...current, subtitle: v });

  const onCopyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };
  const onExport = async () => {
    if (!printRef.current || exporting) return;
    setExporting(true);
    try {
      const node = printRef.current.querySelector<HTMLElement>("[data-doc-page]") || printRef.current;
      await exportDocNodeToPdf(node, `${(current?.title || "document").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
    } catch { /* ignore */ }
    setExporting(false);
  };

  if (missing) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
        <div className="max-w-md">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
            <LinkIcon size={18} style={{ color: "var(--ezd-fg-quiet)" }} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Document not found</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>This link may have been taken down by the owner, or it never existed.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>Go to EXdeck</Link>
        </div>
      </main>
    );
  }

  if (!current) {
    return <main className="grid min-h-screen place-items-center text-sm" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)" }}>Loading…</main>;
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-nav-bg)" }}>
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size="sm" href="/" />
            <span className="hidden sm:inline" style={{ color: "var(--ezd-divider)" }}>|</span>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-[13px] font-semibold leading-tight" style={{ color: "var(--ezd-fg-strong)" }}>{current.title || "Untitled document"}</div>
              <div className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)" }}>
                {mode === "edit" ? <><Pencil size={10} /> Shared · can edit</> : <><Eye size={10} /> Shared · read-only</>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onCopyLink} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)" }}>
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}<span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
            </button>
            <button onClick={onExport} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-60" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}<span className="hidden sm:inline">{exporting ? "PDF…" : "Download PDF"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Preview */}
      <div style={{ overflow: "auto", padding: "28px 16px", background: "var(--ezd-bg-page-deep, #0a0a0a)" }}>
        <DocCanvas
          doc={current}
          editable={mode === "edit"}
          onUpdate={onUpdate} onMove={onMove} onDelete={onDelete} onAddAfter={onAddAfter}
          onTitle={onTitle} onSubtitle={onSubtitle} onReorder={onReorder}
        />
      </div>

      {/* Hidden print node for PDF capture */}
      <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}>
        <div ref={printRef}><DocCanvas doc={current} editable={false} print /></div>
      </div>

      {/* CTA cap */}
      <section className="border-t" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-3 px-6 py-6 text-center sm:flex-row sm:text-left">
          <span className="inline-flex items-center gap-2 text-[12.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
            <Sparkles size={14} /> Made with <Link href="/" className="font-semibold underline-offset-4 hover:underline" style={{ color: "var(--ezd-fg-strong)" }}>EXdeck</Link> — the AI document maker.
          </span>
          <Link href="/docs" className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[12.5px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>Make your own</Link>
        </div>
      </section>
    </main>
  );
}
