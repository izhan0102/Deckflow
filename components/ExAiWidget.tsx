"use client";
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import ExAiChat from "./ExAiChat";

/**
 * Floating EX-AI launcher for the dashboard. A small fixed button in the
 * bottom-left opens EX-AI as a compact popup chat (not a full page).
 * Reuses <ExAiChat embedded /> so the chat logic stays in one place.
 */
export default function ExAiWidget() {
  const [open, setOpen] = useState(false);

  // Close on Escape while the popup is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Ask EX-AI"
          className="fixed bottom-24 right-5 z-40 flex w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{ height: "min(70vh, 560px)", borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-page)" }}
        >
          <ExAiChat embedded onClose={() => setOpen(false)} />
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close EX-AI" : "Ask EX-AI"}
        title={open ? "Close EX-AI" : "Ask EX-AI"}
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full shadow-lg transition hover:scale-105 active:scale-95"
        style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
      >
        {open ? <X size={22} /> : <Sparkles size={24} />}
      </button>
    </>
  );
}
