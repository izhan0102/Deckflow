/**
 * Universal client-side text extraction for the Document Analyser.
 *
 * Everything runs in the browser — files never leave the device. Handles:
 *   • PDF            → pdfjs text layer (+ OCR fallback, via lib/pdfText)
 *   • DOCX/PPTX/XLSX → unzipped Office XML, stripped to text (jszip)
 *   • Images         → tesseract.js OCR
 *   • Everything else (txt, md, json, csv, code, yaml, html, …) → raw text
 *
 * Heavy libs are dynamically imported so they're only fetched on use.
 */
import { extractPdfText } from "./pdfText";

/** Max characters kept per document (keeps the AI prompt bounded). */
export const PER_DOC_CHARS = 16000;

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff"]);
const OFFICE_ZIP = new Set(["docx", "pptx", "xlsx", "xlsm"]);

export type ExtractProgress = { phase: string; page?: number; total?: number };

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function stripXml(xml: string): string {
  return xml
    .replace(/<\/(w:p|a:p|p|tr|div|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#\d+;/g, " ").replace(/&[a-z]+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function unzip(file: File) {
  const JSZip = (await import("jszip")).default;
  return JSZip.loadAsync(await file.arrayBuffer());
}

async function extractDocx(file: File): Promise<string> {
  const z = await unzip(file);
  const parts: string[] = [];
  for (const path of ["word/document.xml", "word/header1.xml", "word/footer1.xml"]) {
    const f = z.file(path);
    if (f) parts.push(stripXml(await f.async("string")));
  }
  return parts.filter(Boolean).join("\n\n");
}

async function extractPptx(file: File): Promise<string> {
  const z = await unzip(file);
  const names = Object.keys(z.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => (parseInt(a.match(/(\d+)/)?.[1] || "0") - parseInt(b.match(/(\d+)/)?.[1] || "0")));
  const out: string[] = [];
  for (let i = 0; i < names.length; i++) {
    const txt = stripXml(await z.file(names[i])!.async("string"));
    if (txt) out.push(`Slide ${i + 1}:\n${txt}`);
  }
  return out.join("\n\n");
}

async function extractXlsx(file: File): Promise<string> {
  const z = await unzip(file);
  const ss = z.file("xl/sharedStrings.xml");
  const parts: string[] = [];
  if (ss) parts.push(stripXml(await ss.async("string")));
  // Inline strings / numbers from each sheet (best-effort).
  const sheets = Object.keys(z.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  for (const s of sheets.slice(0, 8)) {
    const xml = await z.file(s)!.async("string");
    const nums = (xml.match(/<v>([^<]+)<\/v>/g) || []).map((m) => m.replace(/<\/?v>/g, "")).slice(0, 2000);
    if (nums.length) parts.push(nums.join(" "));
  }
  return parts.filter(Boolean).join("\n\n");
}

async function extractImage(file: File, onProgress?: (p: ExtractProgress) => void): Promise<string> {
  onProgress?.({ phase: "ocr" });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const url = URL.createObjectURL(file);
    try {
      const { data } = await worker.recognize(url);
      return (data.text || "").replace(/\s+\n/g, "\n").trim();
    } finally { URL.revokeObjectURL(url); }
  } finally { await worker.terminate(); }
}

/** Extract readable text from any supported file. Returns "" if nothing found. */
export async function extractFileText(file: File, onProgress?: (p: ExtractProgress) => void): Promise<string> {
  const ext = extOf(file.name);
  let text = "";
  try {
    if (ext === "pdf") text = await extractPdfText(file, (p) => onProgress?.(p));
    else if (ext === "docx") text = await extractDocx(file);
    else if (ext === "pptx") text = await extractPptx(file);
    else if (ext === "xlsx" || ext === "xlsm") text = await extractXlsx(file);
    else if (IMAGE_EXT.has(ext)) text = await extractImage(file, onProgress);
    else text = await file.text(); // txt, md, json, csv, code, yaml, html, …
  } catch {
    // Last-ditch: try reading as plain text.
    try { text = await file.text(); } catch { text = ""; }
  }
  return text.slice(0, PER_DOC_CHARS).trim();
}

export { OFFICE_ZIP };
