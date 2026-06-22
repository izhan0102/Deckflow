"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Deck, Slide } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import SlideCanvas from "./SlideCanvas";
import { ChevronLeft, ChevronRight, X, Pause, NotebookText, Timer, RotateCcw } from "lucide-react";

/** Rough spoken pace: words per minute used to estimate per-slide talk time. */
const WORDS_PER_MIN = 130;

function plain(s?: string): string {
  return (s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function wordCount(s?: string): number {
  const t = plain(s);
  return t ? t.split(/\s+/).length : 0;
}
function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
/** Estimated seconds to speak a slide from its notes (falls back to body text). */
function slideSeconds(s: Slide): number {
  const words = wordCount(s.notes) || wordCount(s.title) + wordCount(s.subtitle) + (s.bullets || []).reduce((a, b) => a + wordCount(b), 0);
  return Math.max(15, Math.round((words / WORDS_PER_MIN) * 60));
}

/**
 * Full-screen slideshow.
 * Keyboard:
 *   →, Space, PageDown, n  -> next
 *   ←, PageUp, p, Backspace -> prev
 *   Home / End             -> first / last
 *   1-9 then Enter         -> jump to slide
 *   B                      -> black screen
 *   W                      -> white screen
 *   Esc                    -> close
 * Mouse:
 *   Click right half       -> next
 *   Click left half        -> prev
 *   Move mouse             -> show controls; idles after 2s
 */
export default function Presenter({
  deck, theme, startIndex = 0, onClose,
}: {
  deck: Deck;
  theme: Theme;
  startIndex?: number;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(startIndex);
  const [direction, setDirection] = useState<"next" | "prev" | "none">("none");
  const [blank, setBlank] = useState<"none" | "black" | "white">("none");
  const [showControls, setShowControls] = useState(true);
  const [jumpBuffer, setJumpBuffer] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const idleTimer = useRef<number | null>(null);
  
  // Track last keydown time for debouncing to prevent double-advance
  const lastKeyTime = useRef<number>(0);
  const DEBOUNCE_MS = 300;

  const enriched = useMemo(() => {
    return deck.slides.map((s) =>
      s.layout === "references" ? { ...s, references: deck.references || [] } : s,
    );
  }, [deck.slides, deck.references]);

  const total = enriched.length;
  const goNext = () => {
    setJumpBuffer("");
    setActive((i) => {
      if (i >= total - 1) return i;
      setDirection("next");
      return i + 1;
    });
  };
  const goPrev = () => {
    setJumpBuffer("");
    setActive((i) => {
      if (i <= 0) return i;
      setDirection("prev");
      return i - 1;
    });
  };
  const goTo = (i: number) => {
    setJumpBuffer("");
    if (i < 0 || i >= total) return;
    setDirection(i > active ? "next" : "prev");
    setActive(i);
  };

  // Try to enter browser fullscreen on mount; gracefully handle if blocked.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const req = (el as any).requestFullscreen
            || (el as any).webkitRequestFullscreen
            || (el as any).msRequestFullscreen;
    if (req) {
      try {
        const p = req.call(el);
        if (p && typeof p.then === "function") p.catch(() => {});
      } catch { /* user gesture missing — overlay still works */ }
    }
    el.focus();
    // When the user exits fullscreen via Esc/F11, close the presenter too.
    const onFsChange = () => {
      const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (!fs) onClose();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle timer for controls.
  const bumpControls = () => {
    setShowControls(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setShowControls(false), 2000);
  };
  useEffect(() => { bumpControls(); return () => { if (idleTimer.current) window.clearTimeout(idleTimer.current); }; }, []);

  // Talk timer: ticks every second while running. Drives the elapsed clock
  // shown in the notes pane so the presenter can pace themselves.
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  // Per-slide and whole-deck spoken-time estimates from the notes/text.
  const slideSecs = useMemo(() => enriched.map((s) => slideSeconds(s)), [enriched]);
  const totalSecs = useMemo(() => slideSecs.reduce((a, b) => a + b, 0), [slideSecs]);
  const hasAnyNotes = useMemo(() => enriched.some((s) => plain(s.notes).length > 0), [enriched]);

  // Clean up all event listeners
  const cleanup = () => {
    // Remove all keyboard listeners
    document.removeEventListener("keydown", onKey);
    // Reset debounce state
    lastKeyTime.current = 0;
  };

  // Keyboard handler with proper debouncing
  const onKey = (e: KeyboardEvent) => {
    // Don't handle if typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    if (e.key === "Escape") {
      setJumpBuffer("");
      e.preventDefault();
      e.stopPropagation();
      const exit = (document as any).exitFullscreen
        || (document as any).webkitExitFullscreen;
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (exit) exit.call(document);
      } else {
        onClose();
      }
      return;
    }
    bumpControls();

    const now = Date.now();
    // Debounce: ignore if within DEBOUNCE_MS of last event
    const isNavigationKey = ["ArrowRight", "ArrowLeft", " ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "n", "N", "p", "P"].includes(e.key);
    if (isNavigationKey && now - lastKeyTime.current < DEBOUNCE_MS) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Numeric jump: digits buffer until Enter
    if (/^[0-9]$/.test(e.key)) {
      setJumpBuffer((b) => (b + e.key).slice(0, 3));
      return;
    }
    if (e.key === "Enter" && jumpBuffer) {
      const n = parseInt(jumpBuffer, 10);
      if (n >= 1 && n <= total) goTo(n - 1);
      setJumpBuffer("");
      return;
    }
    if (e.key === "Backspace") {
      if (jumpBuffer) { setJumpBuffer((b) => b.slice(0, -1)); return; }
    }

    if (jumpBuffer) setJumpBuffer("");

    let handled = false;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
      case "n":
      case "N":
        e.preventDefault();
        e.stopPropagation();
        lastKeyTime.current = now;
        goNext();
        handled = true;
        break;

      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
      case "p":
      case "P":
        e.preventDefault();
        e.stopPropagation();
        lastKeyTime.current = now;
        goPrev();
        handled = true;
        break;

      case "Home":
        e.preventDefault();
        e.stopPropagation();
        lastKeyTime.current = now;
        goTo(0);
        handled = true;
        break;

      case "End":
        e.preventDefault();
        e.stopPropagation();
        lastKeyTime.current = now;
        goTo(total - 1);
        handled = true;
        break;

      case "b": case "B":
        setBlank((s) => (s === "black" ? "none" : "black"));
        handled = true;
        break;

      case "w": case "W":
        setBlank((s) => (s === "white" ? "none" : "white"));
        handled = true;
        break;

      case "s": case "S":
        e.preventDefault();
        e.stopPropagation();
        setShowNotes((v) => !v);
        handled = true;
        break;

      case "t": case "T":
        e.preventDefault();
        e.stopPropagation();
        setTimerRunning((v) => !v);
        handled = true;
        break;

      case "r": case "R":
        e.preventDefault();
        e.stopPropagation();
        setElapsed(0);
        handled = true;
        break;

      default:
        // Not a key we handle
        break;
    }

    // If we handled the event, prevent any other listeners from firing
    if (handled) {
      e.stopImmediatePropagation();
    }
  };

  // Set up keyboard listeners
  useEffect(() => {
    // Use capture phase to catch events before other listeners
    document.addEventListener("keydown", onKey, true);

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpBuffer, total, active]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onMouseMove={bumpControls}
      onClick={(e) => {
        // Don't navigate if click is on the chrome controls.
        if ((e.target as HTMLElement).closest("[data-presenter-chrome]")) return;
        const w = (e.currentTarget as HTMLElement).clientWidth;
        if (e.clientX < w / 2) goPrev(); else goNext();
      }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "#000",
        outline: "none",
        cursor: showControls ? "default" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        touchAction: "manipulation",
      }}
    >
      {/* Slide stage — letterboxed to a 16:9 area */}
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
        <div
          style={{
            // Use CSS aspect-ratio + max constraints so the slide fills the screen with letterbox.
            width: "min(100vw, calc(100vh * 16 / 9))",
            aspectRatio: "16 / 9",
            position: "relative",
          }}
        >
          {/* Blank screen overlay */}
          {blank !== "none" ? (
            <div style={{ position: "absolute", inset: 0, background: blank === "black" ? "#000" : "#fff" }} />
          ) : (
            <SlideTransition activeIndex={active} direction={direction}>
              {enriched.map((s, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute", inset: 0,
                    visibility: i === active ? "visible" : "hidden",
                  }}
                >
                  <SlideCanvas
                    slide={s}
                    theme={theme}
                    idx={i}
                    total={total}
                    deckTitle={deck.title}
                    graphicId={deck.graphic}
                    graphicAccent={deck.graphicAccent}
                    fontId={deck.fontId}
                  />
                </div>
              ))}
            </SlideTransition>
          )}
        </div>
      </div>

      {/* Top-right close & info */}
      <div
        data-presenter-chrome
        style={{
          position: "absolute", top: 16, right: 16,
          display: "flex", alignItems: "center", gap: 12,
          opacity: showControls ? 1 : 0,
          transition: "opacity 200ms ease",
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            const exit = (document as any).exitFullscreen
              || (document as any).webkitExitFullscreen;
            if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
              if (exit) exit.call(document);
            } else {
              onClose();
            }
          }}
          style={{ ...chromeButton, touchAction: "manipulation", minHeight: "36px", minWidth: "44px" }}
          title="Exit (Esc)"
        >
          <X size={16} /> Exit
        </button>
      </div>

      {/* Bottom controls */}
      <div
        data-presenter-chrome
        style={{
          position: "absolute", left: 0, right: 0, bottom: 16,
          display: "flex", justifyContent: "center",
          opacity: showControls ? 1 : 0,
          transition: "opacity 200ms ease",
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px",
          background: "rgba(20,20,22,0.7)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 999,
          color: "#fff",
        }}>
          <button onClick={(e) => { e.stopPropagation(); goPrev(); }} style={{ ...chromeButton, touchAction: "manipulation", minHeight: "36px", minWidth: "44px" }} title="Prev (←)">
            <ChevronLeft size={16} />
          </button>
          <ProgressDots total={total} active={active} onJump={(i) => goTo(i)} />
          <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, opacity: 0.8, minWidth: 60, textAlign: "center" }}>
            {active + 1} / {total}
          </span>
          <button onClick={(e) => { e.stopPropagation(); goNext(); }} style={{ ...chromeButton, touchAction: "manipulation", minHeight: "36px", minWidth: "44px" }} title="Next (→)">
            <ChevronRight size={16} />
          </button>
          <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
          <button onClick={(e) => { e.stopPropagation(); setBlank((s) => s === "black" ? "none" : "black"); }} style={{ ...chromeButton, touchAction: "manipulation", minHeight: "36px", minWidth: "44px" }} title="Black (B)">
            <Pause size={14} /> B
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowNotes((v) => !v); }}
            style={{ ...chromeButton, background: showNotes ? "rgba(255,255,255,0.22)" : chromeButton.background, touchAction: "manipulation", minHeight: "36px", minWidth: "44px" }}
            title="Speaker notes (S)"
          >
            <NotebookText size={14} /> Notes
          </button>
        </div>
      </div>

      {/* Numeric jump indicator */}
      {jumpBuffer && (
        <div data-presenter-chrome style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(20,20,22,0.85)",
          color: "#fff",
          padding: "12px 24px", borderRadius: 12,
          fontSize: 32, fontVariantNumeric: "tabular-nums",
          border: "1px solid rgba(255,255,255,0.15)",
          touchAction: "manipulation",
        }}>
          → {jumpBuffer} <span style={{ fontSize: 14, opacity: 0.6 }}>(Enter)</span>
        </div>
      )}

      {/* Speaker notes / teleprompter panel */}
      {showNotes && blank === "none" && (
        <NotesPanel
          slide={enriched[active]}
          nextSlide={active < total - 1 ? enriched[active + 1] : null}
          index={active}
          total={total}
          slideEstimate={slideSecs[active]}
          totalEstimate={totalSecs}
          elapsed={elapsed}
          timerRunning={timerRunning}
          hasAnyNotes={hasAnyNotes}
          onToggleTimer={() => setTimerRunning((v) => !v)}
          onResetTimer={() => setElapsed(0)}
          onClose={() => setShowNotes(false)}
        />
      )}

      {/* Hint shown briefly on first frame */}
      <FirstHint />
    </div>
  );
}

const chromeButton: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 10px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 999,
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};

function ProgressDots({ total, active, onJump }: { total: number; active: number; onJump: (i: number) => void }) {
  const max = 18;
  if (total <= max) {
    return (
      <div style={{ display: "flex", gap: 4, padding: "0 6px" }}>
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); onJump(i); }}
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: i === active ? "#fff" : "rgba(255,255,255,0.3)",
              border: "none", cursor: "pointer", padding: 0,
              touchAction: "manipulation",
              minHeight: "20px",
              minWidth: "20px",
            }}
            title={`Slide ${i + 1}`}
          />
        ))}
      </div>
    );
  }
  // Compressed bar for long decks.
  return (
    <div style={{ width: 200, height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 999, position: "relative" }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${((active + 1) / total) * 100}%`,
        background: "#fff", borderRadius: 999,
        transition: "width 180ms ease",
      }} />
    </div>
  );
}

function SlideTransition({
  activeIndex, direction, children,
}: { activeIndex: number; direction: "next" | "prev" | "none"; children: React.ReactNode }) {
  // Ultra-simple cross-fade. The visibility hack above keeps only one slide visible.
  return (
    <div
      key={activeIndex}
      style={{
        position: "absolute", inset: 0,
        animation: "presenter-fade 240ms ease",
      }}
    >
      <style>{`
        @keyframes presenter-fade {
          from { opacity: 0; transform: translateX(${direction === "prev" ? "-12px" : direction === "next" ? "12px" : "0"}); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      {children}
    </div>
  );
}

function FirstHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), 2400);
    return () => window.clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div data-presenter-chrome style={{
      position: "absolute", left: "50%", bottom: 70,
      transform: "translateX(-50%)",
      background: "rgba(20,20,22,0.7)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "#fff",
      padding: "8px 14px", borderRadius: 999,
      fontSize: 11, opacity: 0.9,
      animation: "presenter-fade 200ms ease",
      touchAction: "manipulation",
    }}>
      ← / → to navigate · S = notes · B = blank · Esc to exit
    </div>
  );
}

function NotesPanel({
  slide, nextSlide, index, total, slideEstimate, totalEstimate,
  elapsed, timerRunning, hasAnyNotes, onToggleTimer, onResetTimer, onClose,
}: {
  slide: Slide;
  nextSlide: Slide | null;
  index: number;
  total: number;
  slideEstimate: number;
  totalEstimate: number;
  elapsed: number;
  timerRunning: boolean;
  hasAnyNotes: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onClose: () => void;
}) {
  const script = plain(slide?.notes);
  const overTotal = elapsed > totalEstimate;
  return (
    <div
      data-presenter-chrome
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: "min(420px, 34vw)",
        background: "rgba(14,14,16,0.92)",
        backdropFilter: "blur(14px)",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        color: "#fff",
        display: "flex", flexDirection: "column",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        animation: "presenter-fade 200ms ease",
        zIndex: 5,
        touchAction: "manipulation",
      }}
    >
      {/* Header: timer + controls */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Timer size={16} style={{ opacity: 0.7 }} />
          <span style={{
            fontSize: 22, fontVariantNumeric: "tabular-nums", fontWeight: 700,
            color: overTotal ? "#fca5a5" : "#fff",
          }}>
            {fmtClock(elapsed)}
          </span>
          <span style={{ fontSize: 12, opacity: 0.5 }}>/ ~{fmtClock(totalEstimate)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={onToggleTimer} style={{ ...miniBtn, touchAction: "manipulation", minHeight: "32px", minWidth: "44px" }} title="Play/pause timer (T)">
            {timerRunning ? "Pause" : "Resume"}
          </button>
          <button onClick={onResetTimer} style={{ ...miniBtn, touchAction: "manipulation", minHeight: "32px", minWidth: "44px" }} title="Reset timer (R)">
            <RotateCcw size={13} />
          </button>
          <button onClick={onClose} style={{ ...miniBtn, touchAction: "manipulation", minHeight: "32px", minWidth: "44px" }} title="Hide notes (S)">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Current slide script */}
      <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", opacity: 0.55 }}>
            Slide {index + 1} of {total}
          </span>
          <span style={{ fontSize: 11, opacity: 0.55 }}>~{fmtClock(slideEstimate)} to speak</span>
        </div>

        {slide?.noteSegments && slide.noteSegments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {slide.noteSegments.map((seg, j) => (
              <div key={j}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#6ee7b7" }}>{seg.speaker}</span>
                <p style={{ fontSize: 17, lineHeight: 1.6, color: "rgba(255,255,255,0.92)", margin: "4px 0 0" }}>
                  {seg.text}
                </p>
              </div>
            ))}
          </div>
        ) : script ? (
          <p style={{ fontSize: 18, lineHeight: 1.65, color: "rgba(255,255,255,0.92)", margin: 0 }}>
            {script}
          </p>
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.5)", margin: 0 }}>
            {hasAnyNotes
              ? "No notes for this slide."
              : "No speaker notes yet. Close the presenter and use \u201CGenerate notes\u201D in the editor to create a spoken script for every slide."}
          </p>
        )}

        {/* Next slide peek */}
        {nextSlide && (
          <div style={{
            marginTop: 24, paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}>
            <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", opacity: 0.45 }}>
              Up next
            </span>
            <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: "6px 0 0" }}>
              {plain(nextSlide.title) || `Slide ${index + 2}`}
            </p>
            {plain(nextSlide.subtitle) && (
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}>
                {plain(nextSlide.subtitle)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 9px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};