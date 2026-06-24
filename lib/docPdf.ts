"use client";
import { A4 } from "./docTypes";

/**
 * Render an array of pre-paginated A4 page nodes to a multi-page PDF.
 * Each node is captured separately (one node = one page), so nothing is ever
 * sliced across a page boundary — no split lines, duplication, or seam artifacts.
 */
export async function renderPagesToPdf(nodes: HTMLElement[], filename = "document.pdf") {
  const [{ jsPDF }, h2c] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const html2canvas = (h2c as any).default;

  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [A4.wPx, A4.hPx] });
  const yield_ = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  for (let i = 0; i < nodes.length; i++) {
    await yield_(); // let the browser paint (keeps the export spinner alive) between pages
    const canvas = await html2canvas(nodes[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: A4.wPx });
    const img = canvas.toDataURL("image/jpeg", 0.94);
    if (i > 0) pdf.addPage([A4.wPx, A4.hPx], "portrait");
    pdf.addImage(img, "JPEG", 0, 0, A4.wPx, A4.hPx);
  }
  await yield_();
  pdf.save(filename);
}

/**
 * Minimal export for a single tall DocCanvas node — slices the capture across
 * A4 pages. Used by the shared-doc viewer (the editor uses the block-aware
 * renderPagesToPdf above).
 */
export async function exportDocNodeToPdf(node: HTMLElement, filename = "document.pdf") {
  const [{ jsPDF }, h2c] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const html2canvas = (h2c as any).default;
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: A4.wPx });
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;
  const img = canvas.toDataURL("image/jpeg", 0.94);

  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(img, "JPEG", 0, position, pageW, imgH, undefined, "FAST");
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(img, "JPEG", 0, position, pageW, imgH, undefined, "FAST");
    heightLeft -= pageH;
  }
  pdf.save(filename);
}
