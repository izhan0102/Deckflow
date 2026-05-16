"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, FileText, SlidersHorizontal, LayoutGrid, Check } from "lucide-react";
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
  /** Optional: open the deck-style template gallery. */
  onUseTemplate?: () => void;
  /** When set, shows a small "Using ___" indicator next to the templates button. */
  activeTemplateName?: string;
  /** Optional: when a template is applied this lets users jump straight to generation. */
  onGenerateDirect?: () => void;
  /** Whether the deck is currently being generated (for the direct button). */
  generateLoading?: boolean;
};

const EXAMPLES = [
  { label: "Investor update",    prompt: "Investor update for Q1 covering traction, churn, hiring, and our ask for the next round." },
  { label: "Course lecture",     prompt: "Intro to transformer architecture for CS undergrads. Cover attention, self-attention, encoder-decoder structure, and one diagram of a single attention head." },
  { label: "Pitch deck",         prompt: "10-slide pitch for a B2B SaaS that automates expense reports for small teams. Problem, solution, traction, market, ask." },
  { label: "Internal training",  prompt: "Phishing awareness training for non-technical employees. Real examples, what to do, how to report." },
  { label: "Project proposal",   prompt: "Project proposal for a customer-onboarding redesign. Problem, hypothesis, plan, success metrics, timeline." },
  { label: "Report",             prompt: "Quarterly report on user engagement. Active users, retention cohorts, top features, what we're shipping next." },
];

const DENSITY_OPTIONS: { id: ContentDensity; label: string; hint: string }[] = [
  { id: "concise",       label: "Concise",       hint: "3 short bullets" },
  { id: "balanced",      label: "Balanced",      hint: "4 medium bullets" },
  { id: "detailed",      label: "Detailed",      hint: "5 full sentences" },
  { id: "comprehensive", label: "Comprehensive", hint: "5-6 long bullets" },
];

export default function PromptStep(p: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Autofocus on mount so the first thing you do is type.
  useEffect(() => {
    taRef.current?.focus();
  }, []);

  // Cmd/Ctrl + Enter to continue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && p.prompt.trim().length >= 5) {
        e.preventDefault();
        // If a template is active, use the template fast path; otherwise
        // walk the regular wizard.
        if (p.activeTemplateName && p.onGenerateDirect) p.onGenerateDirect();
        else p.onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.prompt, p.onNext, p.activeTemplateName, p.onGenerateDirect, p]);

  const charCount = p.prompt.length;
  const ready = p.prompt.trim().length >= 5;

  const charHint = useMemo(() => {
    if (charCount === 0) return "Aim for 1-3 sentences. Specific is better than long.";
    if (charCount < 40)  return "A bit more detail helps the deck land closer to what you want.";
    if (charCount < 200) return "Looks good.";
    if (charCount < 500) return "Plenty to work with.";
    return "Long brief. The model will pick the most useful pieces.";
  }, [charCount]);

  return (
    <div className="fade-in mx-auto w-full max-w-3xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <Sparkles size={12} /> Step 1 of 5
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Tell me about the deck</h1>
        <p className="mt-2 text-white/60">
          A sentence or two about the topic. Audience and tone are optional but improve the result.
        </p>
      </div>

      {/* Templates entry */}
      {p.onUseTemplate && (
        <button
          onClick={p.onUseTemplate}
          className="mb-5 flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 to-white/[0.02] p-4 text-left transition hover:border-white/30 hover:from-white/10"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5">
            <LayoutGrid size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              Use a template
              {p.activeTemplateName && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200">
                  <Check size={10} /> {p.activeTemplateName}
                </span>
              )}
            </div>
            <p className="text-xs text-white/55">
              Skip theme, font, graphic — pick a designed style and just edit the brief.
            </p>
          </div>
          <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[11px] text-white/70">
            Browse →
          </span>
        </button>
      )}

      {/* Section: The brief */}
      <Section icon={<FileText size={12} />} title="The brief">
        <div className="relative">
          <textarea
            ref={taRef}
            value={p.prompt}
            onChange={(e) => p.setPrompt(e.target.value)}
            placeholder="e.g. A 10-slide investor update covering Q1 traction, churn, and our ask for the next round."
            className="min-h-[160px] w-full resize-y rounded-2xl border border-white/10 bg-white/5 p-4 pr-24 text-base outline-none ring-0 focus:border-white/30"
          />
          <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] tabular-nums text-white/50">
            {charCount} chars
          </div>
        </div>
        <p className="mt-2 text-xs text-white/45">{charHint}</p>

        {/* Example chips — append the prompt, never overwrite. */}
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">
            Quick starters
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => p.setPrompt(ex.prompt)}
                title={ex.prompt}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 transition hover:bg-white/10"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Audience">
            <input
              type="text"
              value={p.audience}
              onChange={(e) => p.setAudience(e.target.value)}
              placeholder="investors, students, sales team…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </Field>
          <Field label="Tone">
            <input
              type="text"
              value={p.tone}
              onChange={(e) => p.setTone(e.target.value)}
              placeholder="confident, casual, technical…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </Field>
        </div>
      </Section>

      {/* Section: The shape */}
      <Section icon={<SlidersHorizontal size={12} />} title="The shape">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
          <Field label="Slides">
            <SlideCounter value={p.slideCount} onChange={p.setSlideCount} />
          </Field>

          <Field label="Density">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DENSITY_OPTIONS.map((opt) => {
                const active = p.density === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => p.setDensity(opt.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-white/60 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-xs font-medium">{opt.label}</div>
                    <div className="mt-0.5 text-[10px] text-white/50">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <label className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 cursor-pointer hover:bg-white/10">
          <input
            type="checkbox"
            checked={p.includeReferences}
            onChange={(e) => p.setIncludeReferences(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-violet-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium">Add a references slide</div>
            <div className="text-xs text-white/50">
              A citations slide right before the closing thank-you. Useful for research and academic decks.
            </div>
          </div>
        </label>
      </Section>

      {/* Continue */}
      <div className="mt-10 flex flex-wrap items-center justify-end gap-3">
        <span className="hidden text-[11px] text-white/35 sm:block">
          {ready ? "Press ⌘ + Enter to continue" : "Type at least a few words"}
        </span>
        {p.activeTemplateName && p.onGenerateDirect && (
          <button
            disabled={!ready || p.generateLoading}
            onClick={p.onGenerateDirect}
            className="rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-5 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-40"
            title="Use the picked template's theme, font, and graphic — skip the next steps."
          >
            {p.generateLoading ? "Generating…" : "Generate with template →"}
          </button>
        )}
        <button
          disabled={!ready}
          onClick={() => {
            if (p.activeTemplateName) setConfirmOpen(true);
            else p.onNext();
          }}
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {p.activeTemplateName ? "Customize theme →" : "Choose theme →"}
        </button>
      </div>

      {/* Confirm dialog: warn user that customizing theme overrides the
          template they already picked. */}
      {confirmOpen && p.activeTemplateName && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="m-4 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] text-amber-200">
              <LayoutGrid size={11} /> Template active
            </div>
            <h3 className="text-lg font-semibold text-white">
              You've already chosen a template
            </h3>
            <p className="mt-2 text-sm text-white/65">
              <span className="font-medium text-white/85">{p.activeTemplateName}</span> is selected.
              Customizing the theme, font, and graphic will let you tweak everything
              the template set up. Or you can generate right now using the template as-is.
            </p>
            <div className="mt-5 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => { setConfirmOpen(false); p.onNext(); }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
              >
                Yes, customize theme
              </button>
              <button
                onClick={() => { setConfirmOpen(false); p.onGenerateDirect?.(); }}
                disabled={p.generateLoading}
                className="rounded-xl bg-emerald-400/90 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {p.generateLoading ? "Generating…" : "Generate with template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ subcomponents ----------------------------- */

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-white/55">
        {icon} <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function Field({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/50">
        {label}
      </label>
      {children}
    </div>
  );
}

function SlideCounter({
  value, onChange,
}: { value: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(3, Math.min(20, Math.round(n)));
  return (
    <div className="flex items-center rounded-xl border border-white/10 bg-white/5">
      <button
        onClick={() => onChange(clamp(value - 1))}
        className="grid h-9 w-9 place-items-center rounded-l-xl text-white/60 hover:bg-white/10"
        title="Fewer slides"
        aria-label="Decrease slide count"
      >
        −
      </button>
      <input
        type="number"
        min={3}
        max={20}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value || 0)))}
        className="h-9 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        onClick={() => onChange(clamp(value + 1))}
        className="grid h-9 w-9 place-items-center rounded-r-xl text-white/60 hover:bg-white/10"
        title="More slides"
        aria-label="Increase slide count"
      >
        +
      </button>
    </div>
  );
}
