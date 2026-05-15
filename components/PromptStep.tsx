"use client";
import { Sparkles } from "lucide-react";
import type { ContentDensity } from "@/lib/types";

type Props = {
  prompt: string;
  setPrompt: (v: string) => void;
  slideCount: number;
  setSlideCount: (n: number) => void;
  audience: string;
  setAudience: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  density: ContentDensity;
  setDensity: (d: ContentDensity) => void;
  includeReferences: boolean;
  setIncludeReferences: (v: boolean) => void;
  onNext: () => void;
};

const EXAMPLES = [
  "A 10-minute pitch for a B2B SaaS that automates expense reports for SMBs.",
  "Investor update: Q1 traction, key wins, asks for Q2.",
  "Intro to transformer architecture for CS undergrads.",
  "Internal training on phishing for non-technical employees.",
];

const DENSITY_OPTIONS: { id: ContentDensity; label: string; hint: string }[] = [
  { id: "concise",       label: "Concise",       hint: "3 short bullets per slide" },
  { id: "balanced",      label: "Balanced",      hint: "4 medium bullets" },
  { id: "detailed",      label: "Detailed",      hint: "5 full sentences" },
  { id: "comprehensive", label: "Comprehensive", hint: "5-6 long, specific bullets" },
];

export default function PromptStep(p: Props) {
  return (
    <div className="fade-in mx-auto w-full max-w-3xl">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <Sparkles size={12} /> Step 1 of 3
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">What's your deck about?</h1>
        <p className="mt-2 text-white/60">
          Describe the topic, audience, or goal. The more specific, the better.
        </p>
      </div>

      <textarea
        value={p.prompt}
        onChange={(e) => p.setPrompt(e.target.value)}
        placeholder="e.g. A 10-slide investor update covering Q1 traction, churn, and our ask for the next round."
        className="min-h-[160px] w-full resize-y rounded-2xl border border-white/10 bg-white/5 p-4 text-base outline-none ring-0 focus:border-white/30"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => p.setPrompt(ex)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-white/50">
            Slides
          </label>
          <input
            type="number"
            min={3}
            max={20}
            value={p.slideCount}
            onChange={(e) => p.setSlideCount(Number(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-white/50">
            Audience
          </label>
          <input
            type="text"
            value={p.audience}
            onChange={(e) => p.setAudience(e.target.value)}
            placeholder="e.g. investors, students"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-white/50">
            Tone
          </label>
          <input
            type="text"
            value={p.tone}
            onChange={(e) => p.setTone(e.target.value)}
            placeholder="e.g. confident, friendly"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/30"
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
          Content density
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DENSITY_OPTIONS.map((opt) => {
            const active = p.density === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => p.setDensity(opt.id)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-[10px] text-white/50">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-6 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer hover:bg-white/10">
        <input
          type="checkbox"
          checked={p.includeReferences}
          onChange={(e) => p.setIncludeReferences(e.target.checked)}
          className="mt-1 h-4 w-4 cursor-pointer"
        />
        <div>
          <div className="text-sm font-medium">Add a references slide</div>
          <div className="text-xs text-white/50">
            Inserts a sources/citations slide before the closing thank-you. Recommended for academic, technical, or research-heavy decks.
          </div>
        </div>
      </label>

      <div className="mt-8 flex justify-end">
        <button
          disabled={p.prompt.trim().length < 5}
          onClick={p.onNext}
          className="rounded-xl bg-white px-5 py-2.5 font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Choose theme →
        </button>
      </div>
    </div>
  );
}
