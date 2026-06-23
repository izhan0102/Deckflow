"use client";
import { Type, Image as ImageIcon, Images, BarChart3, NotebookText, MessageCircleQuestion, Languages, Palette, Grid3x3, Lock, Loader2, Sparkles } from "lucide-react";

type Props = {
  placingText?: boolean;
  notesLabel: string;
  notesLoading?: boolean;
  translating?: boolean;
  translateLocked?: boolean;
  qaLocked?: boolean;
  aiActive?: boolean;
  onToggleAi: () => void;
  onStartPlaceText: () => void;
  onAddImage: () => void;
  onAddPhoto: () => void;
  onAddVisuals: () => void;
  onGenerateNotes: () => void;
  onQAPrep: () => void;
  onTranslate: () => void;
  onOpenTheme: () => void;
  onOpenPattern: () => void;
};

/**
 * Floating dock-style toolbar pinned to the bottom-center of the editor.
 * Items magnify and lift on hover (smooth, transform-only so dragging across
 * them never stutters), with a label tooltip above. Replaces the old right
 * insert sidebar for quick insert/AI actions.
 */
export default function BottomBar(p: Props) {
  const items: { key: string; Icon: any; label: string; onClick: () => void; active?: boolean; busy?: boolean; locked?: boolean }[] = [
    { key: "text", Icon: Type, label: p.placingText ? "Click the slide…" : "Add text", onClick: p.onStartPlaceText, active: p.placingText },
    { key: "image", Icon: ImageIcon, label: "Add image", onClick: p.onAddImage },
    { key: "photo", Icon: Images, label: "Stock photo", onClick: p.onAddPhoto },
    { key: "visuals", Icon: BarChart3, label: "Add chart / visual", onClick: p.onAddVisuals },
    { key: "notes", Icon: NotebookText, label: p.notesLabel, onClick: p.onGenerateNotes, busy: p.notesLoading },
    { key: "qa", Icon: MessageCircleQuestion, label: "Prep for Q&A", onClick: p.onQAPrep, locked: p.qaLocked },
    { key: "translate", Icon: Languages, label: p.translating ? "Translating…" : "Translate deck", onClick: p.onTranslate, locked: p.translateLocked, busy: p.translating },
    { key: "theme", Icon: Palette, label: "Theme & colors", onClick: p.onOpenTheme },
    { key: "pattern", Icon: Grid3x3, label: "Background pattern", onClick: p.onOpenPattern },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-3" style={{ touchAction: "manipulation" }}>
      <div
        className="pointer-events-auto flex items-end gap-1 rounded-2xl border px-2.5 py-2 shadow-2xl backdrop-blur-md"
        style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-nav-bg)" }}
      >
        <button
          onClick={p.onToggleAi}
          aria-label="Ask AI"
          className="group relative flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-[transform] duration-200 ease-[cubic-bezier(.2,.85,.3,1)] will-change-transform hover:-translate-y-3 hover:scale-[1.15]"
          style={{ transformOrigin: "bottom center", background: p.aiActive ? "var(--ezd-button-strong)" : "var(--ezd-bg-hover)", color: p.aiActive ? "var(--ezd-button-strong-fg)" : "var(--ezd-fg-strong)" }}
        >
          <Sparkles size={16} /> AI
          <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>{p.aiActive ? "Hide AI chat" : "Ask AI to edit"}</span>
        </button>
        <span className="mx-1 h-7 w-px self-center" style={{ background: "var(--ezd-divider)" }} />
        {items.map((it) => (
          <button
            key={it.key}
            onClick={it.onClick}
            aria-label={it.label}
            className="group relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-[transform] duration-200 ease-[cubic-bezier(.2,.85,.3,1)] will-change-transform hover:-translate-y-3 hover:scale-[1.4]"
            style={{
              transformOrigin: "bottom center",
              color: it.active ? "var(--ezd-button-strong-fg)" : "var(--ezd-fg-strong)",
              background: it.active ? "var(--ezd-button-strong)" : "var(--ezd-bg-hover)",
            }}
          >
            {it.busy ? <Loader2 size={18} className="animate-spin" /> : <it.Icon size={18} />}
            {it.locked && (
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full ring-2" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)", ["--tw-ring-color" as any]: "var(--ezd-nav-bg)" }}>
                <Lock size={9} />
              </span>
            )}
            <span
              className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
              style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}
            >
              {it.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
