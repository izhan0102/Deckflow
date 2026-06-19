"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileText, Play, X, ChevronLeft, ChevronRight, Maximize2, Loader2, Lock, RotateCcw } from "lucide-react";
import { renderPdfToImages, type CancelToken } from "@/lib/pdfRender";

/**
 * PDF-to-PPT presenter. Upload a PDF, each page becomes a full-screen slide
 * with PowerPoint-style controls. Everything runs locally in the browser.
 */
export default function PdfPresenter() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [active, setActive] = useState(0);
  const cancelRef = useRef<CancelToken | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (cancelRef.current) cancelRef.current.cancelled = true;
    setFileName(null); setPages([]); setBusy(false); setProgress(null); setErr(null); setActive(0);
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErr("Please choose a PDF file."); return;
    }
    setErr(null); setPages([]); setActive(0); setFileName(file.name); setBusy(true); setProgress({ page: 0, total: 0 });
    const token: CancelToken = { cancelled: false };
    cancelRef.current = token;
    try {
      const { pages: imgs } = await renderPdfToImages(file, (p) => setProgress(p), token);
      if (token.cancelled) return;
      if (!imgs.length) { setErr("Couldn't read any pages from that PDF."); setFileName(null); }
      else setPages(imgs);
    } catch (e: any) {
      setErr(e?.message || "Failed to read the PDF.");
      setFileName(null);
    } finally {
      if (!token.cancelled) { setBusy(false); setProgress(null); }
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  /* ---------------------------------- upload / grid view --------------------------------- */
  if (!presenting) {
    return (
      <div className="w-full">
        {pages.length === 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !busy && inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition"
            style={{ borderColor: dragging ? "var(--ezd-fg-strong)" : "var(--ezd-divider)", background: dragging ? "var(--ezd-bg-hover)" : "var(--ezd-bg-card)" }}
          >
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }} />
            {busy ? (
              <>
                <Loader2 size={34} className="animate-spin" style={{ color: "var(--ezd-fg-strong)" }} />
                <p className="mt-4 text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Preparing your slides…</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
                  {progress && progress.total ? `Rendering page ${progress.page} of ${progress.total}` : "Reading the PDF"}
                </p>
                <button onClick={(e) => { e.stopPropagation(); reset(); }} className="mt-4 text-[12.5px] underline" style={{ color: "var(--ezd-fg-quiet)" }}>Cancel</button>
              </>
            ) : (
              <>
                <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><UploadCloud size={26} /></div>
                <p className="mt-4 text-[16px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Drop a PDF here, or click to upload</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>Each page becomes a full-screen slide. No PowerPoint needed.</p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>
                  <Lock size={12} /> Your file stays on your device — nothing is uploaded.
                </p>
              </>
            )}
            {err && <p className="mt-4 text-[13px]" style={{ color: "#ef4444" }}>{err}</p>}
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
                <FileText size={16} style={{ color: "var(--ezd-fg-strong)" }} />
                <span className="max-w-[220px] truncate font-medium" style={{ color: "var(--ezd-fg-strong)" }}>{fileName}</span>
                <span>· {pages.length} {pages.length === 1 ? "slide" : "slides"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>
                  <RotateCcw size={14} /> New PDF
                </button>
                <button onClick={() => { setActive(0); setPresenting(true); }} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[14px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
                  <Play size={15} /> Start presenting
                </button>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {pages.map((src, i) => (
                <button key={i} onClick={() => { setActive(i); setPresenting(true); }} className="group relative overflow-hidden rounded-lg border text-left" style={{ borderColor: "var(--ezd-divider)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Page ${i + 1}`} className="block w-full bg-white" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: "rgba(0,0,0,0.6)" }}>{i + 1}</span>
                  <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                    <Play size={22} className="text-white" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------- present mode ------------------------------------ */
  return <Stage pages={pages} start={active} onClose={() => setPresenting(false)} />;
}

/* ======================================================================== */

function Stage({ pages, start, onClose }: { pages: string[]; start: number; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const idleRef = useRef<number | null>(null);
  const [i, setI] = useState(start);
  const [controls, setControls] = useState(true);
  const total = pages.length;

  const next = useCallback(() => setI((v) => Math.min(v + 1, total - 1)), [total]);
  const prev = useCallback(() => setI((v) => Math.max(v - 1, 0)), []);

  const bump = useCallback(() => {
    setControls(true);
    if (idleRef.current) window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => setControls(false), 2500);
  }, []);

  const exitFullscreen = () => {
    const ex = (document as any).exitFullscreen || (document as any).webkitExitFullscreen;
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) { try { ex?.call(document); } catch {} }
  };

  const toggleFullscreen = () => {
    const el = rootRef.current; if (!el) return;
    const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fs) { exitFullscreen(); return; }
    const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen;
    if (req) { try { const p = req.call(el); if (p?.catch) p.catch(() => {}); } catch {} }
  };

  // Enter fullscreen + focus on mount.
  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen;
    if (req) { try { const p = req.call(el); if (p?.catch) p.catch(() => {}); } catch {} }
    el.focus();
    bump();
    return () => { if (idleRef.current) window.clearTimeout(idleRef.current); };
  }, [bump]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      bump();
      switch (e.key) {
        case "ArrowRight": case " ": case "PageDown": case "ArrowDown": e.preventDefault(); next(); break;
        case "ArrowLeft": case "PageUp": case "ArrowUp": e.preventDefault(); prev(); break;
        case "Home": e.preventDefault(); setI(0); break;
        case "End": e.preventDefault(); setI(total - 1); break;
        case "f": case "F": toggleFullscreen(); break;
        case "Escape":
          if (document.fullscreenElement || (document as any).webkitFullscreenElement) { exitFullscreen(); }
          onClose();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, prev, total, bump]);

  return (
    <div
      ref={rootRef} tabIndex={-1}
      onMouseMove={bump}
      className="fixed inset-0 z-[200] flex items-center justify-center outline-none"
      style={{ background: "#000" }}
    >
      {/* click zones: left third = prev, rest = next */}
      <button aria-label="Previous slide" onClick={prev} className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default" />
      <button aria-label="Next slide" onClick={next} className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-default" />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pages[i]} alt={`Slide ${i + 1}`} className="max-h-screen max-w-full select-none object-contain" draggable={false} />

      {/* top bar */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 transition-opacity duration-300 ${controls ? "opacity-100" : "opacity-0"}`}>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-medium text-white backdrop-blur">{i + 1} / {total}</span>
        <button onClick={onClose} className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20" aria-label="Exit (Esc)"><X size={18} /></button>
      </div>

      {/* bottom controls */}
      <div className={`absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 px-4 py-4 transition-opacity duration-300 ${controls ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur">
          <button onClick={prev} disabled={i === 0} className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-30" aria-label="Previous"><ChevronLeft size={20} /></button>
          <button onClick={next} disabled={i === total - 1} className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-30" aria-label="Next"><ChevronRight size={20} /></button>
          <span className="mx-1 h-5 w-px bg-white/20" />
          <button onClick={toggleFullscreen} className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/20" aria-label="Fullscreen (F)"><Maximize2 size={17} /></button>
        </div>
      </div>
    </div>
  );
}
