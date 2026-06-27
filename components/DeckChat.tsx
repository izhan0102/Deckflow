"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, Loader2, Sparkles, X, CheckCircle2, ChevronRight,
  CornerDownRight, Layers, FileEdit,
} from "lucide-react";
import type { Deck, Slide } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { getIdToken } from "@/lib/auth";

/**
 * Unified AI editor for the deck.
 *
 * Sits inline below the slide canvas. Replaces the old SlideChat and
 * the floating "Ask the AI" panel — one surface, smart routing.
 *
 * UX shape:
 *   - Sticky pill input that always knows the active slide.
 *   - Scope toggle on the left: "This slide" (default) vs "Whole deck".
 *     The AI is told the scope and routes to the right endpoint:
 *       /api/edit-slide  for single-slide edits
 *       /api/edit-deck   for whole-deck operations (add, remove,
 *                        reorder, restructure)
 *   - Auto-detect: if the user types "deck-wide" language ("every
 *     slide", "reorder", "add a slide"), we silently flip the scope to
 *     "Whole deck" before sending. Visible in the chip so the user
 *     can override.
 *   - Suggestion chips below the input change based on the active
 *     slide's layout (a quote slide gets quote-specific suggestions,
 *     a bullets slide gets bullet ones, etc.).
 *   - Recent history shown above the input as compact rows. Click any
 *     past prompt to re-run it. No timestamps, no avatars, nothing
 *     that screams "support chat."
 */


type Scope = "slide" | "deck";

type Turn = {
  id: string;
  user: string;
  scope: Scope;
  status: "pending" | "success" | "error";
  explanation?: string;
  errorMsg?: string;
};

const SLIDE_SUGGESTIONS_BY_LAYOUT: Record<string, string[]> = {
  "title-hero": [
    "Make the title punchier",
    "Add a kicker line",
    "Use a serif font",
  ],
  bullets: [
    "Shorten every bullet",
    "Add a point about ROI",
    "Remove the last bullet",
  ],
  "two-column": [
    "Balance the two columns",
    "Switch to a numbered list",
    "Add a divider style",
  ],
  table: [
    "Add a row for last quarter",
    "Make the header bolder",
    "Switch to compact rows",
  ],
  quote: [
    "Bigger quote marks",
    "Add the speaker's title",
    "Use editorial layout",
  ],
  section: [
    "Add a kicker number",
    "Make the title shorter",
  ],
  closing: [
    "Switch to Q&A style",
    "Add a contact line",
    "Make it a signature",
  ],
  references: [
    "Use a numbered style",
    "Sort by year",
  ],
};

const DECK_SUGGESTIONS = [
  "Add a Q&A slide before closing",
  "Make every bullet shorter",
  "Reorder so the strongest argument is first",
  "Insert a competitive landscape section",
  "Add three more slides about pricing",
  "Replace slide 3 with a pull quote",
];

/** Heuristic: does the instruction sound deck-wide? */
function detectScope(text: string): Scope | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  // Hard signals for deck scope.
  const deckSignals = [
    /\b(reorder|rearrange|move slide|move the .* slide)\b/,
    /\b(add (a |an )?slide)\b/,
    /\b(insert (a |an )?slide)\b/,
    /\b(remove (slide|the))\b/,
    /\b(delete slide)\b/,
    /\b(every|each|all) (slide|bullet)/,
    /\b(whole|entire) deck\b/,
    /\bsection\b/,
    /\b(slide \d+|first slide|last slide)\b/,
    /\b(rename the deck|deck title)\b/,
    /\b(diagram|flowchart|mind ?map|sequence diagram|org chart|er diagram|decision tree|architecture diagram)\b/,
  ];
  if (deckSignals.some((rx) => rx.test(t))) return "deck";
  return null;
}


export default function DeckChat({
  deck, theme, slideIndex, onApplySlide, onApplyDeck,
}: {
  deck: Deck;
  theme: Theme;
  slideIndex: number;
  /** Replace the active slide (used by /api/edit-slide). */
  onApplySlide: (next: Slide) => void;
  /** Replace the whole deck (used by /api/edit-deck). */
  onApplyDeck: (next: Deck) => void;
}) {
  const [input, setInput] = useState("");
  const [scope, setScope] = useState<Scope>("slide");
  const [scopeAutoLocked, setScopeAutoLocked] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Whenever the user changes slides, reset autosense so they're back
  // on "this slide" mode by default (most common edit).
  useEffect(() => {
    if (!scopeAutoLocked) setScope("slide");
  }, [slideIndex, scopeAutoLocked]);

  // Auto-detect scope as the user types. We only flip TOWARD deck
  // (never away from it) so a user that's locked into deck stays there
  // unless they manually switch back.
  useEffect(() => {
    if (scopeAutoLocked) return;
    const detected = detectScope(input);
    if (detected === "deck" && scope !== "deck") setScope("deck");
  }, [input, scope, scopeAutoLocked]);

  // Auto-grow the textarea up to ~5 lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(120, Math.max(36, el.scrollHeight))}px`;
  }, [input]);

  const activeSlide = deck.slides[slideIndex];
  const slideLabel = useMemo(() => {
    if (!activeSlide) return `Slide ${slideIndex + 1}`;
    const t = (activeSlide.title || "").replace(/<[^>]+>/g, "").trim();
    if (t) return t.slice(0, 36) + (t.length > 36 ? "…" : "");
    return `Slide ${slideIndex + 1}`;
  }, [activeSlide, slideIndex]);

  const suggestions = useMemo(() => {
    if (scope === "deck") return DECK_SUGGESTIONS;
    const layout = activeSlide?.layout || "bullets";
    return SLIDE_SUGGESTIONS_BY_LAYOUT[layout] || SLIDE_SUGGESTIONS_BY_LAYOUT.bullets;
  }, [scope, activeSlide]);


  const submit = async (raw?: string, scopeOverride?: Scope) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    const useScope = scopeOverride ?? scope;

    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    setTurns((t) => [...t, { id, user: text, scope: useScope, status: "pending" }]);
    setInput("");
    setLoading(true);
    setShowSuggestions(false);

    try {
      const token = await getIdToken();
      // Compact memory: last 5 successful turns. We send to both endpoints
      // so the model can resolve pronouns ("it", "that"), interpret
      // follow-ups ("now make it bigger"), and avoid duplicating recent
      // work.
      const history = turns
        .filter((tn) => tn.status === "success")
        .slice(-5)
        .map((tn) => ({
          user: tn.user,
          explanation: tn.explanation,
          scope: tn.scope,
        }));

      if (useScope === "deck") {
        const res = await fetch("/api/edit-deck", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ deck, instruction: text, history, slideIndex }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          // Bounce unverified accounts back to the email verification flow
          window.location.href = `/verify-email?redirect=${encodeURIComponent("/app")}`;
          throw new Error("Email not verified");
        }
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
        const explanation: string = data?.explanation || "Deck updated.";
        const ops: any[] = Array.isArray(data?.ops) ? data.ops : [];
        if (data?.deck && ops.length > 0) {
          // The AI may have added/edited a diagram (Mermaid source, no image
          // yet). Render those to SVG on the client before swapping the deck in.
          const { renderDeckDiagrams } = await import("@/lib/diagramRender");
          onApplyDeck(await renderDeckDiagrams(data.deck, token));
        }
        setTurns((t) => t.map((tn) => tn.id === id
          ? { ...tn, status: "success", explanation }
          : tn));
      } else {
        const res = await fetch("/api/edit-slide", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ deck, theme, slideIndex, instruction: text, history }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          // Bounce unverified accounts back to the email verification flow
          window.location.href = `/verify-email?redirect=${encodeURIComponent("/app")}`;
          throw new Error("Email not verified");
        }
        if (!res.ok) throw new Error(data?.error || "Edit failed");
        if (data?.slide) onApplySlide(data.slide);
        setTurns((t) => t.map((tn) => tn.id === id
          ? { ...tn, status: "success", explanation: data?.explanation || "Slide updated." }
          : tn));
      }
    } catch (e: any) {
      setTurns((t) => t.map((tn) => tn.id === id
        ? { ...tn, status: "error", errorMsg: e?.message || "Couldn't apply that." }
        : tn));
    } finally {
      setLoading(false);
    }
  };

  const recentTurns = turns.slice(-3);
  const lastTurn = turns[turns.length - 1];

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.025] backdrop-blur-sm"
      style={{ background: "var(--ezd-bg-card, rgba(255,255,255,0.025))" }}
    >
      {/* Recent activity row — only renders when there's history */}
      {recentTurns.length > 0 && (
        <ul className="flex flex-col divide-y divide-white/8 border-b border-white/8">
          {recentTurns.map((t) => (
            <TurnRow key={t.id} turn={t} onRerun={() => submit(t.user, t.scope)} />
          ))}
        </ul>
      )}

      {/* Input row */}
      <div className="p-2.5 sm:p-3">
        <div className="flex items-stretch gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5 transition focus-within:border-cyan-300/45">
          <ScopeChip
            scope={scope}
            slideLabel={slideLabel}
            onChange={(s) => { setScope(s); setScopeAutoLocked(true); }}
            disabled={loading}
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={
              scope === "deck"
                ? "Tell the AI to change the whole deck…"
                : `Edit ${slideLabel}…`
            }
            disabled={loading}
            className="min-h-[36px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[13px] leading-relaxed text-white outline-none placeholder:text-white/35 disabled:opacity-60"
            style={{ color: "var(--ezd-fg)" }}
          />
          <button
            type="button"
            onClick={() => submit()}
            disabled={loading || input.trim().length === 0}
            className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-sky-700 text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Send"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
          </button>
        </div>

        {/* Suggestions row — folds on first focus, dismisses after a submit */}
        {showSuggestions && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/75 transition hover:border-cyan-300/40 hover:text-white disabled:opacity-50"
              >
                <Sparkles size={9} className="text-cyan-300" />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Helper line — switches by state */}
        <div className="mt-2 flex items-center justify-between text-[10.5px] text-white/35">
          <span>
            {scope === "deck"
              ? "Operates on every slide. Auto-detected from your wording."
              : "Edits only this slide. Switch scope on the left."}
          </span>
          {lastTurn?.status !== "pending" && !loading && (
            <span>↵ to send</span>
          )}
        </div>
      </div>
    </div>
  );
}


/* --------------------------- subcomponents --------------------------- */

function ScopeChip({
  scope, slideLabel, onChange, disabled,
}: {
  scope: Scope;
  slideLabel: string;
  onChange: (s: Scope) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => onChange("slide")}
        disabled={disabled}
        title={`Edit only this slide (${slideLabel})`}
        className={[
          "inline-flex items-center gap-1 px-2 text-[11px] transition",
          scope === "slide"
            ? "bg-cyan-300/15 text-cyan-100"
            : "text-white/55 hover:bg-white/[0.04] hover:text-white",
        ].join(" ")}
      >
        <FileEdit size={11} />
        <span className="hidden sm:inline">Slide</span>
      </button>
      <span className="w-px bg-white/8" />
      <button
        type="button"
        onClick={() => onChange("deck")}
        disabled={disabled}
        title="Edit the whole deck (add / remove / reorder)"
        className={[
          "inline-flex items-center gap-1 px-2 text-[11px] transition",
          scope === "deck"
            ? "bg-cyan-300/15 text-cyan-100"
            : "text-white/55 hover:bg-white/[0.04] hover:text-white",
        ].join(" ")}
      >
        <Layers size={11} />
        <span className="hidden sm:inline">Deck</span>
      </button>
    </div>
  );
}

function TurnRow({
  turn, onRerun,
}: { turn: Turn; onRerun: () => void }) {
  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <span className="mt-[2px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-700 text-white">
        {turn.status === "pending" ? (
          <Loader2 size={9} className="animate-spin" />
        ) : turn.status === "error" ? (
          <X size={9} />
        ) : (
          <CheckCircle2 size={9} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11.5px] leading-snug text-white/85">
          <span className="rounded border border-white/8 bg-white/[0.04] px-1 text-[9.5px] uppercase tracking-[0.16em] text-white/55">
            {turn.scope === "slide" ? "Slide" : "Deck"}
          </span>
          <span className="truncate">{turn.user}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-white/40">
          <CornerDownRight size={9} className="text-white/30" />
          <span className="truncate">
            {turn.status === "pending" ? "Working…"
              : turn.status === "error" ? <span className="text-red-300">{turn.errorMsg}</span>
              : turn.explanation}
          </span>
        </div>
      </div>
      {turn.status !== "pending" && (
        <button
          type="button"
          onClick={onRerun}
          title="Run this prompt again"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-white/35 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ChevronRight size={11} />
        </button>
      )}
    </li>
  );
}
