/**
 * Operations applied to a Sheet. The AI emits a list of these (as JSON) and the
 * client applies them. Setting a cell beyond the current bounds auto-grows the
 * sheet, so "make a table of this data" just works.
 */
import { type Sheet, type CellFormat, parseRef, cellRef } from "./sheet";

export type SheetOp =
  | { op: "set"; ref: string; value: string | number }
  | { op: "setRange"; start: string; values: (string | number)[][] }
  | { op: "clear"; ref?: string; range?: string }
  | { op: "format"; ref?: string; range?: string; bold?: boolean; italic?: boolean; underline?: boolean; align?: "left" | "center" | "right"; color?: string; bg?: string }
  | { op: "clearFormat"; ref?: string; range?: string }
  | { op: "insertRow"; at: number }
  | { op: "insertCol"; at: number }
  | { op: "deleteRow"; at: number }
  | { op: "deleteCol"; at: number }
  | { op: "resize"; rows?: number; cols?: number };

const MAX_COLS = 60;
const MAX_ROWS = 2000;

function clone(s: Sheet): Sheet {
  return { cols: s.cols, rows: s.rows, cells: { ...s.cells }, formats: { ...(s.formats || {}) } };
}

/** Expand "A1:C3" or a single "C4" into a list of {c,r}. */
function rangeCells(range?: string, ref?: string): { c: number; r: number }[] {
  if (ref) { const p = parseRef(ref); return p ? [p] : []; }
  if (!range) return [];
  const [a, b] = range.split(":");
  const pa = parseRef(a), pb = parseRef(b || a);
  if (!pa || !pb) return [];
  const out: { c: number; r: number }[] = [];
  for (let c = Math.min(pa.c, pb.c); c <= Math.max(pa.c, pb.c); c++)
    for (let r = Math.min(pa.r, pb.r); r <= Math.max(pa.r, pb.r); r++) out.push({ c, r });
  return out;
}

function grow(s: Sheet, c: number, r: number): void {
  if (c + 1 > s.cols) s.cols = Math.min(MAX_COLS, c + 1);
  if (r + 1 > s.rows) s.rows = Math.min(MAX_ROWS, r + 1);
}

function setCell(s: Sheet, c: number, r: number, value: string | number): void {
  if (c < 0 || r < 0 || c >= MAX_COLS || r >= MAX_ROWS) return;
  grow(s, c, r);
  const ref = cellRef(c, r);
  const v = value == null ? "" : String(value);
  if (v === "") delete s.cells[ref];
  else s.cells[ref] = v;
}

function shift(s: Sheet, fn: (c: number, r: number) => { c: number; r: number } | null): void {
  const remap = <T,>(src: Record<string, T>): Record<string, T> => {
    const next: Record<string, T> = {};
    for (const [ref, val] of Object.entries(src)) {
      const pr = parseRef(ref);
      if (!pr) continue;
      const moved = fn(pr.c, pr.r);
      if (!moved || moved.c < 0 || moved.r < 0 || moved.c >= MAX_COLS || moved.r >= MAX_ROWS) continue;
      next[cellRef(moved.c, moved.r)] = val;
    }
    return next;
  };
  s.cells = remap(s.cells);
  s.formats = remap(s.formats || {});
}

function applyFormat(s: Sheet, cells: { c: number; r: number }[], patch: CellFormat): void {
  s.formats = s.formats || {};
  for (const { c, r } of cells) {
    const ref = cellRef(c, r);
    const cur = s.formats[ref] || {};
    const next: CellFormat = { ...cur, ...patch };
    // drop falsey toggles to keep the map small
    (Object.keys(next) as (keyof CellFormat)[]).forEach((k) => { if (next[k] === false || next[k] === undefined || next[k] === "") delete next[k]; });
    if (Object.keys(next).length) s.formats[ref] = next; else delete s.formats[ref];
  }
}

function applyOp(s: Sheet, op: SheetOp): void {
  switch (op.op) {
    case "set": {
      const p = parseRef(op.ref);
      if (p) setCell(s, p.c, p.r, op.value);
      break;
    }
    case "setRange": {
      const start = parseRef(op.start);
      if (!start || !Array.isArray(op.values)) break;
      op.values.forEach((row, i) => {
        if (!Array.isArray(row)) return;
        row.forEach((val, j) => setCell(s, start.c + j, start.r + i, val));
      });
      break;
    }
    case "clear": {
      if (op.range) {
        const [a, b] = op.range.split(":");
        const pa = parseRef(a), pb = parseRef(b || a);
        if (pa && pb) {
          for (let c = Math.min(pa.c, pb.c); c <= Math.max(pa.c, pb.c); c++)
            for (let r = Math.min(pa.r, pb.r); r <= Math.max(pa.r, pb.r); r++)
              delete s.cells[cellRef(c, r)];
        }
      } else if (op.ref) {
        const p = parseRef(op.ref);
        if (p) delete s.cells[cellRef(p.c, p.r)];
      }
      break;
    }
    case "format": {
      const cells = rangeCells(op.range, op.ref);
      applyFormat(s, cells, {
        ...(op.bold !== undefined ? { b: op.bold } : {}),
        ...(op.italic !== undefined ? { i: op.italic } : {}),
        ...(op.underline !== undefined ? { u: op.underline } : {}),
        ...(op.align ? { align: op.align } : {}),
        ...(op.color ? { color: op.color } : {}),
        ...(op.bg ? { bg: op.bg } : {}),
      });
      break;
    }
    case "clearFormat": {
      const cells = rangeCells(op.range, op.ref);
      s.formats = s.formats || {};
      for (const { c, r } of cells) delete s.formats[cellRef(c, r)];
      break;
    }
    case "insertRow": {
      const rr = Math.max(0, (op.at || 1) - 1);
      shift(s, (c, r) => ({ c, r: r >= rr ? r + 1 : r }));
      s.rows = Math.min(MAX_ROWS, s.rows + 1);
      break;
    }
    case "insertCol": {
      const cc = Math.max(0, (op.at || 1) - 1);
      shift(s, (c, r) => ({ c: c >= cc ? c + 1 : c, r }));
      s.cols = Math.min(MAX_COLS, s.cols + 1);
      break;
    }
    case "deleteRow": {
      const rr = Math.max(0, (op.at || 1) - 1);
      shift(s, (c, r) => (r === rr ? null : { c, r: r > rr ? r - 1 : r }));
      s.rows = Math.max(1, s.rows - 1);
      break;
    }
    case "deleteCol": {
      const cc = Math.max(0, (op.at || 1) - 1);
      shift(s, (c, r) => (c === cc ? null : { c: c > cc ? c - 1 : c, r }));
      s.cols = Math.max(1, s.cols - 1);
      break;
    }
    case "resize": {
      if (typeof op.cols === "number") s.cols = Math.max(1, Math.min(MAX_COLS, Math.floor(op.cols)));
      if (typeof op.rows === "number") s.rows = Math.max(1, Math.min(MAX_ROWS, Math.floor(op.rows)));
      // drop out-of-bounds cells
      for (const ref of Object.keys(s.cells)) {
        const p = parseRef(ref);
        if (!p || p.c >= s.cols || p.r >= s.rows) delete s.cells[ref];
      }
      for (const ref of Object.keys(s.formats || {})) {
        const p = parseRef(ref);
        if (!p || p.c >= s.cols || p.r >= s.rows) delete s.formats![ref];
      }
      break;
    }
  }
}

export function applyOps(sheet: Sheet, ops: SheetOp[]): Sheet {
  const s = clone(sheet);
  for (const op of Array.isArray(ops) ? ops : []) {
    try { applyOp(s, op); } catch { /* skip a bad op rather than crash */ }
  }
  s.cols = Math.max(1, Math.min(MAX_COLS, s.cols));
  s.rows = Math.max(1, Math.min(MAX_ROWS, s.rows));
  return s;
}

/** Compact representation of the sheet's filled cells for the AI prompt. */
export function sheetToPrompt(sheet: Sheet): string {
  const lines: string[] = [`dimensions: ${sheet.cols} columns x ${sheet.rows} rows`];
  const entries = Object.entries(sheet.cells).filter(([, v]) => v !== "");
  if (!entries.length) return lines.concat("cells: (empty sheet)").join("\n");
  entries.sort((a, b) => {
    const pa = parseRef(a[0])!, pb = parseRef(b[0])!;
    return pa.r - pb.r || pa.c - pb.c;
  });
  lines.push("cells:");
  for (const [ref, val] of entries.slice(0, 400)) lines.push(`  ${ref} = ${val}`);
  if (entries.length > 400) lines.push(`  …and ${entries.length - 400} more`);
  return lines.join("\n");
}
