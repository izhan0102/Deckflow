"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileText, Presentation } from "lucide-react";
import type { ExportFormat } from "./ExportFormatPicker";

export default function ExportButton({
  onExport, busy,
}: {
  onExport: (format: ExportFormat) => void | Promise<void>;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = async (f: ExportFormat) => {
    setOpen(false);
    await onExport(f);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} />
        {busy ? "Building…" : "Export"}
      </button>

      {open && !busy && (
        <div
          role="menu"
          className="fade-in absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 p-1 text-sm shadow-2xl backdrop-blur"
        >
          <Row icon={<Presentation size={14} className="text-white/70" />} label=".pptx"
               sub="PowerPoint, Keynote, Slides"
               onClick={() => pick("pptx")} />
          <Row icon={<FileText size={14} className="text-white/70" />} label=".pdf"
               sub="Locked layout for sharing"
               onClick={() => pick("pdf")} />
        </div>
      )}
    </div>
  );
}

function Row({
  icon, label, sub, onClick,
}: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
    >
      <span className="mt-0.5">{icon}</span>
      <span>
        <span className="block text-white">{label}</span>
        <span className="block text-[11px] text-white/50">{sub}</span>
      </span>
    </button>
  );
}
