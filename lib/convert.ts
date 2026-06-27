/**
 * Client-side file conversions. Everything runs in the browser — files never
 * leave the user's device. Heavy libs (pdfjs, jspdf, jszip, pdf-lib, tesseract)
 * are dynamically imported so they only load when a conversion actually runs.
 */

const PDFJS_VERSION = "4.10.38";
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export type ConvertResult = { blob: Blob; filename: string };
export type ProgressCb = (p: { phase: string; current?: number; total?: number }) => void;

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "file";
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return pdfjs;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), mime, quality),
  );
}

/* ------------------------------- images -------------------------------- */

/** Convert a single image to another raster format (png/jpg/webp). */
export async function convertImage(file: File, toMime: string, ext: string, quality = 0.92): Promise<ConvertResult> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  if (toMime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  const blob = await canvasToBlob(canvas, toMime, quality);
  return { blob, filename: `${baseName(file.name)}.${ext}` };
}

/** Combine one or more images into a single PDF (one image per page). */
export async function imagesToPdf(files: File[]): Promise<ConvertResult> {
  const { default: JsPDF } = await import("jspdf");
  let pdf: any = null;
  for (const file of files) {
    const bmp = await createImageBitmap(file);
    const w = bmp.width, h = bmp.height;
    const orientation = w >= h ? "landscape" : "portrait";
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (!pdf) pdf = new JsPDF({ orientation, unit: "px", format: [w, h], compress: true });
    else pdf.addPage([w, h], orientation);
    pdf.addImage(data, "JPEG", 0, 0, w, h, undefined, "FAST");
    canvas.width = 0; canvas.height = 0;
  }
  if (!pdf) throw new Error("No images provided");
  return { blob: pdf.output("blob"), filename: `${baseName(files[0].name)}.pdf` };
}

/* -------------------------------- pdf ---------------------------------- */

/** Render every PDF page to an image and return them zipped. */
export async function pdfToImages(file: File, toMime: "image/png" | "image/jpeg" | "image/webp", ext: string, onProgress?: ProgressCb): Promise<ConvertResult> {
  const pdfjs = await loadPdfjs();
  const { default: JSZip } = await import("jszip");
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const zip = new JSZip();
  const base = baseName(file.name);
  try {
    const total = doc.numPages;
    for (let n = 1; n <= total; n++) {
      onProgress?.({ phase: "Rendering pages", current: n, total });
      const page = await doc.getPage(n);
      const base1 = page.getViewport({ scale: 1 });
      const scale = Math.max(1, Math.min(2.5, 2000 / base1.width));
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      if (toMime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      page.cleanup();
      const blob = await canvasToBlob(canvas, toMime, 0.92);
      zip.file(`${base}-${String(n).padStart(3, "0")}.${ext}`, blob);
      canvas.width = 0; canvas.height = 0;
    }
  } finally {
    doc.destroy();
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: `${base}-${ext}.zip` };
}

/** Merge multiple PDFs into one (vector content preserved). */
export async function mergePdfs(files: File[]): Promise<ConvertResult> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(await f.arrayBuffer());
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const bytes = await out.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), filename: "merged.pdf" };
}

/** Split a PDF into one PDF per page, returned zipped. */
export async function splitPdf(file: File, onProgress?: ProgressCb): Promise<ConvertResult> {
  const { PDFDocument } = await import("pdf-lib");
  const { default: JSZip } = await import("jszip");
  const src = await PDFDocument.load(await file.arrayBuffer());
  const zip = new JSZip();
  const base = baseName(file.name);
  const n = src.getPageCount();
  for (let i = 0; i < n; i++) {
    onProgress?.({ phase: "Splitting", current: i + 1, total: n });
    const out = await PDFDocument.create();
    const [pg] = await out.copyPages(src, [i]);
    out.addPage(pg);
    const bytes = await out.save();
    zip.file(`${base}-${String(i + 1).padStart(3, "0")}.pdf`, bytes);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: `${base}-split.zip` };
}

/** Rebuild a PDF from a chosen page order + per-page rotation (dropped pages
 *  excluded). Used by the interactive "Organize PDF" tool. */
export async function rebuildPdf(file: File, ops: { index: number; rotate: number }[]): Promise<ConvertResult> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const src = await PDFDocument.load(await file.arrayBuffer());
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, ops.map((o) => o.index));
  copied.forEach((pg, i) => {
    const rot = ((ops[i].rotate % 360) + 360) % 360;
    if (rot) pg.setRotation(degrees(rot));
    out.addPage(pg);
  });
  const bytes = await out.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), filename: `${baseName(file.name)}-organized.pdf` };
}

/* -------------------------------- ocr ---------------------------------- */

/** OCR an image or PDF into a plain-text (.txt) file. */
export async function ocrToText(file: File, onProgress?: ProgressCb): Promise<ConvertResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const base = baseName(file.name);
  let text = "";
  try {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const pdfjs = await loadPdfjs();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      try {
        const total = doc.numPages;
        for (let p = 1; p <= total; p++) {
          onProgress?.({ phase: "Reading text", current: p, total });
          const page = await doc.getPage(p);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas unavailable");
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          page.cleanup();
          const { data } = await worker.recognize(canvas);
          text += (data.text || "").trim() + "\n\n";
          canvas.width = 0; canvas.height = 0;
        }
      } finally {
        doc.destroy();
      }
    } else {
      onProgress?.({ phase: "Reading text" });
      const { data } = await worker.recognize(file);
      text = data.text || "";
    }
  } finally {
    await worker.terminate();
  }
  return { blob: new Blob([text.trim() + "\n"], { type: "text/plain" }), filename: `${base}.txt` };
}

/** Render PDF pages to thumbnail data URLs (for the organize tool). */
export async function pdfPageThumbnails(file: File): Promise<string[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const thumbs: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base1 = page.getViewport({ scale: 1 });
      const scale = 240 / base1.width;
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); await page.render({ canvasContext: ctx, viewport: vp }).promise; }
      thumbs.push(canvas.toDataURL("image/jpeg", 0.7));
      page.cleanup();
      canvas.width = 0; canvas.height = 0;
    }
  } finally {
    doc.destroy();
  }
  return thumbs;
}

/* ----------------------------- svg → raster ---------------------------- */

/** Rasterize an SVG file to PNG/JPG by drawing it onto a canvas. */
export async function svgToRaster(file: File, toMime: string, ext: string, quality = 0.92): Promise<ConvertResult> {
  const svgText = await file.text();
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Could not read this SVG file."));
      im.src = url;
    });
    let w = img.naturalWidth || img.width || 0;
    let h = img.naturalHeight || img.height || 0;
    if (!w || !h) {
      // Some SVGs omit width/height — fall back to the viewBox dimensions.
      const vb = svgText.match(/viewBox\s*=\s*["']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/i);
      if (vb) { w = Math.round(parseFloat(vb[1])); h = Math.round(parseFloat(vb[2])); }
    }
    if (!w || !h) { w = 1024; h = 1024; }
    const scale = Math.min(4, Math.max(1, 1024 / Math.max(w, h)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    if (toMime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, toMime, quality);
    return { blob, filename: `${baseName(file.name)}.${ext}` };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ----------------------------- pdf → text ------------------------------ */

/** Extract the embedded text layer from a PDF (fast; not OCR). */
export async function pdfToText(file: File, onProgress?: ProgressCb): Promise<ConvertResult> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const base = baseName(file.name);
  let text = "";
  try {
    const total = doc.numPages;
    for (let n = 1; n <= total; n++) {
      onProgress?.({ phase: "Extracting text", current: n, total });
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const parts: string[] = [];
      for (const item of content.items as any[]) {
        if (typeof item.str === "string") parts.push(item.str);
        if (item.hasEOL) parts.push("\n");
      }
      text += parts.join("").replace(/[ \t]+\n/g, "\n").trim() + "\n\n";
      page.cleanup();
    }
  } finally {
    doc.destroy();
  }
  const out = text.trim();
  if (!out) throw new Error("No selectable text found — this looks like a scanned PDF. Try the OCR PDF tool instead.");
  return { blob: new Blob([out + "\n"], { type: "text/plain" }), filename: `${base}.txt` };
}

/* ----------------------------- text → pdf ------------------------------ */

/** Render a plain-text (.txt) file to a clean, paginated A4 PDF. */
export async function txtToPdf(file: File): Promise<ConvertResult> {
  const { default: JsPDF } = await import("jspdf");
  const text = await file.text();
  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  const fontSize = 11;
  const lineH = fontSize * 1.45;
  pdf.setFont("courier", "normal");
  pdf.setFontSize(fontSize);
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
  let y = margin + fontSize;
  for (const raw of rawLines) {
    const wrapped: string[] = raw.length ? pdf.splitTextToSize(raw, maxW) : [""];
    for (const ln of wrapped) {
      if (y + lineH > pageH - margin) { pdf.addPage(); y = margin + fontSize; }
      pdf.text(ln, margin, y);
      y += lineH;
    }
  }
  return { blob: pdf.output("blob"), filename: `${baseName(file.name)}.pdf` };
}

/* ------------------------------ data: csv/json/excel ------------------------------ */

/** Minimal RFC-4180-style CSV parser (handles quotes, commas, newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Serialize a 2-D array to CSV text (quoting cells that need it). */
function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) => r.map((cell) => {
      const v = cell == null ? "" : String(cell);
      return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(","))
    .join("\r\n");
}

/** Coerce an ExcelJS cell value into plain text. */
function cellText(v: any): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join("");
    if (v.hyperlink) return String(v.hyperlink);
    return "";
  }
  return String(v);
}

/** Collect the union of object keys across an array of records (column order). */
function unionKeys(arr: any[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const o of arr) {
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
    }
  }
  return keys;
}

function jsonRows(text: string): any[] {
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error("That isn't valid JSON."); }
  const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [data];
  if (!arr.length) throw new Error("No rows found in the JSON.");
  return arr;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Read the first worksheet of an .xlsx into a 2-D array of strings. */
async function readXlsxRows(file: File): Promise<string[][]> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("No sheet found in this Excel file.");
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as any[]).slice(1);
    rows.push(vals.map((v) => cellText(v)));
  });
  return rows;
}

/** Build an .xlsx blob from a header row + body rows. */
async function writeXlsx(headers: (string | number)[], body: (string | number | null | undefined)[][]): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  if (headers.length) { ws.addRow(headers); ws.getRow(1).font = { bold: true }; }
  for (const r of body) ws.addRow(r as any[]);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as BlobPart], { type: XLSX_MIME });
}

export async function csvToJson(file: File): Promise<ConvertResult> {
  const rows = parseCsv(await file.text()).filter((r) => r.some((c) => c !== ""));
  if (!rows.length) throw new Error("The CSV is empty.");
  const headers = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
  const out = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
  return { blob: new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), filename: `${baseName(file.name)}.json` };
}

export async function jsonToCsv(file: File): Promise<ConvertResult> {
  const arr = jsonRows(await file.text());
  const keys = unionKeys(arr);
  if (!keys.length) throw new Error("The JSON has no object fields to turn into columns.");
  const rows: (string | number | null)[][] = [keys];
  for (const o of arr) {
    rows.push(keys.map((k) => {
      const v = o?.[k];
      return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v;
    }));
  }
  return { blob: new Blob([toCsv(rows)], { type: "text/csv" }), filename: `${baseName(file.name)}.csv` };
}

export async function csvToExcel(file: File): Promise<ConvertResult> {
  const rows = parseCsv(await file.text()).filter((r) => r.some((c) => c !== ""));
  if (!rows.length) throw new Error("The CSV is empty.");
  const blob = await writeXlsx(rows[0], rows.slice(1));
  return { blob, filename: `${baseName(file.name)}.xlsx` };
}

export async function excelToCsv(file: File): Promise<ConvertResult> {
  const rows = await readXlsxRows(file);
  if (!rows.length) throw new Error("The sheet is empty.");
  return { blob: new Blob([toCsv(rows)], { type: "text/csv" }), filename: `${baseName(file.name)}.csv` };
}

export async function excelToJson(file: File): Promise<ConvertResult> {
  const rows = await readXlsxRows(file);
  if (!rows.length) throw new Error("The sheet is empty.");
  const headers = rows[0].map((h, i) => (h && h.trim()) || `column_${i + 1}`);
  const out = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
  return { blob: new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), filename: `${baseName(file.name)}.json` };
}

export async function jsonToExcel(file: File): Promise<ConvertResult> {
  const arr = jsonRows(await file.text());
  const keys = unionKeys(arr);
  if (!keys.length) throw new Error("The JSON has no object fields to turn into columns.");
  const body = arr.map((o) => keys.map((k) => {
    const v = o?.[k];
    return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v;
  }));
  const blob = await writeXlsx(keys, body);
  return { blob, filename: `${baseName(file.name)}.xlsx` };
}

/* --------------------------- heic (iPhone) ----------------------------- */

/** Convert an Apple HEIC/HEIF photo to PNG or JPG (decoded via heic2any). */
export async function heicToImage(file: File, toMime: "image/png" | "image/jpeg", ext: string, quality = 0.92): Promise<ConvertResult> {
  const mod: any = await import("heic2any");
  const heic2any = (mod.default || mod) as (opts: any) => Promise<Blob | Blob[]>;
  let out: Blob | Blob[];
  try {
    out = await heic2any({ blob: file, toType: toMime, quality });
  } catch {
    throw new Error("Could not read this HEIC file. Make sure it's a valid iPhone .heic/.heif photo.");
  }
  const blob = Array.isArray(out) ? out[0] : out;
  return { blob, filename: `${baseName(file.name)}.${ext}` };
}

/* ----------------------- office (pptx/docx) → text --------------------- */

function stripOfficeXml(xml: string): string {
  return xml
    .replace(/<\/(w:p|a:p|p|tr|div|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#\d+;/g, " ").replace(/&[a-z]+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function unzipFile(file: File) {
  const JSZip = (await import("jszip")).default;
  return JSZip.loadAsync(await file.arrayBuffer());
}

/** Extract slide text from a PowerPoint (.pptx) into a .txt file. */
export async function pptxToText(file: File, onProgress?: ProgressCb): Promise<ConvertResult> {
  const z = await unzipFile(file);
  const names = Object.keys(z.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => (parseInt(a.match(/(\d+)/)?.[1] || "0") - parseInt(b.match(/(\d+)/)?.[1] || "0")));
  if (!names.length) throw new Error("No slides found — is this a valid .pptx file?");
  const parts: string[] = [];
  for (let i = 0; i < names.length; i++) {
    onProgress?.({ phase: "Reading slides", current: i + 1, total: names.length });
    const txt = stripOfficeXml(await z.file(names[i])!.async("string"));
    parts.push(`Slide ${i + 1}:\n${txt || "(no text)"}`);
  }
  return { blob: new Blob([parts.join("\n\n").trim() + "\n"], { type: "text/plain" }), filename: `${baseName(file.name)}.txt` };
}

/** Extract document text from a Word (.docx) file into a .txt file. */
export async function docxToText(file: File): Promise<ConvertResult> {
  const z = await unzipFile(file);
  const parts: string[] = [];
  for (const path of ["word/document.xml", "word/header1.xml", "word/footer1.xml"]) {
    const f = z.file(path);
    if (f) parts.push(stripOfficeXml(await f.async("string")));
  }
  const text = parts.filter(Boolean).join("\n\n").trim();
  if (!text) throw new Error("No text found — is this a valid .docx file?");
  return { blob: new Blob([text + "\n"], { type: "text/plain" }), filename: `${baseName(file.name)}.txt` };
}

/* --------------------------- add pages to pdf -------------------------- */

/** Combine PDFs and images (in the order given) into one PDF — i.e. add pages
 *  to a PDF. Existing PDF pages are copied as-is; images become full pages. */
export async function addPagesToPdf(files: File[], onProgress?: ProgressCb): Promise<ConvertResult> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const total = files.length;
  const srcName = files[0]?.name || "document";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({ phase: "Adding pages", current: i + 1, total });
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const src = await PDFDocument.load(await file.arrayBuffer());
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } else {
      const lower = file.name.toLowerCase();
      let bytes: ArrayBuffer;
      let kind: "png" | "jpg";
      if (file.type === "image/png" || lower.endsWith(".png")) {
        bytes = await file.arrayBuffer(); kind = "png";
      } else if (file.type === "image/jpeg" || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        bytes = await file.arrayBuffer(); kind = "jpg";
      } else {
        // Normalize other image formats (webp/gif/bmp/avif) to JPEG first.
        const jpeg = await convertImage(file, "image/jpeg", "jpg");
        bytes = await jpeg.blob.arrayBuffer(); kind = "jpg";
      }
      const img = kind === "png" ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
  }
  if (out.getPageCount() === 0) throw new Error("Add at least one PDF or image.");
  const pdfBytes = await out.save();
  return { blob: new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), filename: `${baseName(srcName)}-combined.pdf` };
}

/** Trigger a browser download for a produced blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
