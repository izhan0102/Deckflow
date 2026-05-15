"use client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    // Render at 2x for sharper output.
    const canvas = await html2canvas(node, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([13.333, 7.5], "landscape");
    pdf.addImage(data, "JPEG", 0, 0, 13.333, 7.5, undefined, "FAST");
  }

  pdf.save(filename);
}
