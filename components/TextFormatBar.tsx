"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Type, Palette, Eraser, ChevronDown,
} from "lucide-react";

/**
 * Floating selection toolbar — Notion / Google Docs style.
 *
 * Mounts once per interactive SlideCanvas. Watches `selectionchange`
 * for text selections that fall inside any `[data-editable]` element
 * on the same canvas, positions itself just above the selection's
 * bounding rect, and lets the user apply inline formatting (bold,
 * italic, underline, strikethrough, font size, color, clear).
 *
 * Implementation notes:
 *   - Uses document.execCommand under the hood. It's deprecated but
 *     still the most reliable cross-browser way to mutate a
 *     contenteditable selection. The result is HTML inside the editable
 *     element, which `EditableText` sanitizes on commit.
 *   - Position is in viewport coordinates (`fixed`) so it tracks the
 *     selection even when the canvas is scaled or scrolled.
 *   - Closes when the selection collapses, the user clicks outside an
 *     editable, or scrolls beyond a small threshold.
 */

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 54, 72];

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Default",  value: "" },
  { label: "Black",    value: "#0F172A" },
  { label: "Slate",    value: "#475569" },
  { label: "White",    value: "#FFFFFF" },
  { label: "Cyan",     value: "#22D3EE" },
  { label: "Cobalt",   value: "#1D4ED8" },
  { label: "Crimson",  value: "#DC2626" },
  { label: "Amber",    value: "#F59E0B" },
  { label: "Emerald",  value: "#047857" },
  { label: "Plum",     value: "#7C3AED" },
];

type Props = {
  /** Whether the parent SlideCanvas is in interactive mode. */
  enabled: boolean;
  /** Bounds of the canvas — used to clamp the toolbar inside it. */
  canvasRef: React.RefObject<HTMLDivElement>;
};

export default function TextFormatBar({ enabled, canvasRef }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; align: "start" | "end" | "center" }>({
    top: 0, left: 0, align: "center",
  });
  const [marks, setMarks] = useState({ bold: false, italic: false, underline: false, strike: false });
  const [activeColor, setActiveColor] = useState<string>(""); // current foreColor in hex (lowercase) or "" for default
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  // Track the last non-collapsed Range so menu interactions don't drop
  // the selection (clicking the toolbar moves focus and would otherwise
  // collapse the selection before exec runs).
  const savedRange = useRef<Range | null>(null);
  // Track touch selection to prevent toolbar from closing prematurely
  const touchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ------------------------- selection tracking ------------------------- */

  useEffect(() => {
    if (!enabled) return;

    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        // Don't close immediately on touch devices - iOS sometimes has
        // a brief moment where selection appears collapsed
        if (touchTimeoutRef.current) {
          clearTimeout(touchTimeoutRef.current);
          touchTimeoutRef.current = null;
        }
        setOpen(false);
        return;
      }

      // Only attach when the selection sits inside a SlideCanvas-owned
      // editable. We walk up from anchorNode and require both an
      // ancestor with [data-editable] AND that the canvasRef contains it.
      const anchor = sel.anchorNode as Node | null;
      if (!anchor) { setOpen(false); return; }
      const editable = closestEl(anchor, "[data-editable]");
      if (!editable) { setOpen(false); return; }
      if (canvasRef.current && !canvasRef.current.contains(editable)) {
        setOpen(false);
        return;
      }

      // Save the range so menu clicks don't lose it.
      savedRange.current = sel.getRangeAt(0).cloneRange();

      const rect = sel.getRangeAt(0).getBoundingClientRect();
      // If the selection's rect is empty (rare; e.g. selection across
      // empty nodes), fall back to the editable's rect.
      const fallback = editable.getBoundingClientRect();
      const r = rect.width === 0 && rect.height === 0 ? fallback : rect;

      // Compute toolbar position above the selection. Clamp inside the
      // viewport so it never falls off the edge.
      const TOOLBAR_W = 360;
      const TOOLBAR_H = 38;
      const GAP = 8;

      let top = r.top - TOOLBAR_H - GAP;
      let align: "start" | "end" | "center" = "center";
      if (top < 8) {
        // Not enough room above — flip below the selection.
        top = r.bottom + GAP;
      }

      let left = r.left + r.width / 2 - TOOLBAR_W / 2;
      if (left < 8) { left = 8; align = "start"; }
      if (left + TOOLBAR_W > window.innerWidth - 8) {
        left = window.innerWidth - TOOLBAR_W - 8;
        align = "end";
      }

      setPos({ top, left, align });
      setMarks({
        bold: queryStateSafe("bold"),
        italic: queryStateSafe("italic"),
        underline: queryStateSafe("underline"),
        strike: queryStateSafe("strikeThrough"),
      });
      setActiveColor(currentForeColor());
      setOpen(true);
    };

    const onSelectionChange = () => {
      // Defer so the selection has settled (avoids tail-end glitches on
      // double-click and triple-click).
      window.requestAnimationFrame(update);
    };

    const onScrollOrResize = () => {
      // Keep the toolbar pinned to the selection on scroll / resize.
      onSelectionChange();
    };

    // Handle touch selection specifically
    const onTouchSelection = () => {
      // iOS sometimes takes a moment to show selection handles
      // Delay update to let selection settle
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
      touchTimeoutRef.current = setTimeout(() => {
        onSelectionChange();
      }, 100);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("touchstart", onTouchSelection, { passive: true });
    document.addEventListener("touchend", onTouchSelection, { passive: true });
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("touchstart", onTouchSelection);
      document.removeEventListener("touchend", onTouchSelection);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
        touchTimeoutRef.current = null;
      }
    };
  }, [enabled, canvasRef]);

  // Close menus when toolbar closes.
  useEffect(() => {
    if (!open) {
      setSizeMenuOpen(false);
      setColorMenuOpen(false);
    }
  }, [open]);

  // Close menus on outside click — but not on toolbar clicks.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!barRef.current?.contains(target)) {
        setSizeMenuOpen(false);
        setColorMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  if (!enabled || !open) return null;

  /* ----------------------------- actions ----------------------------- */

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (!sel || !savedRange.current) return;
    sel.removeAllRanges();
    sel.addRange(savedRange.current);
  };

  const apply = (cmd: "bold" | "italic" | "underline" | "strikeThrough") => {
    restoreSelection();
    document.execCommand(cmd);
    setMarks((m) => ({
      ...m,
      bold:      cmd === "bold"          ? !m.bold      : m.bold,
      italic:    cmd === "italic"        ? !m.italic    : m.italic,
      underline: cmd === "underline"     ? !m.underline : m.underline,
      strike:    cmd === "strikeThrough" ? !m.strike    : m.strike,
    }));
    notifyEdit();
  };

  const setSize = (px: number) => {
    restoreSelection();
    // execCommand("fontSize") only takes 1-7. We work around it by
    // wrapping the selection in a styled span via insertHTML, but the
    // simplest reliable path is to use execCommand("fontSize", "7")
    // first to wrap, then post-process. Easier: directly wrap the
    // selection range manually.
    wrapSelection({ "font-size": `${px}px` });
    setSizeMenuOpen(false);
    notifyEdit();
  };

  const setColor = (hex: string) => {
    restoreSelection();
    if (!hex) {
      // "Default" — try execCommand first, then fall back to wrapping.
      document.execCommand("foreColor", false, "inherit");
      wrapSelection({ color: "" });
    } else {
      document.execCommand("foreColor", false, hex);
    }
    setColorMenuOpen(false);
    notifyEdit();
  };

  const clearFormatting = () => {
    restoreSelection();
    document.execCommand("removeFormat");
    notifyEdit();
  };

  /* ----------------------------- render ----------------------------- */

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Text formatting"
      className="ezd-formatbar"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 200,
        // Ensure toolbar is clickable on mobile
        touchAction: "manipulation",
      }}
      // Prevent mousedown on the toolbar from collapsing the selection.
      onMouseDown={(e) => e.preventDefault()}
      // Prevent touch events from collapsing selection
      onTouchStart={(e) => {
        e.preventDefault();
        // Store selection before touch interaction
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          savedRange.current = sel.getRangeAt(0).cloneRange();
        }
      }}
    >
      <ToolbarButton
        active={marks.bold}
        title="Bold (Ctrl/Cmd+B)"
        onClick={() => apply("bold")}
      >
        <Bold size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={marks.italic}
        title="Italic (Ctrl/Cmd+I)"
        onClick={() => apply("italic")}
      >
        <Italic size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={marks.underline}
        title="Underline (Ctrl/Cmd+U)"
        onClick={() => apply("underline")}
      >
        <UnderlineIcon size={13} />
      </ToolbarButton>
      <ToolbarButton
        active={marks.strike}
        title="Strikethrough"
        onClick={() => apply("strikeThrough")}
      >
        <Strikethrough size={13} />
      </ToolbarButton>

      <Sep />

      {/* Size dropdown */}
      <div className="relative">
        <button
          type="button"
          title="Font size"
          onClick={() => { setColorMenuOpen(false); setSizeMenuOpen((v) => !v); }}
          className="ezd-fb-btn"
          style={{ touchAction: "manipulation" }}
        >
          <Type size={13} />
          <ChevronDown size={10} className="opacity-60" />
        </button>
        {sizeMenuOpen && (
          <div className="ezd-fb-menu" style={{ minWidth: 96 }}>
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className="ezd-fb-row"
                style={{ touchAction: "manipulation" }}
              >
                {s}
                <span className="text-white/30 text-[10px]">px</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color dropdown */}
      <div className="relative">
        <button
          type="button"
          title={activeColor ? `Text color · ${activeColor.toUpperCase()}` : "Text color"}
          onClick={() => { setSizeMenuOpen(false); setColorMenuOpen((v) => !v); }}
          className="ezd-fb-btn"
          style={{ touchAction: "manipulation" }}
        >
          <Palette size={13} />
          {/* Live swatch showing the current color of the selection.
              Empty / default selection shows a hatched swatch so the
              user knows nothing's been overridden. */}
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-full border border-white/15"
            style={{
              background: activeColor || "transparent",
              backgroundImage: activeColor
                ? undefined
                : "linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.4) 55%, transparent 55%)",
            }}
          />
          <ChevronDown size={10} className="opacity-60" />
        </button>
        {colorMenuOpen && (
          <div className="ezd-fb-menu" style={{ minWidth: 168, padding: 8 }}>
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_PRESETS.map((c) => {
                const matches = colorsMatch(activeColor, c.value);
                return (
                  <button
                    key={c.label}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.value)}
                    className={`relative grid h-6 w-6 place-items-center rounded-full border transition hover:scale-105 ${
                      matches ? "border-white ring-2 ring-cyan-300/70" : "border-white/10"
                    }`}
                    style={{
                      background: c.value || "transparent",
                      backgroundImage: c.value
                        ? undefined
                        : "linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.4) 55%, transparent 55%)",
                      touchAction: "manipulation",
                    }}
                  >
                    {!c.value && <Eraser size={9} className="text-white/55" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Sep />

      <ToolbarButton title="Clear formatting" onClick={clearFormatting}>
        <Eraser size={13} />
      </ToolbarButton>

      {/* Local stylesheet — kept inline so the toolbar is self-contained
          and consistent in dark mode. */}
      <style jsx>{`
        .ezd-formatbar {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 4px;
          border-radius: 10px;
          background: rgba(10, 22, 40, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(12px);
          color: #E6EDF7;
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          animation: ezd-fb-in 120ms ease-out;
          will-change: transform, opacity;
          /* Ensure touch events work properly */
          touch-action: manipulation;
        }
        @keyframes ezd-fb-in {
          from { opacity: 0; transform: translateY(4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        :global(.ezd-fb-btn) {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 7px;
          border-radius: 6px;
          background: transparent;
          border: 1px solid transparent;
          color: rgba(230, 237, 247, 0.8);
          cursor: pointer;
          font-size: 11px;
          line-height: 1;
          transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
          touch-action: manipulation;
          min-height: 28px;
          min-width: 28px;
        }
        :global(.ezd-fb-btn:hover) {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        :global(.ezd-fb-btn-active) {
          background: rgba(255, 255, 255, 0.92);
          color: #000;
          border-color: rgba(255, 255, 255, 0.5);
        }
        .ezd-fb-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 96px;
          padding: 4px;
          border-radius: 10px;
          background: rgba(10, 22, 40, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.7);
          z-index: 1;
          animation: ezd-fb-in 120ms ease-out;
          touch-action: manipulation;
        }
        :global(.ezd-fb-row) {
          display: flex;
          width: 100%;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: rgba(230, 237, 247, 0.85);
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
          gap: 8px;
          touch-action: manipulation;
          min-height: 32px;
        }
        :global(.ezd-fb-row:hover) {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        /* Larger touch targets for mobile */
        @media (max-width: 768px) {
          :global(.ezd-fb-btn) {
            padding: 7px 9px;
            min-height: 32px;
            min-width: 32px;
          }
          :global(.ezd-fb-row) {
            padding: 8px 12px;
            min-height: 38px;
          }
        }
      `}</style>
    </div>
  );
}

/* --------------------------- subcomponents --------------------------- */

function ToolbarButton({
  active, title, onClick, children,
}: {
  active?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`ezd-fb-btn ${active ? "ezd-fb-btn-active" : ""}`}
      style={{ touchAction: "manipulation" }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 1,
        height: 18,
        background: "rgba(255,255,255,0.12)",
        margin: "0 2px",
      }}
    />
  );
}

/* ----------------------------- helpers ----------------------------- */

function closestEl(node: Node, selector: string): HTMLElement | null {
  const el = node.nodeType === Node.ELEMENT_NODE
    ? (node as HTMLElement)
    : node.parentElement;
  return el ? el.closest(selector) as HTMLElement | null : null;
}

function queryStateSafe(cmd: string): boolean {
  try { return document.queryCommandState(cmd); }
  catch { return false; }
}

/**
 * Read the current foreColor of the selection and normalize it to a
 * lowercase 6-digit hex (e.g. "#dc2626"). Returns "" when the selection
 * doesn't carry an explicit color (i.e. inherits from the slide theme).
 */
function currentForeColor(): string {
  try {
    const raw = document.queryCommandValue("foreColor");
    if (!raw) return "";
    return rgbToHex(raw);
  } catch {
    return "";
  }
}

/** Convert "rgb(220, 38, 38)" / "#DC2626" / named colors to "#dc2626". */
function rgbToHex(input: string): string {
  if (!input) return "";
  const s = input.trim().toLowerCase();
  if (s.startsWith("#")) {
    if (s.length === 7) return s;
    if (s.length === 4) {
      // #abc → #aabbcc
      return "#" + s.slice(1).split("").map((c) => c + c).join("");
    }
    return s;
  }
  const m = s.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([0-9.]+))?\)$/);
  if (m) {
    const r = clamp255(+m[1]);
    const g = clamp255(+m[2]);
    const b = clamp255(+m[3]);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  return "";
}
function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Compare two color strings tolerantly. Accepts hex of any case and
 * "rgb(…)" forms. Empty strings only match each other.
 */
function colorsMatch(a: string, b: string): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return rgbToHex(a) === rgbToHex(b);
}

/**
 * Wrap the current selection in a span with the given style. Used for
 * font-size and color operations where execCommand falls short.
 *
 * If the selection is collapsed or doesn't span any text, this is a noop.
 */
function wrapSelection(style: Record<string, string>) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  // Build a span with the requested inline styles.
  const span = document.createElement("span");
  for (const [k, v] of Object.entries(style)) {
    if (v) span.style.setProperty(k, v);
  }

  // surroundContents fails when the range partially intersects existing
  // nodes. Fall back to extractContents + appendChild for that case.
  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  // Reselect inside the new span so further actions target it.
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.addRange(newRange);
}

/**
 * Fire a synthetic input event on the focused editable so React knows
 * the contenteditable changed (otherwise nothing's "edited" until the
 * user presses a key). EditableText commits on blur, so we don't strictly
 * need this — but firing it is cheap and helps any future listeners.
 */
function notifyEdit() {
  const active = document.activeElement;
  if (active && (active as HTMLElement).isContentEditable) {
    active.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}