"use client";
import { type Sheet, type CellFormat, colName } from "./sheet";

const MAX_COLS = 60;
const MAX_ROWS = 2000;

/** Parse CSV text into a Sheet (handles quoted fields and embedded commas/quotes). */
export function parseCsv(text: string): Sheet {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  const cells: Record<string, string> = {};
  let maxCols = 1;
  rows.forEach((r, ri) => {
    maxCols = Math.max(maxCols, r.length);
    r.forEach((val, ci) => {
      if (ci >= MAX_COLS || ri >= MAX_ROWS) return;
      const v = val.trim();
      if (v !== "") cells[`${colName(ci)}${ri + 1}`] = v;
    });
  });
  return {
    cols: Math.max(8, Math.min(MAX_COLS, maxCols)),
    rows: Math.max(20, Math.min(MAX_ROWS, rows.length)),
    cells, formats: {},
  };
}

function argbToHex(argb?: string): string | undefined {
  if (!argb || argb.length < 6) return undefined;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  return `#${hex}`;
}

/** Read an .xlsx file (first sheet) into a Sheet, preserving formulas + basic formatting. */
export async function importXlsx(file: File): Promise<Sheet> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  const cells: Record<string, string> = {};
  const formats: Record<string, CellFormat> = {};
  let maxCol = 1, maxRow = 1;

  if (ws) {
    ws.eachRow({ includeEmpty: false }, (rowObj, rowNumber) => {
      rowObj.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber > MAX_COLS || rowNumber > MAX_ROWS) return;
        const ref = `${colName(colNumber - 1)}${rowNumber}`;
        const v: any = cell.value;
        let raw = "";
        if (v == null) raw = "";
        else if (typeof v === "object") {
          if ("formula" in v && v.formula) raw = "=" + v.formula;
          else if ("result" in v && v.result != null) raw = String(v.result);
          else if ("richText" in v && Array.isArray(v.richText)) raw = v.richText.map((p: any) => p.text).join("");
          else if ("text" in v) raw = String(v.text);
          else if (v instanceof Date) raw = v.toISOString().slice(0, 10);
          else raw = "";
        } else raw = String(v);
        if (raw !== "") { cells[ref] = raw; maxCol = Math.max(maxCol, colNumber); maxRow = Math.max(maxRow, rowNumber); }

        const f: CellFormat = {};
        if (cell.font?.bold) f.b = true;
        if (cell.font?.italic) f.i = true;
        if (cell.font?.underline) f.u = true;
        const al = cell.alignment?.horizontal;
        if (al === "left" || al === "center" || al === "right") f.align = al;
        const tc = argbToHex((cell.font?.color as any)?.argb);
        if (tc && tc.toUpperCase() !== "#000000") f.color = tc;
        const fill: any = cell.fill;
        if (fill?.type === "pattern" && fill.fgColor?.argb) { const bg = argbToHex(fill.fgColor.argb); if (bg && bg.toUpperCase() !== "#FFFFFF") f.bg = bg; }
        if (Object.keys(f).length && raw !== "") formats[ref] = f;
      });
    });
  }

  return {
    cols: Math.max(8, Math.min(MAX_COLS, maxCol)),
    rows: Math.max(20, Math.min(MAX_ROWS, maxRow)),
    cells, formats,
  };
}
