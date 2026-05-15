"use client";
import { useEffect, useRef } from "react";

/**
 * Inline-editable text. Click to place the caret, type to edit.
 * Esc reverts; Enter commits unless `multiline` is true (then Shift+Enter is a newline,
 * Enter commits).
 *
 * Pointer events are stopped at this element so the surrounding draggable
 * Movable wrapper never captures clicks meant for the text.
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

  // Sync external value into the DOM when not focused. While focused we
  // let the user's keystrokes own the content.
  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement !== ref.current) {
      ref.current.textContent = value || "";
    }
  }, [value]);

  if (!interactive) {
    return <span style={style} className={className}>{value}</span>;
  }

  const commit = () => {
    if (!ref.current) return;
    const next = (ref.current.textContent || "").replace(/\s+$/g, "");
    if (next !== (value || "")) onCommit(next);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (ref.current) ref.current.textContent = value || "";
      ref.current?.blur();
      return;
    }
    if (e.key === "Enter" && !multiline && !e.shiftKey) {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  // Hard-stop pointer events from bubbling to the Movable parent.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <span
      ref={ref}
      data-no-drag
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onMouseDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onBlur={commit}
      onKeyDown={onKey}
      title="Click to edit"
      className={className}
      style={{
        outline: "none",
        whiteSpace: multiline ? "pre-wrap" : "normal",
        cursor: "text",
        // The text needs to receive all the events; Movable still owns the
        // empty padding around it.
        ...style,
      }}
    >
      {value || ""}
    </span>
  );
}
