"use client";
import { useEffect, useState } from "react";
import { Monitor, Sparkles } from "lucide-react";

/**
 * Full-screen overlay shown when the viewport is too small for DeckFlow's
 * editor. Pure CSS handles the common case via a media query; JS is a
 * second layer that also checks pointer type so a touch-only laptop can
 * still be recognised correctly.
 */
export default function MobileGate() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const narrow = window.innerWidth < 900;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setIsMobile(narrow || (window.innerWidth < 1100 && coarse));
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (!isMobile) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "linear-gradient(to bottom, #0a0a0a, #050505)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        color: "#fff",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <div style={{
          margin: "0 auto 18px",
          width: 56, height: 56,
          display: "grid", placeItems: "center",
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(124,92,255,0.25), rgba(34,197,94,0.15))",
          border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <Monitor size={26} color="#c4b5fd" />
        </div>

        <div style={{
          marginBottom: 12,
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          fontSize: 11, color: "rgba(255,255,255,0.7)",
        }}>
          <Sparkles size={11} color="#c4b5fd" />
          DeckFlow
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 600,
          letterSpacing: "-0.01em", lineHeight: 1.25,
          margin: "0 0 10px",
        }}>
          DeckFlow works best on desktop
        </h1>

        <p style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: 14, lineHeight: 1.55,
          margin: "0 0 16px",
        }}>
          The editor lets you drag text boxes, resize images, and present
          full-screen, things that need a real keyboard and pointer. A mobile
          experience is on the way.
        </p>

        <p style={{
          color: "rgba(255,255,255,0.45)",
          fontSize: 12, lineHeight: 1.5,
          margin: 0,
        }}>
          Open this page on a laptop or desktop browser to continue.
        </p>
      </div>
    </div>
  );
}
