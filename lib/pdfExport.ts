"use client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Wait until every <img> inside a node has finished loading/decoding.
 * Without this, html2canvas can snapshot a chart's SVG data-URI before it
 * has painted, producing a blank chart area in the exported PDF.
 */
async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      // Already loaded and has dimensions → nothing to wait for.
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        // decode() is the most reliable signal; fall back to load/error.
        if (typeof img.decode === "function") {
          img.decode().then(done).catch(() => {
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
        } else {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }
        // Safety timeout so a stuck image never blocks the whole export.
        window.setTimeout(done, 3000);
      });
    }),
  );
}

/**
 * Capture a list of slide DOM nodes and emit a 16:9 landscape PDF.
 * Each node should already be rendered with its final visual state.
 */
export async function exportSlidesToPdf(
  nodes: HTMLElement[],
  filename: string,
): Promise<void> {
  // 16:9 landscape, 13.333in x 7.5in (matches slide aspect).
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "in",
    format: [13.333, 7.5],
    compress: true,
  });

  // Make sure web fonts are ready so text metrics are stable on capture.
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // Wait for charts / images on this slide to decode before snapshotting.
    await waitForImages(node);
    // One extra frame so any layout from the decode settles.
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    // Render at 2x for sharper output. Pass explicit pixel dims so html2canvas
    // captures the full 1280x720 slide regardless of how the DOM measures.
    const canvas = await html2canvas(node, {
      backgroundColor: null,
      scale: 2,
      width: 1280,
      height: 720,
      windowWidth: 1280,
      windowHeight: 720,
      useCORS: true,
      logging: false,
    });
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([13.333, 7.5], "landscape");
    pdf.addImage(data, "JPEG", 0, 0, 13.333, 7.5, undefined, "FAST");
  }

  pdf.save(filename);
}
