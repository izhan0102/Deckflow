"use client";
import { useEffect, useRef, useState } from "react";
import type { Deck, Slide } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { MessageSquare, Send, Sparkles } from "lucide-react";

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string };

const QUICK_ACTIONS = [
  "Make title bigger",
  "Shorter bullets",
  "Match other slides background",
  "Use serif font",
  "Add a point about ROI",
  "Remove the last bullet",
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [slideKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/edit-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck, theme, slideIndex, instruction: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Edit failed");
      onApply(data.slide);
      setMessages((m) => [...m, { role: "assistant", text: data.explanation || "Done." }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: `Couldn't apply that — ${e.message || "error"}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
        <MessageSquare size={12} /> Edit with AI
      </div>

      <div
        ref={scrollRef}
        className="mb-2 max-h-[180px] min-h-[60px] overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2 text-xs"
      >
        {messages.length === 0 && !loading && (
          <p className="text-white/40">
            Ask in natural language. The editor knows the deck topic, theme colors, and all slide titles.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`mb-1.5 ${m.role === "user" ? "text-white/90" : "text-emerald-300"}`}>
            <span className="mr-1 font-semibold opacity-70">
              {m.role === "user" ? "You:" : "AI:"}
            </span>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="text-emerald-300/70">
            <Sparkles size={10} className="mr-1 inline animate-pulse" /> Thinking…
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {QUICK_ACTIONS.map((q) => (
          <button
            key={q}
            onClick={() => submit(q)}
            disabled={loading}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/10 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me what to change…"
          disabled={loading}
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-white/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
