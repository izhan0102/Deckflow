/**
 * Client-side PDF -> text extraction.
 *
 * Runs entirely in the browser. The file never leaves the user's machine.
 * Two passes:
 *   1. Text layer  — pdfjs reads the embedded text of normal, digital PDFs.
 *   2. OCR fallback — for scanned/image-only pages (or PDFs with almost no
 *      extractable text), we rasterize each page to a canvas and run
 *      tesseract.js OCR on it.
 *
 * Everything here is dynamically imported so pdfjs (~1MB) and tesseract
 * (~2MB + language data) are only fetched when a user actually uploads a
 * PDF — they stay out of the main app bundle.
 */

export type PdfProgress = {
  /** "reading" = text layer, "ocr" = optical recognition, "done". */
  phase: "reading" | "ocr" | "done";
  /** 1-based current page being processed. */
  page?: number;
  /** Total page count. */
  total?: number;
};

// Pin the pdfjs worker to the exact installed version via CDN. This avoids
// bundler-specific worker wiring and always matches the API version below.
const PDFJS_VERSION = "4.10.38";
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

// If a page yields fewer than this many characters from its text layer, we
// treat it as image-only and send it to OCR instead.
const MIN_CHARS_PER_PAGE = 16;

/** Lazy-load pdfjs and configure its worker once. */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // pdfjs needs a worker. Point it at the version-matched CDN build.
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return pdfjs;
}

/**
 * Extract text from a PDF File. Tries the embedded text layer first and
 * falls back to OCR for pages that look scanned. Returns the combined text.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (p: PdfProgress) => void,
): Promise<string> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  try {
    const total = doc.numPages;
    const pageTexts: string[] = [];
    const ocrPages: number[] = [];

    // -------- Pass 1: text layer --------
    for (let n = 1; n <= total; n++) {
      onProgress?.({ phase: "reading", page: n, total });
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        const text = content.items
          .map((it: any) => (typeof it.str === "string" ? it.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pageTexts.push(text);
        if (text.length < MIN_CHARS_PER_PAGE) ocrPages.push(n);
      } finally {
        page.cleanup();
      }
    }

    // -------- Pass 2: OCR for image-only pages --------
    if (ocrPages.length > 0) {
      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        try {
          for (const n of ocrPages) {
            try {
              onProgress?.({ phase: "ocr", page: n, total });
              const dataUrl = await renderPageToDataUrl(doc, n);
              if (!dataUrl) continue;
              const { data } = await worker.recognize(dataUrl);
              const ocrText = (data.text || "").replace(/\s+/g, " ").trim();
              if (ocrText) pageTexts[n - 1] = ocrText;
            } catch (pageErr) {
              console.warn(`[pdfText] OCR failed on page ${n}:`, pageErr);
            }
          }
        } finally {
          await worker.terminate();
        }
      } catch (e) {
        // OCR is best-effort. If it fails we still return whatever the text
        // layer produced.
        // eslint-disable-next-line no-console
        console.warn("[pdfText] OCR pass failed:", e);
      }
    }

    onProgress?.({ phase: "done", total });
    return pageTexts.filter(Boolean).join("\n\n").trim();
  } finally {
    doc.destroy();
  }
}

/** Rasterize a single PDF page to a PNG data URL for OCR. */
async function renderPageToDataUrl(doc: any, n: number): Promise<string | null> {
  const page = await doc.getPage(n);
  try {
    const canvas = document.createElement("canvas");
    try {
      // Scale up so OCR has enough resolution to read small print, but cap the
      // canvas so a huge page doesn't blow out memory.
      const baseViewport = page.getViewport({ scale: 1 });
      const targetWidth = Math.min(1600, Math.max(1000, baseViewport.width * 2));
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      await page.render({ canvasContext: ctx, viewport }).promise;
      return canvas.toDataURL("image/png");
    } finally {
      // Free the canvas.
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    page.cleanup();
  }
}
