"use client";
import { useEffect, useRef, useState } from "react";
import type { Deck, Slide } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { Send, Sparkles } from "lucide-react";
import { getIdToken } from "@/lib/auth";

/**
 * Minimal AI editor for the active slide. No chat history, no quick-action
 * chips, no description. Just a single input with a rotating placeholder
 * that demonstrates what the user can type.
 *
 * The model still receives full deck context server-side; we just don't
 * advertise that in the UI anymore.
 */

const PLACEHOLDER_EXAMPLES = [
  "Make the title bigger",
  "Shorten the bullets",
  "Match the other slides' background",
  "Use a serif font",
  "Add a point about ROI",
  "Remove the last bullet",
  "Add a chart on the right",
  "Make the bullets numbered",
  "Add a rocket icon top-right",
  "Move the title to the bottom",
];

export default function SlideChat({
  deck,
  theme,
  slideIndex,
  slideKey,
  onApply,
}: {
  deck: Deck;
  theme: Theme;
  slideIndex: number;
  slideKey: string;
  onApply: (next: Slide) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [phIdx, setPhIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on slide change.
  useEffect(() => {
    setInput("");
    setFeedback(null);
  }, [slideKey]);

  // Rotate the placeholder every 2.5s while the input is empty + unfocused.
  useEffect(() => {
    const id = window.setInterval(() => {
      setPhIdx((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  // Auto-clear feedback after 3 seconds.
  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setLoading(true);
    setFeedback(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/edit-slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deck, theme, slideIndex, instruction: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Edit failed");
      onApply(data.slide);
      setFeedback({ kind: "ok", text: data.explanation || "Done." });
    } catch (e: any) {
      setFeedback({ kind: "err", text: e?.message || "Couldn't apply that." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Sparkles
            size={12}
            className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
              loading ? "animate-pulse text-cyan-300" : "text-white/40"
            }`}
          />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={loading ? "Thinking…" : `Try: ${PLACEHOLDER_EXAMPLES[phIdx]}`}
            disabled={loading}
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs outline-none transition focus:border-white/30 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={12} />
        </button>
      </form>

      {feedback && (
        <div
          className={`rounded-lg border px-3 py-1.5 text-[11px] ${
            feedback.kind === "ok"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
