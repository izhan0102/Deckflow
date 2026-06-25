import { useEffect } from "react";

/**
 * Returns true when the keyboard event originates from a text-entry node
 * (contenteditable, input, textarea, select). Slide-level shortcuts must
 * not fire while the user is typing inside an EditableText or any other
 * form control.
 */
function isEditableTarget(e: KeyboardEvent): boolean {
  const tgt = e.target as HTMLElement | null;
  if (!tgt) return false;
  return tgt.isContentEditable || /^(input|textarea|select)$/i.test(tgt.tagName);
}

export interface KeyboardShortcutHandlers {
  /** Undo the last deck change. */
  onUndo: () => void;
  /** Duplicate the currently active slide and select the copy. */
  onDuplicate: () => void;
  /** Delete the currently active slide. */
  onDelete: () => void;
  /** Insert a blank slide after the current one and select it. */
  onInsert: () => void;
  /** Navigate to the previous slide. */
  onPrev: () => void;
  /** Navigate to the next slide. */
  onNext: () => void;
}

/**
 * Attaches a single `keydown` listener on `window` for the following
 * editor shortcuts and cleans it up on unmount.
 *
 * | Shortcut              | Action                        |
 * |-----------------------|-------------------------------|
 * | Ctrl/Cmd + Z          | Undo                          |
 * | Ctrl/Cmd + D          | Duplicate selected slide      |
 * | Ctrl/Cmd + Enter      | Insert blank slide below      |
 * | Delete / Backspace    | Delete selected slide         |
 * | Arrow Up / Arrow Down | Navigate slides               |
 *
 * All shortcuts are suppressed when `document.activeElement` is a
 * contenteditable or standard form control so they never interfere with
 * in-slide text editing.
 */
export function useKeyboardShortcuts({
  onUndo,
  onDuplicate,
  onDelete,
  onInsert,
  onPrev,
  onNext,
}: KeyboardShortcutHandlers): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never fire slide-level actions while the user is typing.
      if (isEditableTarget(e)) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + Z — undo
      if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
        return;
      }

      // Ctrl/Cmd + D — duplicate slide
      if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        onDuplicate();
        return;
      }

      // Ctrl/Cmd + Enter — insert new slide below
      if (ctrl && e.key === "Enter") {
        e.preventDefault();
        onInsert();
        return;
      }

      // Delete / Backspace — delete slide (no modifier needed)
      if (!ctrl && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        onDelete();
        return;
      }

      // Arrow Up — previous slide (no modifier needed)
      if (!ctrl && e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
        return;
      }

      // Arrow Down — next slide (no modifier needed)
      if (!ctrl && e.key === "ArrowDown") {
        e.preventDefault();
        onNext();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUndo, onDuplicate, onDelete, onInsert, onPrev, onNext]);
}