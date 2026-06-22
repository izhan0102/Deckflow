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
export async function pdfToImages(file: File, toMime: "image/png" | "image/jpeg", ext: string, onProgress?: ProgressCb): Promise<ConvertResult> {
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
