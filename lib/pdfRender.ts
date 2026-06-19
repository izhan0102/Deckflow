/**
 * Client-side PDF -> page images, for the PDF-to-PPT presenter.
 *
 * Runs entirely in the browser — the uploaded file never leaves the device.
 * Each PDF page is rasterized to a JPEG data URL so it can be shown as a
 * full-screen "slide" and as a thumbnail. pdfjs is dynamically imported so its
 * ~1MB bundle is only fetched when someone actually uploads a PDF.
 */

const PDFJS_VERSION = "4.10.38";
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export type RenderProgress = { page: number; total: number };
export type RenderedPdf = { pages: string[]; aspect: number };

/** Cancellation handle — set `.cancelled = true` to stop mid-render. */
export type CancelToken = { cancelled: boolean };

/**
 * Rasterize every page of a PDF File to a JPEG data URL. Returns the page
 * images (in order) and the first page's aspect ratio (w/h).
 */
export async function renderPdfToImages(
  file: File,
  onProgress?: (p: RenderProgress) => void,
  cancel?: CancelToken,
): Promise<RenderedPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  let aspect = 16 / 9;

  try {
    const total = doc.numPages;
    for (let n = 1; n <= total; n++) {
      if (cancel?.cancelled) break;
      onProgress?.({ page: n, total });
      const page = await doc.getPage(n);
      try {
        const base = page.getViewport({ scale: 1 });
        // Render crisp (cap ~1920px wide) but bounded so big PDFs don't OOM.
        const targetWidth = Math.min(1920, Math.max(1280, base.width * 2));
        const scale = targetWidth / base.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        if (n === 1 && canvas.height > 0) aspect = canvas.width / canvas.height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          // White matte behind transparent PDFs so nothing renders black.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          pages.push(canvas.toDataURL("image/jpeg", 0.85));
        }
        canvas.width = 0;
        canvas.height = 0;
      } finally {
        page.cleanup();
      }
    }
  } finally {
    doc.destroy();
  }

  return { pages, aspect };
}
