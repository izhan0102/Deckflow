"use client";
import { useEffect, useRef } from "react";

/**
 * Subtle animated grid + glow that follows the cursor. Pure CSS / canvas-free.
 * Looks expensive, costs nothing.
 */
export default function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={
        {
          "--mx": "50%",
          "--my": "30%",
        } as React.CSSProperties
      }
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(circle at var(--mx) var(--my), black 0%, black 30%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(circle at var(--mx) var(--my), black 0%, black 30%, transparent 70%)",
        }}
      />
      {/* Glow blob */}
      <div
        className="absolute h-[80vh] w-[80vh] rounded-full"
        style={{
          left: "var(--mx)",
          top: "var(--my)",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(closest-side, rgba(124,92,255,0.28), rgba(124,92,255,0.05) 60%, transparent 80%)",
          transition: "left 220ms ease-out, top 220ms ease-out",
          filter: "blur(20px)",
        }}
      />
      {/* Top color wash */}
      <div className="absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-violet-500/10 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-emerald-500/5 via-transparent to-transparent" />
    </div>
  );
}
