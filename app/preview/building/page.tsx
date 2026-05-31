"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import GenerateOverlay from "@/components/GenerateOverlay";

/**
 * Standalone preview of the "deck is building" animation. No auth, no
 * generation, no API calls — just mounts the overlay so we can iterate
 * on the animation in isolation.
 *
 * Open at /preview/building. The overlay stays on for ~14 seconds,
 * then auto-closes and shows a small "play again" button so the
 * cycle's easy to retrigger.
 */
export default function BuildingPreview() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    // Two full build cycles is enough to read the animation.
    // After that, the user can hit "Play again".
    const t = window.setTimeout(() => setOpen(false), 10000);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <main
      className="relative min-h-screen text-white"
      style={{ background: "#000000" }}
    >
      {/* Quiet background while the overlay is closed */}
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Animation preview
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Building your deck
        </h1>
        <p className="text-sm text-white/55">
          A standalone preview of the generation overlay. Watch the cards
          assemble — kicker, title, body, footer — then click Play again.
        </p>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-[12.5px] font-semibold text-[#03070F] transition hover:bg-white/90"
          >
            ▶ Play again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2 text-[12.5px] text-white/85 transition hover:bg-white/10"
          >
            Back home
          </Link>
        </div>
      </div>

      <GenerateOverlay open={open} />
    </main>
  );
}
