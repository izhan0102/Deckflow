"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Deck, Slide } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import SlideCanvas from "./SlideCanvas";
import { ChevronLeft, ChevronRight, X, Pause } from "lucide-react";

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
  const idleTimer = useRef<number | null>(null);

  const enriched = useMemo(() => {
    return deck.slides.map((s) =>
      s.layout === "references" ? { ...s, references: deck.references || [] } : s,
    );
  }, [deck.slides, deck.references]);

  const total = enriched.length;
  const goNext = () => {
    setActive((i) => {
      if (i >= total - 1) return i;
      setDirection("next");
      return i + 1;
    });
  };
  const goPrev = () => {
    setActive((i) => {
      if (i <= 0) return i;
      setDirection("prev");
      return i - 1;
    });
  };
  const goTo = (i: number) => {
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

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
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

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
        case "n":
        case "N":
          e.preventDefault(); goNext(); break;
        case "ArrowLeft":
        case "PageUp":
        case "p":
        case "P":
          e.preventDefault(); goPrev(); break;
        case "Home":
          e.preventDefault(); goTo(0); break;
        case "End":
          e.preventDefault(); goTo(total - 1); break;
        case "b": case "B":
          setBlank((s) => (s === "black" ? "none" : "black")); break;
        case "w": case "W":
          setBlank((s) => (s === "white" ? "none" : "white")); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
          style={chromeButton}
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
          <button onClick={(e) => { e.stopPropagation(); goPrev(); }} style={chromeButton} title="Prev (←)">
            <ChevronLeft size={16} />
          </button>
          <ProgressDots total={total} active={active} onJump={(i) => goTo(i)} />
          <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, opacity: 0.8, minWidth: 60, textAlign: "center" }}>
            {active + 1} / {total}
          </span>
          <button onClick={(e) => { e.stopPropagation(); goNext(); }} style={chromeButton} title="Next (→)">
            <ChevronRight size={16} />
          </button>
          <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
          <button onClick={(e) => { e.stopPropagation(); setBlank((s) => s === "black" ? "none" : "black"); }} style={chromeButton} title="Black (B)">
            <Pause size={14} /> B
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
        }}>
          → {jumpBuffer} <span style={{ fontSize: 14, opacity: 0.6 }}>(Enter)</span>
        </div>
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
    }}>
      ← / → to navigate · B = blank · Esc to exit
    </div>
  );
}
