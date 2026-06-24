import { ImageResponse } from "next/og";

/**
 * Dynamic OG image for social shares (LinkedIn, WhatsApp, X, Discord …).
 *
 * Black canvas with a subtle white dot grid, the EXdeck wordmark centered,
 * and feature-icon chips scattered around it (presentations, documents,
 * spreadsheets, charts, images, AI analysis). 1200×630 PNG.
 */

export const runtime = "edge";
export const alt = "EXdeck — AI presentations, documents, spreadsheets, resumes and document analysis.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const stroke = { fill: "none", stroke: "#FFFFFF", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

// Feature icons (lucide-style), each scattered with a position + tilt.
const CHIPS: { svg: React.ReactNode; top: number; left: number; rot: number }[] = [
  { top: 96, left: 120, rot: -10, svg: (<svg width="44" height="44" viewBox="0 0 24 24" {...stroke}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>) }, // presentation
  { top: 70, left: 980, rot: 9, svg: (<svg width="44" height="44" viewBox="0 0 24 24" {...stroke}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>) }, // document
  { top: 420, left: 86, rot: 8, svg: (<svg width="44" height="44" viewBox="0 0 24 24" {...stroke}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>) }, // table/sheet
  { top: 446, left: 1000, rot: -8, svg: (<svg width="44" height="44" viewBox="0 0 24 24" {...stroke}><path d="M3 3v18h18" /><path d="M7 16v-5M12 16V7M17 16v-8" /></svg>) }, // chart
  { top: 250, left: 40, rot: 6, svg: (<svg width="44" height="44" viewBox="0 0 24 24" {...stroke}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>) }, // image
  { top: 250, left: 1080, rot: -6, svg: (<svg width="44" height="44" viewBox="0 0 24 24" {...stroke}><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" /></svg>) }, // sparkle / AI
];

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        {/* dot grid (Satori renders divs, not radial-gradient) */}
        {Array.from({ length: 20 * 38 }).map((_, i) => {
          const r = Math.floor(i / 38), c = i % 38;
          return (
            <div key={i} style={{ position: "absolute", top: r * 32 + 12, left: c * 32 + 10, width: 4, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.28)" }} />
          );
        })}
        {/* scattered feature-icon chips */}
        {CHIPS.map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: c.top,
              left: c.left,
              width: 88,
              height: 88,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.14)",
              transform: `rotate(${c.rot}deg)`,
              boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8)",
            }}
          >
            {c.svg}
          </div>
        ))}

        {/* center wordmark */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 10 }}>
          <div style={{ display: "flex", fontSize: 172, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
            <span>EX</span>
            <span style={{ color: "rgba(255,255,255,0.78)" }}>deck</span>
          </div>
          <div style={{ marginTop: 26, fontSize: 30, color: "rgba(255,255,255,0.72)", fontWeight: 500, textAlign: "center" }}>
            AI presentations, documents, spreadsheets &amp; analysis
          </div>
          <div
            style={{
              marginTop: 30,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontSize: 22,
              color: "rgba(255,255,255,0.82)",
              fontWeight: 600,
            }}
          >
            <span>Free to try</span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span>exdeck.xyz</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
