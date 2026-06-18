"use client";
import { useEffect, useState } from "react";

const STAGES = [
  "Researching the topic",
  "Planning the structure",
  "Writing the sections",
  "Adding data, tables & charts",
  "Designing the layout",
  "Putting on the finishing touches",
];

/**
 * Full-screen overlay shown while a document is generated. Theme-safe: the
 * page surface uses theme tokens (so text is always readable in light/dark),
 * while the animated "paper" is a real white sheet with a single brand accent.
 */
export default function DocGenOverlay({ pages }: { pages?: number }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 1700);
    return () => clearInterval(t);
  }, []);

  const ACC = "#1a1a1a"; // the paper is always white, so use ink-black (monochrome)
  const line = (w: number, delay: number, h = 6) => (
    <div style={{ height: h, width: `${w}%`, borderRadius: 3, background: "#0f172a", opacity: 0.14, marginTop: 7, animation: `dgRise .5s ${delay}s both` }} />
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "var(--ezd-bg-page)", display: "grid", placeItems: "center", overflow: "hidden" }}>
      {/* soft animated glow */}
      <div aria-hidden style={{ position: "absolute", width: 620, height: 620, borderRadius: "50%", background: `radial-gradient(circle, ${ACC}22, transparent 60%)`, filter: "blur(20px)", animation: "dgGlow 4s ease-in-out infinite" }} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        {/* stacked paper */}
        <div style={{ position: "relative", width: 250, height: 332, animation: "dgFloat 3.4s ease-in-out infinite" }}>
          {/* back sheets for depth */}
          <div style={{ position: "absolute", inset: 0, transform: "rotate(-5deg) translate(10px,8px)", background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px -20px rgba(0,0,0,.4)", opacity: 0.5 }} />
          <div style={{ position: "absolute", inset: 0, transform: "rotate(3deg) translate(-6px,4px)", background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px -20px rgba(0,0,0,.4)", opacity: 0.7 }} />
          {/* front sheet */}
          <div style={{ position: "absolute", inset: 0, background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 30px 60px -20px rgba(0,0,0,.45)", overflow: "hidden" }}>
            {/* accent heading bar */}
            <div style={{ height: 9, width: "55%", borderRadius: 4, background: ACC, animation: "dgRise .5s 0s both" }} />
            <div style={{ height: 5, width: "34%", borderRadius: 3, background: ACC, opacity: 0.5, marginTop: 8, animation: "dgRise .5s .1s both" }} />
            {line(96, 0.35)}
            {line(90, 0.45)}
            {line(98, 0.55)}
            {line(72, 0.65)}
            {/* mini bar chart */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 56, marginTop: 16 }}>
              {[42, 70, 54, 96, 64].map((h, i) => (
                <div key={i} style={{ width: 16, height: `${h}%`, borderRadius: "3px 3px 0 0", background: ACC, opacity: 0.85, transformOrigin: "bottom", animation: `dgGrow .7s ${0.8 + i * 0.12}s both` }} />
              ))}
            </div>
            {line(88, 1.5)}
            {line(60, 1.6)}
            {/* shimmer sweep */}
            <div aria-hidden style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "55%", background: "linear-gradient(105deg, transparent, rgba(255,255,255,.65), transparent)", animation: "dgSweep 2.2s ease-in-out infinite" }} />
          </div>
        </div>

        {/* status */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ezd-fg-strong)", minHeight: 22 }}>
            {STAGES[stage]}
            <span style={{ animation: "dgDots 1.4s steps(4) infinite" }}>…</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--ezd-fg-quiet)" }}>
            {pages ? `Writing your ${pages}-page document` : "Writing your document"} — this can take a moment.
          </div>
          {/* progress track */}
          <div style={{ marginTop: 16, width: 240, height: 4, borderRadius: 99, background: "var(--ezd-bg-hover)", overflow: "hidden", marginInline: "auto" }}>
            <div style={{ height: "100%", width: "40%", borderRadius: 99, background: ACC, animation: "dgTrack 1.6s ease-in-out infinite" }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dgFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes dgGlow { 0%,100% { transform: scale(1); opacity:.8 } 50% { transform: scale(1.12); opacity:1 } }
        @keyframes dgSweep { 0% { transform: translateX(-120%) } 60%,100% { transform: translateX(320%) } }
        @keyframes dgRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes dgGrow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes dgTrack { 0% { transform: translateX(-110%) } 100% { transform: translateX(360%) } }
        @keyframes dgDots { 0% { opacity: .2 } 50% { opacity: 1 } 100% { opacity: .2 } }
      `}</style>
    </div>
  );
}
