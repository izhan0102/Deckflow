"use client";
import { useRef, useState } from "react";
import { UploadCloud, Loader2, Lock, Download, RotateCcw, RotateCw, Trash2, ArrowLeft, ArrowRight, FileCheck2 } from "lucide-react";
import { pdfPageThumbnails, rebuildPdf, downloadBlob } from "@/lib/convert";

type Page = { key: number; origIndex: number; thumb: string; rotate: number };

/** Interactive "Organize PDF": reorder, rotate, and delete pages, then rebuild. */
export default function OrganizePdf() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ blob: Blob; filename: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFile(null); setPages([]); setDone(null); setErr(null); };

  const load = async (f: File) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) { setErr("Please choose a PDF."); return; }
    setErr(null); setDone(null); setFile(f); setLoading(true); setPages([]);
    try {
      const thumbs = await pdfPageThumbnails(f);
      setPages(thumbs.map((thumb, i) => ({ key: i, origIndex: i, thumb, rotate: 0 })));
    } catch (e: any) {
      setErr(e?.message || "Couldn't read that PDF."); setFile(null);
    } finally { setLoading(false); }
  };

  const move = (i: number, dir: -1 | 1) => setPages((p) => {
    const j = i + dir; if (j < 0 || j >= p.length) return p;
    const next = [...p]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const rotate = (i: number) => setPages((p) => p.map((pg, idx) => idx === i ? { ...pg, rotate: (pg.rotate + 90) % 360 } : pg));
  const remove = (i: number) => setPages((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!file || !pages.length || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await rebuildPdf(file, pages.map((p) => ({ index: p.origIndex, rotate: p.rotate })));
      setDone(res);
      downloadBlob(res.blob, res.filename);
    } catch (e: any) {
      setErr(e?.message || "Couldn't build the PDF.");
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center rounded-2xl border px-6 py-12 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
        <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><FileCheck2 size={26} /></div>
        <p className="mt-4 text-[16px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Done — your organized PDF is ready</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => downloadBlob(done.blob, done.filename)} className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}><Download size={15} /> Download</button>
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[13px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}><RotateCcw size={14} /> Start over</button>
        </div>
      </div>
    );
  }

  if (!file || (!pages.length && !loading)) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) load(f); }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition"
        style={{ borderColor: dragging ? "var(--ezd-fg-strong)" : "var(--ezd-divider)", background: dragging ? "var(--ezd-bg-hover)" : "var(--ezd-bg-card)" }}
      >
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.currentTarget.value = ""; }} />
        <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><UploadCloud size={24} /></div>
        <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Drop a PDF here, or click to choose</p>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--ezd-fg-muted)" }}>Reorder, rotate, or delete its pages, then download.</p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ezd-fg-quiet)" }}><Lock size={11} /> 100% private — your file never leaves your device.</p>
        {err && <p className="mt-3 text-[13px]" style={{ color: "#ef4444" }}>{err}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center rounded-2xl border px-6 py-16 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
        <Loader2 size={30} className="animate-spin" style={{ color: "var(--ezd-fg-strong)" }} />
        <p className="mt-3 text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>Rendering pages…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13.5px]" style={{ color: "var(--ezd-fg-muted)" }}>{pages.length} page{pages.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}><RotateCcw size={14} /> New PDF</button>
          <button onClick={save} disabled={busy || !pages.length} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[14px] font-semibold disabled:opacity-60" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            {busy ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Download size={15} /> Download PDF</>}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {pages.map((pg, i) => (
          <div key={pg.key} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
            <div className="relative grid aspect-[3/4] place-items-center overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pg.thumb} alt={`Page ${i + 1}`} className="max-h-full max-w-full transition-transform" style={{ transform: `rotate(${pg.rotate}deg)` }} />
              <span className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: "rgba(0,0,0,0.6)" }}>{i + 1}</span>
            </div>
            <div className="flex items-center justify-between gap-1 px-1.5 py-1.5">
              <button onClick={() => move(i, -1)} disabled={i === 0} title="Move left" className="grid h-7 w-7 place-items-center rounded-md disabled:opacity-30" style={{ color: "var(--ezd-fg-muted)" }}><ArrowLeft size={14} /></button>
              <button onClick={() => rotate(i)} title="Rotate" className="grid h-7 w-7 place-items-center rounded-md" style={{ color: "var(--ezd-fg-muted)" }}><RotateCw size={14} /></button>
              <button onClick={() => remove(i)} title="Delete" className="grid h-7 w-7 place-items-center rounded-md" style={{ color: "#ef4444" }}><Trash2 size={14} /></button>
              <button onClick={() => move(i, 1)} disabled={i === pages.length - 1} title="Move right" className="grid h-7 w-7 place-items-center rounded-md disabled:opacity-30" style={{ color: "var(--ezd-fg-muted)" }}><ArrowRight size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {err && <p className="mt-3 text-center text-[13px]" style={{ color: "#ef4444" }}>{err}</p>}
    </div>
  );
}
