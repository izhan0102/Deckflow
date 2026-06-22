"use client";
import { useEffect, useRef, useState } from "react";
import { sanitizeRichHtml, stripHtml } from "@/lib/richText";

/**
 * Inline-editable text. Click to place the caret, type to edit.
 *
 * Stores rich text. The `value` and `onCommit(next)` strings can carry
 * inline HTML (b / i / u / s / span style) emitted by the floating
 * selection toolbar (see TextFormatBar). Sanitization runs on commit so
 * we never persist unexpected markup, and the underlying plain text is
 * what the rest of the app sees via `stripHtml()`.
 *
 * Keys:
 *   Esc       — revert to last committed value, blur.
 *   Enter     — commit + blur (single-line). With Shift, inserts a <br>.
 *               Multi-line fields treat plain Enter as a newline and
 *               commit only on blur.
 *
 * Subtle but important: we DO NOT use React's `dangerouslySetInnerHTML`
 * on the editable span. React would rewrite the DOM on every parent
 * re-render, even when `value` is unchanged, wiping any in-flight edits
 * (including formatting applied by the floating toolbar) the moment the
 * user does something else like drag a sibling element.
 *
 * Instead we mount once with `innerHTML = value` and keep the DOM in
 * sync with `value` only inside an effect that compares the current DOM
 * HTML against the new value. The effect skips while the editable is
 * focused so we never fight the user's caret either.
 */
export default function EditableText({
  value, onCommit, multiline, interactive, style, className,
}: {
  value: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
  interactive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Track whatever HTML we last wrote into the DOM. Compared against the
  // incoming `value` so we only re-sync when the persisted string truly
  // changed — never on cosmetic re-renders.
  const lastWrittenRef = useRef<string>(value || "");

  const [mounted, setMounted] = useState(false);

  // First mount — write the initial HTML.
  useEffect(() => {
    setMounted(true);
    const el = ref.current;
    if (!el) return;
    const cleanHtml = sanitizeRichHtml(value || "");
    el.innerHTML = cleanHtml;
    lastWrittenRef.current = cleanHtml;
    // First mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the editable element first appears (e.g. a read-only field flips
  // to interactive on double-click), the empty-deps mount effect above has
  // already run while ref.current was null, so seed the DOM here too.
  useEffect(() => {
    const el = ref.current;
    if (!interactive || !el) return;
    if (document.activeElement === el) return;
    const next = sanitizeRichHtml(value || "");
    if (lastWrittenRef.current === next && el.innerHTML !== "") return;
    el.innerHTML = next;
    lastWrittenRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  // Subsequent value updates — only write if (a) the editable is not
  // focused (so we don't clobber the caret) and (b) the new value
  // genuinely differs from what we last wrote.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const next = sanitizeRichHtml(value || "");
    if (lastWrittenRef.current === next) return;
    el.innerHTML = next;
    lastWrittenRef.current = next;
  }, [value]);

  if (!interactive) {
    // Read-only render: trust value as already-sanitized HTML.
    return (
      <span
        style={style}
        className={className}
        dangerouslySetInnerHTML={{ __html: mounted ? sanitizeRichHtml(value || "") : stripHtml(value || "") }}
      />
    );
  }

  const commit = () => {
    if (!ref.current) return;
    const raw = ref.current.innerHTML || "";
    const next = sanitizeRichHtml(raw).replace(/&nbsp;/g, " ").trim();
    if (next !== (value || "")) {
      lastWrittenRef.current = next;
      onCommit(next);
    } else {
      // Even a no-op commit should refresh our reference so any
      // browser-injected <br>/&nbsp; cleanups on this exact render
      // don't trick the next sync into re-writing.
      lastWrittenRef.current = next;
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (ref.current) {
        ref.current.innerHTML = value || "";
        lastWrittenRef.current = value || "";
      }
      ref.current?.blur();
      return;
    }
    if (e.key === "Enter" && !multiline && !e.shiftKey) {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const html = e.clipboardData.getData("text/html");
    const data = html ? sanitizeRichHtml(html) : text;
    document.execCommand("insertHTML", false, data);
  };

  // Hard-stop pointer events from bubbling to the Movable parent.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // Handle touch events specifically for mobile text selection
  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    // Allow text selection on touch devices
    // Don't prevent default so the caret appears
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    // Ensure the element stays focused after touch
    if (ref.current && document.activeElement !== ref.current) {
      // On iOS, sometimes focus is lost after touch
      // Only refocus if it was touched
      const target = e.target as HTMLElement;
      if (target === ref.current || ref.current.contains(target)) {
        ref.current.focus();
      }
    }
  };

  return (
    <span
      ref={ref}
      data-no-drag
      data-editable
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      // Pointer events - prevent bubbling to parent drag handlers
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      // Mouse events - prevent drag interference
      onMouseDown={stop}
      onDoubleClick={stop}
      // Touch events - allow text selection but prevent drag
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onBlur={commit}
      onKeyDown={onKey}
      onPaste={onPaste}
      title="Click to edit. Select text to format."
      className={className}
      style={{
        outline: "none",
        whiteSpace: multiline ? "pre-wrap" : "normal",
        cursor: "text",
        // Allow touch selection but prevent scroll interference
        touchAction: "manipulation",
        // Ensure text is selectable on mobile
        userSelect: "text",
        WebkitUserSelect: "text",
        ...style,
      }}
    />
  );
}