"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, Presentation, NotebookText, Lock, Loader2 } from "lucide-react";
import type { ExportFormat } from "./ExportFormatPicker";

export default function ExportButton({
  onExport, busy, handoutLocked = false,
}: {
  onExport: (format: ExportFormat) => void | Promise<void>;
  busy?: boolean;
  handoutLocked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Anchor the (portaled, fixed) menu to the button so it can't get
  // clipped by the toolbar's horizontal overflow.
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onReflow = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const pick = async (f: ExportFormat) => {
    if (busy || exporting) return;
    setExporting(f);
    setOpen(false);
    try {
      await onExport(f);
    } finally {
      setExporting(null);
    }
  };

  const isExporting = busy || !!exporting;

  // Get dynamic loading text based on format
  const getLoadingText = () => {
    if (exporting === "pptx") return "Generating PowerPoint…";
    if (exporting === "pdf") return "Generating PDF…";
    if (exporting === "handout") return "Generating handout…";
    return "Exporting…";
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        disabled={isExporting}
        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ touchAction: "manipulation", minHeight: "44px" }}
        title={isExporting ? "Exporting…" : "Export presentation"}
      >
        {isExporting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {getLoadingText()}
          </>
        ) : (
          <>
            <Download size={14} />
            Export
          </>
        )}
      </button>

      {mounted && open && !isExporting && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="fade-in z-[120] w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 p-1 text-sm shadow-2xl backdrop-blur"
        >
          <Row 
            icon={<Presentation size={14} className="text-white/70" />} 
            label=".pptx"
            sub="PowerPoint, Keynote, Slides"
            onClick={() => pick("pptx")} 
          />
          <Row 
            icon={<FileText size={14} className="text-white/70" />} 
            label=".pdf"
            sub="Locked layout for sharing"
            onClick={() => pick("pdf")} 
          />
          <Row 
            icon={<NotebookText size={14} className="text-white/70" />} 
            label="Notes handout"
            sub="Slides with speaker notes (PDF)"
            trailing={handoutLocked ? <Lock size={12} className="text-white/40" /> : undefined}
            onClick={() => pick("handout")} 
          />
        </div>,
        document.body,
      )}
    </>
  );
}

function Row({
  icon, label, sub, onClick, trailing,
}: { icon: React.ReactNode; label: string; sub: string; onClick: () => void; trailing?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
      style={{ touchAction: "manipulation", minHeight: "40px" }}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="flex-1">
        <span className="block text-white">{label}</span>
        <span className="block text-[11px] text-white/50">{sub}</span>
      </span>
      {trailing && <span className="mt-0.5">{trailing}</span>}
    </button>
  );
}