"use client";
import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2, Lock, Download, RotateCcw, FileCheck2, X } from "lucide-react";
import { getConverter } from "@/lib/converters";
import { downloadBlob, type ConvertResult, type ProgressCb } from "@/lib/convert";

/**
 * Generic converter UI: upload (accept/multiple from the registry) → run the
 * slug's conversion entirely in the browser → download the result. Resolves
 * the converter by slug client-side so the run function never crosses the
 * server/client boundary.
 */
export default function ConverterTool({ slug }: { slug: string }) {
  const conv = getConverter(slug);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; current?: number; total?: number } | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFiles([]); setResult(null); setErr(null); setProgress(null); };

  const onPick = useCallback((picked: FileList | File[] | null) => {
    if (!picked) return;
    const arr = Array.from(picked);
    if (!arr.length) return;
    setErr(null); setResult(null);
    setFiles((prev) => (conv?.multiple ? [...prev, ...arr] : [arr[0]]));
  }, [conv]);

  const run = async () => {
    if (!conv?.run || !files.length || busy) return;
    setBusy(true); setErr(null); setProgress(null);
    try {
      const onProgress: ProgressCb = (p) => setProgress(p);
      const res = await conv.run(files, onProgress);
      setResult(res);
      downloadBlob(res.blob, res.filename); // auto-download
    } catch (e: any) {
      setErr(e?.message || "Conversion failed. Please try a different file.");
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  if (!conv) return null;

  return (
    <div className="w-full">
      {result ? (
        <div className="flex flex-col items-center rounded-2xl border px-6 py-12 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><FileCheck2 size={26} /></div>
          <p className="mt-4 text-[16px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Done — your download is ready</p>
          <p className="mt-1 max-w-[280px] truncate text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>{result.filename}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => downloadBlob(result.blob, result.filename)} className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
              <Download size={15} /> Download
            </button>
            <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[13px] font-medium" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>
              <RotateCcw size={14} /> Convert another
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onPick(e.dataTransfer.files); }}
            onClick={() => !busy && inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition"
            style={{ borderColor: dragging ? "var(--ezd-fg-strong)" : "var(--ezd-divider)", background: dragging ? "var(--ezd-bg-hover)" : "var(--ezd-bg-card)" }}
          >
            <input
              ref={inputRef} type="file" accept={conv.accept} multiple={conv.multiple} className="hidden"
              onChange={(e) => { onPick(e.target.files); e.currentTarget.value = ""; }}
            />
            <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}><UploadCloud size={24} /></div>
            <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
              {conv.multiple ? "Drop files here, or click to choose" : "Drop a file here, or click to choose"}
            </p>
            {conv.note && <p className="mt-1 text-[12.5px]" style={{ color: "var(--ezd-fg-muted)" }}>{conv.note}</p>}
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>
              <Lock size={11} /> 100% private — your files never leave your device.
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border px-3 py-2 text-[13px]" style={{ borderColor: "var(--ezd-divider)" }}>
                  <span className="truncate" style={{ color: "var(--ezd-fg-strong)" }}>{f.name}</span>
                  <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label="Remove" style={{ color: "var(--ezd-fg-quiet)" }}><X size={15} /></button>
                </div>
              ))}
              <button
                onClick={run} disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-semibold transition hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
              >
                {busy
                  ? <><Loader2 size={16} className="animate-spin" /> {progress ? `${progress.phase}${progress.total ? ` ${progress.current}/${progress.total}` : "…"}` : "Converting…"}</>
                  : <>Convert{conv.multiple && files.length > 1 ? ` ${files.length} files` : ""}</>}
              </button>
            </div>
          )}
          {err && <p className="mt-3 text-center text-[13px]" style={{ color: "#ef4444" }}>{err}</p>}
        </>
      )}
    </div>
  );
}
