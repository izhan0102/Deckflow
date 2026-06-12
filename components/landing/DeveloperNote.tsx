"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Github, Linkedin, MapPin, GraduationCap, Sparkles } from "lucide-react";

export default function DeveloperNote() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Position the portal-based card relative to the button, anchored to its right edge.
  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    setPos({
      top: b.bottom + 8,
      right: Math.max(8, window.innerWidth - b.right),
    });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onResize = () => place();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  // Close on outside click and Esc.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (cardRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 transition hover:bg-white/10"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Sparkles size={11} className="text-white/70" />
        Developer's note
      </button>

      {mounted && open && createPortal(
        <div
          ref={cardRef}
          role="dialog"
          className="fade-in fixed w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-[0_30px_80px_-10px_rgba(0,0,0,0.7)] backdrop-blur"
          style={{ top: pos.top, right: pos.right, zIndex: 1000 }}
        >
          <div className="h-1 w-full" style={{ background: "var(--ezd-fg-strong)" }} />

          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full text-base font-semibold"
                   style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>
                MI
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Muhammad Izhan</div>
                <div className="text-xs text-white/55">Designer · Developer of EXdeck</div>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-white/75">
              Hey, I'm Izhan — built EXdeck because I wanted slides to stop feeling
              like work. If something here is broken or could be better, I'd genuinely
              love to hear it.
            </p>

            <ul className="mt-4 space-y-1.5 text-[12px] text-white/70">
              <li className="flex items-center gap-2">
                <MapPin size={12} className="text-white/40" />
                From Kashmir, India
              </li>
              <li className="flex items-center gap-2">
                <GraduationCap size={12} className="text-white/40" />
                B.E. Computer Science, RNS Institute of Technology, Bengaluru
              </li>
            </ul>

            <div className="mt-4 flex gap-2">
              <a
                href="https://www.linkedin.com/in/muhammad-izhan-a404752a6/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 transition hover:bg-white/10"
              >
                <Linkedin size={12} /> LinkedIn
              </a>
              <a
                href="https://github.com/izhan0102"
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 transition hover:bg-white/10"
              >
                <Github size={12} /> GitHub
              </a>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
