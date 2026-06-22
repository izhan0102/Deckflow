/**
 * A tiny but correct spreadsheet engine.
 *
 * Model: a grid of raw cell strings keyed by A1 references. A raw value that
 * starts with "=" is a formula; everything else is text or a number. The
 * engine evaluates formulas with cell refs, ranges, arithmetic, comparisons,
 * and the common functions (SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, PRODUCT,
 * ROUND, ABS, SQRT, POWER, IF). Cycles and bad input produce #ERR-style values
 * rather than throwing, so the UI never crashes.
 */

export type CellFormat = {
  b?: boolean;            // bold
  i?: boolean;            // italic
  u?: boolean;            // underline
  align?: "left" | "center" | "right";
  color?: string;         // text color hex (#RRGGBB)
  bg?: string;            // fill color hex
  numFmt?: "int" | "comma" | "currency" | "percent" | "2dp"; // number display
  cur?: string;           // currency symbol for numFmt:"currency" (e.g. "$", "₹")
};

export type ChartSpec = {
  id: string;
  type: "bar" | "line" | "pie";
  title?: string;
  labels: string;   // range like "A2:A6"
  values: string;   // range like "B2:B6"
};

/** Dynamic conditional-formatting rule — re-applied live as values change. */
export type CondRule = {
  range: string;
  cmp: "lt" | "lte" | "gt" | "gte" | "eq" | "ne";
  value: number;
  bg?: string;
  color?: string;
};

export type Sheet = {
  cols: number;
  rows: number;
  cells: Record<string, string>;
  formats?: Record<string, CellFormat>;
  charts?: ChartSpec[];
  frozen?: { rows?: number; cols?: number };
  condRules?: CondRule[];
};

export function emptySheet(cols = 8, rows = 20): Sheet {
  return { cols, rows, cells: {}, formats: {}, charts: [], frozen: {}, condRules: [] };
}

export function colName(i: number): string {
  let s = "";
  i = Math.floor(i);
  do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
  return s;
}

export function colIndex(s: string): number {
  let n = 0;
  for (const ch of s.toUpperCase()) {
    if (ch < "A" || ch > "Z") break;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function cellRef(c: number, r: number): string {
  return colName(c) + (r + 1); // r is 0-based
}

/** Parse "C4" → { c: 2, r: 3 } (0-based). Null if malformed. */
export function parseRef(ref: string): { c: number; r: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const c = colIndex(m[1]);
  const r = parseInt(m[2], 10) - 1;
  if (c < 0 || r < 0) return null;
  return { c, r };
}

/* ----------------------------- evaluation ------------------------------ */

type Num = number;
type Cell = Num | string;

const isErr = (v: Cell): v is string => typeof v === "string" && v.startsWith("#");

function toNum(v: Cell): number {
  if (typeof v === "number") return v;
  if (v === "" || v == null) return 0;
  // Tolerate currency symbols, thousands separators, %, and spaces so a value
  // like "₹50,000" or "$1,200" still works inside formulas.
  let s = String(v).trim();
  let pct = false;
  if (s.endsWith("%")) { pct = true; s = s.slice(0, -1); }
  s = s.replace(/[₹$€£¥₩,\s]/g, "");
  if (s === "" || s === "-" || s === "+") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? (pct ? n / 100 : n) : NaN;
}

/** Returns a map of ref -> displayed value for every non-empty cell. */
export function evaluateSheet(sheet: Sheet): Record<string, string> {
  const memo = new Map<string, Cell>();
  const visiting = new Set<string>();
  const out: Record<string, string> = {};

  const raw = (ref: string): string => sheet.cells[ref] ?? "";

  function evalRef(ref: string): Cell {
    if (memo.has(ref)) return memo.get(ref)!;
    if (visiting.has(ref)) return "#CYCLE";
    const r = raw(ref);
    if (r === "") { memo.set(ref, ""); return ""; }
    if (!r.startsWith("=")) {
      const n = Number(r.replace(/,/g, ""));
      const v: Cell = r.trim() !== "" && Number.isFinite(n) && /^[-+]?[\d.,]+(e[-+]?\d+)?$/i.test(r.trim()) ? n : r;
      memo.set(ref, v);
      return v;
    }
    visiting.add(ref);
    let v: Cell;
    try { v = evalExpr(r.slice(1), evalRef); }
    catch { v = "#ERR"; }
    visiting.delete(ref);
    memo.set(ref, v);
    return v;
  }

  for (let c = 0; c < sheet.cols; c++) {
    for (let row = 0; row < sheet.rows; row++) {
      const ref = cellRef(c, row);
      if ((sheet.cells[ref] ?? "") === "") continue;
      const v = evalRef(ref);
      out[ref] = typeof v === "number" ? formatNum(v) : v;
    }
  }
  return out;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "#NUM";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1e10) / 1e10);
}

/* --------------------------- expression parser ------------------------- */

type Tok = { t: "num"; v: number } | { t: "ref"; v: string } | { t: "name"; v: string }
  | { t: "op"; v: string } | { t: "("; } | { t: ")"; } | { t: ","; } | { t: ":"; } | { t: "str"; v: string };

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t") { i++; continue; }
    if (ch === '"') {
      let j = i + 1, str = "";
      while (j < s.length && s[j] !== '"') { str += s[j]; j++; }
      toks.push({ t: "str", v: str }); i = j + 1; continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      toks.push({ t: "num", v: parseFloat(s.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i; while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++;
      const word = s.slice(i, j);
      if (/^[A-Za-z]+\d+$/.test(word)) toks.push({ t: "ref", v: word.toUpperCase() });
      else toks.push({ t: "name", v: word.toUpperCase() });
      i = j; continue;
    }
    // multi-char comparison operators
    if (ch === "<" && s[i + 1] === "=") { toks.push({ t: "op", v: "<=" }); i += 2; continue; }
    if (ch === ">" && s[i + 1] === "=") { toks.push({ t: "op", v: ">=" }); i += 2; continue; }
    if (ch === "<" && s[i + 1] === ">") { toks.push({ t: "op", v: "<>" }); i += 2; continue; }
    if ("+-*/^%=<>&".includes(ch)) { toks.push({ t: "op", v: ch }); i++; continue; }
    if (ch === "(") { toks.push({ t: "(" }); i++; continue; }
    if (ch === ")") { toks.push({ t: ")" }); i++; continue; }
    if (ch === ",") { toks.push({ t: "," }); i++; continue; }
    if (ch === ":") { toks.push({ t: ":" }); i++; continue; }
    throw new Error("bad char");
  }
  return toks;
}

function evalExpr(src: string, resolve: (ref: string) => Cell): Cell {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];

  // expr := compare
  function parseExpr(): Cell { return parseCompare(); }

  function parseCompare(): Cell {
    let left = parseConcat();
    const t = peek();
    if (t && t.t === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(t.v)) {
      next();
      const right = parseConcat();
      const a = left, b = right;
      const cmp = (() => {
        if (typeof a === "number" && typeof b === "number") {
          switch (t.v) { case "=": return a === b; case "<>": return a !== b; case "<": return a < b; case ">": return a > b; case "<=": return a <= b; case ">=": return a >= b; }
        }
        const sa = String(a), sb = String(b);
        switch (t.v) { case "=": return sa === sb; case "<>": return sa !== sb; case "<": return sa < sb; case ">": return sa > sb; case "<=": return sa <= sb; case ">=": return sa >= sb; }
        return false;
      })();
      return cmp ? 1 : 0;
    }
    return left;
  }

  const toStr = (v: Cell): string => (typeof v === "number" ? formatNum(v) : String(v));

  function parseConcat(): Cell {
    let v = parseAdd();
    while (peek() && peek().t === "op" && (peek() as any).v === "&") {
      next();
      const r = parseAdd();
      if (isErr(v as Cell)) return v; if (isErr(r as Cell)) return r;
      v = toStr(v) + toStr(r);
    }
    return v;
  }

  function parseAdd(): Cell {
    let v = parseMul();
    while (peek() && peek().t === "op" && ((peek() as any).v === "+" || (peek() as any).v === "-")) {
      const op = (next() as any).v;
      const r = parseMul();
      const a = toNum(v), b = toNum(r);
      if (Number.isNaN(a) || Number.isNaN(b)) return "#VALUE";
      v = op === "+" ? a + b : a - b;
    }
    return v;
  }

  function parseMul(): Cell {
    let v = parsePow();
    while (peek() && peek().t === "op" && (["*", "/", "%"].includes((peek() as any).v))) {
      const op = (next() as any).v;
      const r = parsePow();
      const a = toNum(v), b = toNum(r);
      if (Number.isNaN(a) || Number.isNaN(b)) return "#VALUE";
      if (op === "*") v = a * b;
      else if (op === "/") v = b === 0 ? "#DIV/0" : a / b;
      else v = a % b;
      if (isErr(v as Cell)) return v;
    }
    return v;
  }

  function parsePow(): Cell {
    let v = parseUnary();
    while (peek() && peek().t === "op" && (peek() as any).v === "^") {
      next();
      const r = parseUnary();
      const a = toNum(v), b = toNum(r);
      if (Number.isNaN(a) || Number.isNaN(b)) return "#VALUE";
      v = Math.pow(a, b);
    }
    return v;
  }

  function parseUnary(): Cell {
    const t = peek();
    if (t && t.t === "op" && (t.v === "-" || t.v === "+")) {
      next();
      const v = parseUnary();
      const n = toNum(v);
      return Number.isNaN(n) ? "#VALUE" : (t.v === "-" ? -n : n);
    }
    return parsePrimary();
  }

  function parsePrimary(): Cell {
    const t = next();
    if (!t) throw new Error("unexpected end");
    if (t.t === "num") return t.v;
    if (t.t === "str") return t.v;
    if (t.t === "(") { const v = parseExpr(); if (peek() && peek().t === ")") next(); return v; }
    if (t.t === "ref") {
      // range?
      if (peek() && peek().t === ":") { next(); const end = next(); if (end && end.t === "ref") return resolve(t.v); /* range alone collapses to first cell */ }
      return resolve(t.v);
    }
    if (t.t === "name") {
      if (peek() && peek().t === "(") { next(); return callFn(t.v); }
      return "#NAME";
    }
    throw new Error("unexpected token");
  }

  // Collect function arguments; ranges expand into numeric lists.
  function callFn(name: string): Cell {
    const argRanges: { nums: number[]; nonEmpty: number }[] = [];
    const scalars: Cell[] = [];
    if (peek() && peek().t === ")") { next(); }
    else {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // detect range: ref ':' ref
        const t = peek();
        if (t && t.t === "ref" && toks[p + 1] && toks[p + 1].t === ":") {
          const start = (next() as any).v; next(); const endTok = next();
          const end = endTok && endTok.t === "ref" ? (endTok as any).v : start;
          argRanges.push(collectRange(start, end));
          scalars.push(NaN as any); // placeholder marking a range arg
        } else {
          scalars.push(parseExpr());
        }
        const nx = peek();
        if (nx && nx.t === ",") { next(); continue; }
        break;
      }
      if (peek() && peek().t === ")") next();
    }

    // Flatten numbers across all args (ranges + numeric scalars).
    const nums: number[] = [];
    let nonEmpty = 0;
    let ri = 0;
    for (const s of scalars) {
      if (typeof s === "number" && Number.isNaN(s)) {
        const rg = argRanges[ri++]; if (rg) { nums.push(...rg.nums); nonEmpty += rg.nonEmpty; }
      } else {
        if (s !== "") nonEmpty++;
        const n = toNum(s as Cell);
        if (!Number.isNaN(n) && s !== "") nums.push(n);
      }
    }

    const scalarArgs = scalars.filter((s) => !(typeof s === "number" && Number.isNaN(s))) as Cell[];

    switch (name) {
      case "SUM": return nums.reduce((a, b) => a + b, 0);
      case "AVERAGE": case "AVG": case "MEAN": return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : "#DIV/0";
      case "MIN": return nums.length ? Math.min(...nums) : 0;
      case "MAX": return nums.length ? Math.max(...nums) : 0;
      case "COUNT": return nums.length;
      case "COUNTA": return nonEmpty;
      case "PRODUCT": return nums.reduce((a, b) => a * b, 1);
      case "ABS": return Math.abs(toNum(scalarArgs[0] ?? 0));
      case "SQRT": return Math.sqrt(toNum(scalarArgs[0] ?? 0));
      case "ROUND": { const x = toNum(scalarArgs[0] ?? 0); const d = Math.floor(toNum(scalarArgs[1] ?? 0)); const f = Math.pow(10, d); return Math.round(x * f) / f; }
      case "POWER": return Math.pow(toNum(scalarArgs[0] ?? 0), toNum(scalarArgs[1] ?? 0));
      case "IF": { const cond = toNum(scalarArgs[0] ?? 0); return cond !== 0 ? (scalarArgs[1] ?? "") : (scalarArgs[2] ?? ""); }
      case "CONCAT": case "CONCATENATE": return scalarArgs.map((s) => String(s)).join("");
      default: return "#NAME";
    }
  }

  function collectRange(start: string, end: string): { nums: number[]; nonEmpty: number } {
    const a = parseRef(start), b = parseRef(end);
    const nums: number[] = [];
    let nonEmpty = 0;
    if (!a || !b) return { nums, nonEmpty };
    const c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c);
    const r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r);
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
      const v = resolve(cellRef(c, r));
      if (v !== "") { nonEmpty++; const n = toNum(v); if (!Number.isNaN(n)) nums.push(n); }
    }
    return { nums, nonEmpty };
  }

  const result = parseExpr();
  return result;
}



/* --------------------------- display formatting ------------------------ */

/** Format an evaluated value string for display per a cell's number format. */
export function formatDisplay(disp: string, fmt?: CellFormat): string {
  if (!fmt?.numFmt || disp === "" || disp.startsWith("#")) return disp;
  const n = Number(disp.replace(/,/g, ""));
  if (!Number.isFinite(n)) return disp;
  const cur = fmt.cur || "";
  const locale = cur === "₹" ? "en-IN" : "en-US";
  const grp = (x: number, dp: number) => x.toLocaleString(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  switch (fmt.numFmt) {
    case "int": return grp(Math.round(n), 0);
    case "comma": return grp(n, Number.isInteger(n) ? 0 : 2);
    case "currency": return cur + grp(n, Number.isInteger(n) ? 0 : 2);
    case "percent": return `${(n * 100).toFixed(2)}%`;
    case "2dp": return n.toFixed(2);
    default: return disp;
  }
}

/* ----------------------------- color names ----------------------------- */

const COLOR_NAMES: Record<string, string> = {
  red: "#ef4444", green: "#22c55e", blue: "#3b82f6", yellow: "#facc15", orange: "#f97316",
  purple: "#a855f7", pink: "#ec4899", cyan: "#06b6d4", teal: "#14b8a6", gray: "#9ca3af",
  grey: "#9ca3af", black: "#111111", white: "#ffffff", brown: "#92400e", lime: "#84cc16",
  lightgreen: "#dcfce7", lightred: "#fee2e2", lightyellow: "#fef9c3", lightblue: "#dbeafe",
  lightgray: "#f3f4f6", lightgrey: "#f3f4f6", darkgreen: "#166534", darkred: "#991b1b",
};

/** Normalize a hex or named color to "#RRGGBB" (undefined if unrecognized). */
export function normColor(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim().toLowerCase();
  if (/^#?[0-9a-f]{6}$/i.test(t)) return t.startsWith("#") ? t : "#" + t;
  const key = t.replace(/\s+/g, "");
  return COLOR_NAMES[key] || COLOR_NAMES[key.replace("light", "")] || undefined;
}


/** Expand "A2:A6" (or a single ref) into an ordered list of cell refs. */
export function expandRange(range: string): string[] {
  if (!range) return [];
  const [a, b] = range.split(":");
  const pa = parseRef(a), pb = parseRef(b || a);
  if (!pa || !pb) return [];
  const out: string[] = [];
  for (let r = Math.min(pa.r, pb.r); r <= Math.max(pa.r, pb.r); r++)
    for (let c = Math.min(pa.c, pb.c); c <= Math.max(pa.c, pb.c); c++)
      out.push(cellRef(c, r));
  return out;
}


/** Is a cell ref inside an "A1:C9" range? */
export function cellInRange(ref: string, range: string): boolean {
  const p = parseRef(ref); if (!p) return false;
  const [a, b] = range.split(":");
  const pa = parseRef(a), pb = parseRef(b || a);
  if (!pa || !pb) return false;
  return p.c >= Math.min(pa.c, pb.c) && p.c <= Math.max(pa.c, pb.c) && p.r >= Math.min(pa.r, pb.r) && p.r <= Math.max(pa.r, pb.r);
}

/** Resolve conditional-formatting bg/color for a cell given its computed value. */
export function condStyleFor(ref: string, value: string, rules?: CondRule[]): { bg?: string; color?: string } {
  const out: { bg?: string; color?: string } = {};
  if (!rules?.length || value === "" || value.startsWith("#")) return out;
  const n = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(n)) return out;
  for (const rl of rules) {
    if (!cellInRange(ref, rl.range)) continue;
    const ok = rl.cmp === "lt" ? n < rl.value : rl.cmp === "lte" ? n <= rl.value : rl.cmp === "gt" ? n > rl.value
      : rl.cmp === "gte" ? n >= rl.value : rl.cmp === "eq" ? n === rl.value : n !== rl.value;
    if (ok) { if (rl.bg) out.bg = rl.bg; if (rl.color) out.color = rl.color; }
  }
  return out;
}
