"use client";

/**
 * Editorial backdrop for the masthead-style landing page.
 *
 * Minimal monochrome. Two quiet things that read on either a pure-black
 * or pure-white field via theme tokens:
 *   1. A faint hairline grid that fades to the edges.
 *   2. A subtle bottom haze so the fold reads like a printed broadsheet.
 */
export default function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Hairline grid — uses the theme divider tone so it inverts cleanly. */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(var(--ezd-divider) 1px, transparent 1px), linear-gradient(90deg, var(--ezd-divider) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 50% 30%, black 0%, black 35%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 30%, black 0%, black 35%, transparent 80%)",
        }}
      />

      {/* Quiet bottom haze toward the page color */}
      <div
        className="absolute inset-x-0 bottom-0 h-[28vh]"
        style={{
          background:
            "linear-gradient(to top, var(--ezd-bg-page-deep), transparent 70%)",
        }}
      />
    </div>
  );
}
