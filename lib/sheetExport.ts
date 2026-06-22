"use client";
/**
 * Export a Sheet to a real .xlsx (formulas + formatting, via exceljs) or to a
 * clean PDF table (drawn with jspdf). Both run in the browser.
 */
import { type Sheet, type CellFormat, parseRef, cellRef, colName } from "./sheet";

export type ExportResult = { blob: Blob; filename: string };

function isFormula(v: string): boolean { return v.startsWith("="); }
function asValue(raw: string): number | string {
  const t = raw.trim();
  const n = Number(t.replace(/,/g, ""));
  return t !== "" && Number.isFinite(n) && /^[-+]?[\d.,]+(e[-+]?\d+)?$/i.test(t) ? n : raw;
}
function hexToArgb(hex?: string): string | undefined {
  if (!hex) return undefined;
  const h = hex.replace("#", "");
  return h.length === 6 ? "FF" + h.toUpperCase() : undefined;
}

/** Bounding box of filled cells (so we don't export a huge empty grid). */
function usedBounds(sheet: Sheet): { cols: number; rows: number } {
  let maxC = 0, maxR = 0, any = false;
  const refs = [...Object.keys(sheet.cells), ...Object.keys(sheet.formats || {})];
  for (const ref of refs) {
    if ((sheet.cells[ref] ?? "") === "" && !sheet.formats?.[ref]) continue;
    const p = parseRef(ref); if (!p) continue;
    any = true; maxC = Math.max(maxC, p.c); maxR = Math.max(maxR, p.r);
  }
  if (!any) return { cols: Math.min(sheet.cols, 4), rows: Math.min(sheet.rows, 6) };
  return { cols: Math.min(sheet.cols, maxC + 1), rows: Math.min(sheet.rows, maxR + 1) };
}

export async function exportXlsx(sheet: Sheet, evaluated: Record<string, string>, filename: string): Promise<ExportResult> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "EXdeck";
  const ws = wb.addWorksheet("Sheet1");
  const { cols } = usedBounds(sheet);
  ws.columns = Array.from({ length: cols }, () => ({ width: 16 }));

  for (const [ref, raw] of Object.entries(sheet.cells)) {
    if (raw === "") continue;
    const cell = ws.getCell(ref);
    if (isFormula(raw)) {
      const disp = evaluated[ref];
      const num = disp != null && /^-?\d+(\.\d+)?$/.test(disp) ? Number(disp) : undefined;
      cell.value = { formula: raw.slice(1), result: (num ?? (disp && !disp.startsWith("#") ? disp : 0)) } as any;
    } else {
      cell.value = asValue(raw);
    }
  }

  // Apply formatting.
  for (const [ref, f] of Object.entries(sheet.formats || {})) {
    const cell = ws.getCell(ref);
    if (f.b || f.i || f.u || f.color) {
      cell.font = { bold: !!f.b, italic: !!f.i, underline: !!f.u, color: f.color ? { argb: hexToArgb(f.color)! } : undefined };
    }
    if (f.align) cell.alignment = { horizontal: f.align };
    const bg = hexToArgb(f.bg);
    if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return {
    blob: new Blob([buf as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  };
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

export async function exportSheetPdf(sheet: Sheet, evaluated: Record<string, string>, filename: string): Promise<ExportResult> {
  const { default: JsPDF } = await import("jspdf");
  const { cols, rows } = usedBounds(sheet);
  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;
  const gutter = 30;
  const usableW = pageW - margin * 2 - gutter;
  const colW = Math.max(46, Math.min(120, usableW / cols));
  const rowH = 18;

  const clip = (s: string, w: number): string => {
    if (!s) return "";
    let str = s;
    while (str.length > 1 && doc.getTextWidth(str) > w - 6) str = str.slice(0, -1);
    return str === s ? s : str + "…";
  };

  let y = margin;

  const drawColHeaders = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setFillColor(238, 238, 238); doc.setDrawColor(210, 210, 210);
    doc.rect(margin, y, gutter, rowH, "FD"); // corner
    for (let c = 0; c < cols; c++) {
      const x = margin + gutter + c * colW;
      doc.setFillColor(238, 238, 238);
      doc.rect(x, y, colW, rowH, "FD");
      doc.setTextColor(70, 70, 70);
      doc.text(colName(c), x + colW / 2, y + rowH / 2 + 3, { align: "center" });
    }
    doc.setFont("helvetica", "normal");
    y += rowH;
  };

  drawColHeaders();

  for (let r = 0; r < rows; r++) {
    if (y + rowH > pageH - margin) { doc.addPage(); y = margin; drawColHeaders(); }

    // row-number gutter
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.setFillColor(247, 247, 247); doc.setDrawColor(220, 220, 220);
    doc.rect(margin, y, gutter, rowH, "FD");
    doc.setTextColor(140, 140, 140);
    doc.text(String(r + 1), margin + gutter / 2, y + rowH / 2 + 3, { align: "center" });

    for (let c = 0; c < cols; c++) {
      const x = margin + gutter + c * colW;
      const ref = cellRef(c, r);
      const fmt: CellFormat = sheet.formats?.[ref] || {};

      if (fmt.bg) { const [br, bgc, bb] = hexRgb(fmt.bg); doc.setFillColor(br, bgc, bb); doc.setDrawColor(220, 220, 220); doc.rect(x, y, colW, rowH, "FD"); }
      else { doc.setDrawColor(225, 225, 225); doc.rect(x, y, colW, rowH); }

      const raw = sheet.cells[ref] ?? "";
      const disp = raw === "" ? "" : (evaluated[ref] ?? raw);
      if (disp) {
        const numeric = /^-?\d/.test(disp) && !disp.startsWith("#");
        const style = fmt.b && fmt.i ? "bolditalic" : fmt.b ? "bold" : fmt.i ? "italic" : "normal";
        doc.setFont("helvetica", style);
        if (fmt.color) { const [tr, tg, tb] = hexRgb(fmt.color); doc.setTextColor(tr, tg, tb); }
        else doc.setTextColor(25, 25, 25);
        const align: "left" | "center" | "right" = fmt.align || (numeric ? "right" : "left");
        const tx = align === "right" ? x + colW - 4 : align === "center" ? x + colW / 2 : x + 4;
        doc.text(clip(disp, colW), tx, y + rowH / 2 + 3, { align });
        doc.setFont("helvetica", "normal");
      }
    }
    y += rowH;
  }

  return { blob: doc.output("blob"), filename };
}
