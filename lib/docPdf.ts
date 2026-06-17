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
