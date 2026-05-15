"use client";
import { FileText, Presentation } from "lucide-react";

export type ExportFormat = "pptx" | "pdf";

export default function ExportFormatPicker({
  onPick, disabled,
}: { onPick: (f: ExportFormat) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Choice
        title=".pptx"
        sub="Editable in PowerPoint, Keynote, Google Slides"
        icon={<Presentation size={18} className="text-amber-300" />}
        onClick={() => onPick("pptx")}
        disabled={disabled}
      />
      <Choice
        title=".pdf"
        sub="Locked layout for sharing or printing"
        icon={<FileText size={18} className="text-amber-300" />}
        onClick={() => onPick("pdf")}
        disabled={disabled}
      />
    </div>
  );
}

function Choice({
  title, sub, icon, onClick, disabled,
}: { title: string; sub: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-amber-300/40 hover:bg-amber-300/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-300/10">
        {icon}
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="text-[11px] text-white/55">{sub}</div>
    </button>
  );
}
