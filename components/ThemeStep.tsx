"use client";
import { useState } from "react";
import { PRESET_THEMES, type Theme } from "@/lib/themes";
import { Palette } from "lucide-react";

type Props = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  onBack: () => void;
  onGenerate: () => void;
  loading: boolean;
};

export default function ThemeStep({ theme, setTheme, onBack, onGenerate, loading }: Props) {
  const [custom, setCustom] = useState<Theme>({
    id: "custom",
    name: "Custom",
    bg: theme.bg,
    fg: theme.fg,
    accent: theme.accent,
    muted: theme.muted,
    font: theme.font,
  });
  const [tab, setTab] = useState<"preset" | "custom">("preset");

  const useCustom = () => {
    setTheme({ ...custom, id: "custom", name: "Custom" });
    setTab("custom");
  };

  return (
    <div className="fade-in mx-auto w-full max-w-5xl">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <Palette size={12} /> Step 2 of 3
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Pick a theme</h1>
        <p className="mt-2 text-white/60">
          Choose a preset, or build your own colors.
        </p>
      </div>

      <div className="mb-4 flex justify-center gap-2">
        <button
          onClick={() => setTab("preset")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            tab === "preset" ? "bg-white text-black" : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setTab("custom")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            tab === "custom" ? "bg-white text-black" : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          Custom
        </button>
      </div>

      {tab === "preset" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {PRESET_THEMES.map((t) => {
            const active = theme.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t)}
                className={`group overflow-hidden rounded-2xl border transition ${
                  active ? "border-white/60 ring-2 ring-white/40" : "border-white/10 hover:border-white/30"
                }`}
              >
                <ThemePreview theme={t} />
                <div className="flex items-center justify-between bg-black/40 px-3 py-2 text-left">
                  <span className="text-sm">{t.name}</span>
                  <div className="flex gap-1">
                    <Swatch color={t.bg} />
                    <Swatch color={t.fg} />
                    <Swatch color={t.accent} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tab === "custom" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <ColorRow label="Background" value={custom.bg} onChange={(v) => setCustom({ ...custom, bg: v })} />
            <ColorRow label="Text" value={custom.fg} onChange={(v) => setCustom({ ...custom, fg: v })} />
            <ColorRow label="Accent" value={custom.accent} onChange={(v) => setCustom({ ...custom, accent: v })} />
            <ColorRow label="Muted" value={custom.muted} onChange={(v) => setCustom({ ...custom, muted: v })} />
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-white/50">Font</label>
              <select
                value={custom.font}
                onChange={(e) => setCustom({ ...custom, font: e.target.value as Theme["font"] })}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
              >
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </div>
            <button
              onClick={useCustom}
              className="w-full rounded-xl bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
            >
              Use this theme
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <ThemePreview theme={custom} large />
          </div>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          ← Back
        </button>
        <button
          disabled={loading}
          onClick={onGenerate}
          className="rounded-xl bg-white px-5 py-2.5 font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Generating…" : "Generate deck →"}
        </button>
      </div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-white/20"
      style={{ background: color }}
    />
  );
}

function ColorRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-white/50">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm outline-none"
        />
      </div>
    </div>
  );
}

function ThemePreview({ theme, large }: { theme: Theme; large?: boolean }) {
  const fontFamily =
    theme.font === "serif" ? "Georgia, serif"
    : theme.font === "mono"  ? "Consolas, monospace"
    : "ui-sans-serif, system-ui";
  return (
    <div
      className={`flex w-full flex-col justify-between p-4 ${large ? "h-72" : "h-32"}`}
      style={{ background: theme.bg, fontFamily }}
    >
      <div>
        <div
          className="font-bold leading-tight"
          style={{ color: theme.accent, fontSize: large ? 32 : 14 }}
        >
          Sample Title
        </div>
        <div style={{ color: theme.muted, fontSize: large ? 14 : 9, marginTop: 2 }}>
          A short subtitle line
        </div>
      </div>
      <div style={{ color: theme.fg, fontSize: large ? 14 : 9 }}>
        • First key point<br />
        • Second key point
      </div>
    </div>
  );
}
