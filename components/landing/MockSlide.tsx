"use client";

/**
 * Static "deck preview" used on the landing page. Showcases the design language
 * without spinning up the full editor.
 */
export function MockSlide() {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0B0B0F] shadow-[0_30px_80px_-20px_rgba(124,92,255,0.35)]">
      {/* Accent bar */}
      <div className="absolute left-0 top-0 h-full w-[6px] bg-violet-400" />
      {/* Title */}
      <div className="absolute left-[6%] top-[12%]">
        <div className="mb-2 h-1 w-10 rounded bg-violet-400" />
        <h3 className="text-3xl font-bold tracking-tight text-white">
          Q3 Investor Update
        </h3>
        <p className="mt-1 text-sm text-white/60">Traction, retention, and the next round</p>
      </div>
      {/* Two-column body */}
      <div className="absolute inset-x-[6%] bottom-[12%] grid grid-cols-2 gap-6 text-[13px] text-white/85">
        <ul className="space-y-2">
          {["Revenue grew 38% QoQ", "Net retention at 124%", "Three new enterprise logos"].map((b) => (
            <li key={b} className="flex gap-2"><span className="text-violet-400">•</span> {b}</li>
          ))}
        </ul>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/50">ARR</div>
          <div className="mt-1 text-3xl font-bold text-violet-300">$4.2M</div>
          <div className="text-[10px] text-white/40">+38% vs last quarter</div>
        </div>
      </div>
      {/* Footer */}
      <div className="absolute inset-x-[6%] bottom-[3%] flex justify-between text-[10px] text-white/40">
        <span>Acme Inc · Q3 2026</span>
        <span>3 / 12</span>
      </div>
    </div>
  );
}
