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

/**
 * Export slides to a real .pptx while preserving EVERY pixel of the design.
 *
 * Native shape rebuilding (pptxgenjs text/shapes) loses fonts, textures,
 * decorations, and per-element styling. Instead we capture each slide exactly
 * like the PDF export (html2canvas at 2x) and place that image full-bleed on a
 * 16:9 PowerPoint slide. The result opens in PowerPoint/Keynote/Google Slides
 * looking identical to the editor. pptxgenjs is dynamically imported so its
 * bundle only loads when someone actually exports.
 */
export async function exportSlidesToPptx(
  nodes: HTMLElement[],
  filename: string,
): Promise<void> {
  const PptxGen = (await import("pptxgenjs")).default;
  const pptx = new PptxGen();
  // 13.333in x 7.5in = 16:9 widescreen (matches the slide aspect exactly).
  pptx.defineLayout({ name: "EZD_16x9", width: 13.333, height: 7.5 });
  pptx.layout = "EZD_16x9";

  try { await (document as any).fonts?.ready; } catch { /* ignore */ }

  for (const node of nodes) {
    await waitForImages(node);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

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
    // PNG keeps text edges crisp (no JPEG ringing around letters).
    const data = canvas.toDataURL("image/png");
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 });
  }

  // Triggers the browser download directly.
  await pptx.writeFile({ fileName: filename });
}

/**
 * Capture a list of handout "page" nodes (each a US-Letter portrait page
 * containing a slide thumbnail plus its speaker notes) into a portrait PDF.
 * Pages are authored at 816x1056 px (8.5x11in @ 96dpi).
 */
export async function exportHandoutToPdf(
  nodes: HTMLElement[],
  filename: string,
): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [8.5, 11],
    compress: true,
  });

  try { await (document as any).fonts?.ready; } catch { /* ignore */ }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    await waitForImages(node);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      width: 816,
      height: 1056,
      windowWidth: 816,
      windowHeight: 1056,
      useCORS: true,
      logging: false,
    });
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([8.5, 11], "portrait");
    pdf.addImage(data, "JPEG", 0, 0, 8.5, 11, undefined, "FAST");
  }

  pdf.save(filename);
}
