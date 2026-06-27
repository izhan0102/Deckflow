/**
 * Client-side Mermaid rendering helpers.
 *
 * Mermaid only renders in the browser (it needs the DOM), so when the deck AI
 * (server) creates a diagram it stores the Mermaid SOURCE on a `diagram`
 * element with an empty dataUrl. After the new deck arrives on the client we
 * render those pending diagrams to SVG here and fill in the dataUrl.
 */
import type { Deck, UploadedImage } from "./types";

let MERMAID_SEQ = 0;

/** Render Mermaid source to an SVG string, forcing all text/lines to one
 *  colour (black for light slides, white for dark). Returns null on error. */
export async function renderMermaidSvg(code: string, color: "black" | "white" = "black"): Promise<string | null> {
  try {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default", htmlLabels: false, flowchart: { htmlLabels: false } });
    const id = `dgm-ai-${++MERMAID_SEQ}`;
    let { svg } = await mermaid.render(id, code);
    const M = color === "white" ? "#ffffff" : "#000000";
    const F = color === "white" ? "rgba(255,255,255,0.08)" : "#ffffff";
    const css = `<style>text,tspan,.nodeLabel,.edgeLabel,.label,.titleText,.messageText,.loopText,.noteText,foreignObject div,foreignObject span,foreignObject p{fill:${M} !important;color:${M} !important}.edgePath path,.flowchart-link,line,.messageLine0,.messageLine1,path.relation,.actor-line,.divider{stroke:${M} !important}marker path,marker polygon{fill:${M} !important;stroke:${M} !important}.node rect,.node circle,.node polygon,.node ellipse,.node path,.cluster rect,rect.actor,.actor,.note,.labelBox{fill:${F} !important;stroke:${M} !important}.edgeLabel rect,.label-container{fill:transparent !important}</style>`;
    svg = svg.replace(/(<svg[^>]*>)/, `$1${css}`);
    return svg;
  } catch {
    return null;
  }
}

export function mermaidSvgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function aspectOf(svg: string): number {
  const vb = svg.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
  if (vb) { const w = parseFloat(vb[1]); const h = parseFloat(vb[2]); if (w > 0 && h > 0) return w / h; }
  return 16 / 9;
}

/** Ask the diagram API to repair Mermaid that failed to render. */
async function repairMermaid(code: string, token?: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch("/api/diagram", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fix: code, error: "Mermaid failed to render (parse error)." }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.mermaid ? (data.mermaid as string) : null;
  } catch {
    return null;
  }
}

/** Render any diagram element that has Mermaid source but no rendered image
 *  yet (created by the deck AI), sizing it to fit. If the Mermaid fails to
 *  render, it asks the API to repair it once (needs a token). Returns a new
 *  Deck if any diagram was rendered, otherwise the same deck. */
export async function renderDeckDiagrams(deck: Deck, token?: string | null): Promise<Deck> {
  const pending = (im: UploadedImage) => im.kind === "diagram" && !!im.mermaid && !im.dataUrl;
  if (!deck.slides?.some((s) => (s.uploadedImages || []).some(pending))) return deck;

  let changed = false;
  const slides = await Promise.all(deck.slides.map(async (s) => {
    if (!(s.uploadedImages || []).some(pending)) return s;
    const imgs = await Promise.all((s.uploadedImages || []).map(async (im) => {
      if (!pending(im)) return im;
      let code = im.mermaid as string;
      let svg = await renderMermaidSvg(code, "black");
      if (!svg) {
        const fixed = await repairMermaid(code, token);
        if (fixed) { const s2 = await renderMermaidSvg(fixed, "black"); if (s2) { code = fixed; svg = s2; } }
      }
      if (!svg) return im; // couldn't render even after repair — leave it as-is
      changed = true;
      const aspect = aspectOf(svg);
      let w = 9.5;
      let h = w / aspect;
      if (h > 5.4) { h = 5.4; w = h * aspect; }
      if (w > 11.5) { w = 11.5; h = w / aspect; }
      return { ...im, mermaid: code, dataUrl: mermaidSvgToDataUrl(svg), w, h, x: (13.333 - w) / 2, y: im.y || 1.7 };
    }));
    return { ...s, uploadedImages: imgs };
  }));
  return changed ? { ...deck, slides } : deck;
}
