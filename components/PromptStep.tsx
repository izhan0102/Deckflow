"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  LayoutGrid,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import type { ContentDensity } from "@/lib/types";

type Props = {
  prompt: string;
  setPrompt: (v: string) => void;
  inputMode: "prompt" | "content";
  setInputMode: (m: "prompt" | "content") => void;
  sourceText: string;
  setSourceText: (v: string) => void;
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
  /** Back to dashboard — shown as a plain text link in the header. */
  onBack?: () => void;
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
  { label: "Investor update",   prompt: "Investor update for Q1 covering traction, churn, hiring, and our ask for the next round." },
  { label: "Course lecture",    prompt: "Intro to transformer architecture for CS undergrads. Cover attention, self-attention, encoder-decoder structure, and one diagram of a single attention head." },
  { label: "Pitch deck",        prompt: "10-slide pitch for a B2B SaaS that automates expense reports for small teams. Problem, solution, traction, market, ask." },
  { label: "Internal training", prompt: "Phishing awareness training for non-technical employees. Real examples, what to do, how to report." },
  { label: "Project proposal",  prompt: "Project proposal for a customer-onboarding redesign. Problem, hypothesis, plan, success metrics, timeline." },
  { label: "Report",            prompt: "Quarterly report on user engagement. Active users, retention cohorts, top features, what we're shipping next." },
];

const DENSITY_OPTIONS: { id: ContentDensity; label: string; hint: string }[] = [
  { id: "concise",       label: "Concise",       hint: "3 short bullets" },
  { id: "balanced",      label: "Balanced",      hint: "4 medium bullets" },
  { id: "detailed",      label: "Detailed",      hint: "5 sentences" },
  { id: "comprehensive", label: "Comprehensive", hint: "5-6 long bullets" },
];

export default function PromptStep(p: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // PDF extraction progress (client-side text layer + OCR). Null when idle.
  const [extracting, setExtracting] = useState<string | null>(null);
  // Drag-and-drop highlight state for the content drop zone.
  const [dragOver, setDragOver] = useState(false);

  const isContent = p.inputMode === "content";

  // Autofocus on mount so the first thing you do is type — but NOT on
  // touch devices, where focusing a textarea pops the on-screen keyboard
  // (annoying, and it fired even when opening the template gallery on top).
  useEffect(() => {
    const coarse = typeof window !== "undefined"
      && window.matchMedia?.("(pointer: coarse)").matches;
    if (coarse) return;
    taRef.current?.focus();
  }, []);

  // Auto-grow the textarea as content changes (prompt mode only — the
  // content textarea has its own fixed min/max height).
  useEffect(() => {
    if (isContent) return;
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 168), 360)}px`;
  }, [p.prompt, isContent]);

  // Cmd/Ctrl + Enter: generate when a template is chosen, otherwise jump
  // straight to picking one (a template is required before generating).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (p.activeTemplateName) p.onGenerateDirect?.();
        else p.onUseTemplate?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.activeTemplateName, p.onGenerateDirect, p.onUseTemplate]);

  const charCount = p.prompt.length;
  const sourceCount = p.sourceText.length;
  const ready = isContent
    ? p.sourceText.trim().length >= 40
    : p.prompt.trim().length >= 5;

  const charHint = useMemo(() => {
    if (charCount === 0) return "Aim for 1-3 sentences. Specific is better than long.";
    if (charCount < 40)  return "A bit more detail helps the deck land closer to what you want.";
    if (charCount < 200) return "Looks good.";
    if (charCount < 500) return "Plenty to work with — every detail will be used.";
    return "Long brief — every section will be honored. Use as much detail as you want.";
  }, [charCount]);

  // Read a dropped/selected file into the source box. Plain text (.txt/.md)
  // is read directly; PDFs are extracted client-side (text layer + OCR) so
  // the file never leaves the browser.
  const onFile = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);

    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const isText = /\.(txt|md|markdown|csv|text)$/i.test(file.name) || /^text\//.test(file.type || "");

    if (isPdf) {
      if (file.size > 1_500_000) {
        setUploadError("That PDF is over 1.5 MB. Try a smaller file, or copy the text and paste it.");
        return;
      }
      setExtracting("Reading PDF…");
      try {
        const { extractPdfText } = await import("@/lib/pdfText");
        const text = await extractPdfText(file, (pr) => {
          if (pr.phase === "reading") setExtracting(`Reading PDF… page ${pr.page} of ${pr.total}`);
          else if (pr.phase === "ocr") setExtracting(`Scanning images (OCR)… page ${pr.page} of ${pr.total}`);
        });
        if (!text || text.trim().length < 40) {
          setUploadError("Couldn't pull enough text from that PDF. If it's a scan, the quality may be too low — try pasting the text instead.");
          setExtracting(null);
          return;
        }
        p.setSourceText(text);
        setUploadName(file.name);
      } catch (e) {
        setUploadError("Couldn't read that PDF. Try pasting the text instead.");
      } finally {
        setExtracting(null);
      }
      return;
    }

    if (!isText) {
      setUploadError("Supported files: .pdf, .txt, .md. For a Word doc, copy the text and paste it.");
      return;
    }
    if (file.size > 1_000_000) {
      setUploadError("That file is large — paste just the part you want in the deck.");
      return;
    }
    try {
      const text = await file.text();
      p.setSourceText(text);
      setUploadName(file.name);
    } catch {
      setUploadError("Couldn't read that file. Try pasting the text instead.");
    }
  };

  // Drag-and-drop onto the content area. Only active in content mode.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (extracting) return;
    const file = e.dataTransfer?.files?.[0] || null;
    if (file) onFile(file);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!extracting) setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    // Ignore leaves that bubble up from children.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  };

  return (
    <div className="fade-in mx-auto w-full max-w-3xl">
      {/* ── Top bar: subtle label + back to dashboard ──────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-white/40">
          <Sparkles size={12} className="text-white/40" />
          Create a deck
        </div>
        {p.onBack && (
          <button
            onClick={p.onBack}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">←</span>
            Dashboard
          </button>
        )}
      </div>

      {/* ── Hero (centered) ─────────────────────────────────────────── */}
      <div className="mb-7 text-center">
        <h1 className="text-[30px] font-semibold leading-[1.06] tracking-tight text-white md:text-[40px]">
          {isContent ? (
            <>
              Turn your content{" "}
              <span className="bg-gradient-to-r from-cyan-200 via-cyan-100 to-white bg-clip-text text-transparent">
                into slides
              </span>
            </>
          ) : (
            <>
              What&rsquo;s your deck{" "}
              <span className="bg-gradient-to-r from-cyan-200 via-cyan-100 to-white bg-clip-text text-transparent">
                about?
              </span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[14.5px] leading-relaxed text-white/55">
          {isContent
            ? "Upload a PDF or paste your essay, report, or notes. The AI keeps your words and builds them into a clean presentation."
            : "Describe it in a sentence or two. Tune the details below — the AI handles the rest."}
        </p>
      </div>

      {/* ── Input-mode segmented control (centered) ─────────────────── */}
      <div className="mb-4 flex justify-center">
        <div className="inline-flex rounded-2xl border border-white/10 bg-black/30 p-1 backdrop-blur">
          <ModeTab active={!isContent} onClick={() => p.setInputMode("prompt")} icon={<Sparkles size={13} />}>
            Describe a topic
          </ModeTab>
          <ModeTab active={isContent} onClick={() => p.setInputMode("content")} icon={<FileText size={13} />}>
            Upload / paste
          </ModeTab>
        </div>
      </div>

      {/* ── The composer — the hero input ───────────────────────────── */}
      {isContent ? (
        <>
          <div
            className={`relative rounded-3xl border bg-black/40 p-4 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.6)] transition focus-within:border-white/30 sm:p-5 ${
              dragOver ? "border-cyan-300/50" : "border-white/12"
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <textarea
              ref={taRef}
              value={p.sourceText}
              onChange={(e) => { p.setSourceText(e.target.value); if (uploadName) setUploadName(null); }}
              placeholder={"Paste your essay, report, article, or notes here — or drag and drop a PDF / .txt / .md file onto this box.\n\nAI keeps your words and turns them into slides. It won't rewrite your content into something generic."}
              rows={9}
              className="block w-full resize-none bg-transparent p-1 pb-14 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/30"
              style={{ minHeight: 280, maxHeight: 520 }}
            />

            {/* Drag-over overlay */}
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-3xl border-2 border-dashed border-cyan-300/50 bg-black/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-white/90">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                    <Upload size={20} />
                  </span>
                  <span className="text-sm font-medium">Drop your file to read it</span>
                  <span className="text-[11px] text-white/45">PDF, .txt or .md · up to 1.5 MB</span>
                </div>
              </div>
            )}

            {/* Empty-state upload affordance, centered over the textarea */}
            {!p.sourceText && !dragOver && !extracting && (
              <div className="pointer-events-none absolute inset-x-0 bottom-16 flex flex-col items-center gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-white/80 transition hover:border-cyan-300/40 hover:bg-white/12"
                >
                  <Upload size={13} /> Click to upload a file
                </button>
                <span className="text-[10.5px] text-white/40">or drag &amp; drop a PDF here · or paste above</span>
              </div>
            )}

            {/* Bottom bar inside the composer: upload control + count */}
            <div className="absolute inset-x-4 bottom-3 flex items-center justify-between gap-3 sm:inset-x-5">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf,.txt,.md,.markdown,.csv,.text,text/plain"
                className="hidden"
                onChange={(e) => { onFile(e.target.files?.[0] || null); e.currentTarget.value = ""; }}
              />
              <div className="flex min-w-0 items-center gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={!!extracting}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11.5px] text-white/80 transition hover:border-cyan-300/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {extracting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {extracting ? "Working…" : "Upload file"}
                </button>
                {uploadName && !extracting && (
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                    <FileText size={11} className="shrink-0" /> <span className="truncate">{uploadName}</span>
                  </span>
                )}
                {p.sourceText.trim().length > 0 && !extracting && (
                  <button
                    onClick={() => { p.setSourceText(""); setUploadName(null); setUploadError(null); }}
                    className="shrink-0 text-[11px] text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-white/45">
                {sourceCount.toLocaleString()}
              </span>
            </div>
          </div>

          {extracting && (
            <p className="mt-2 text-center text-[11px] text-white/55">
              {extracting} <span className="text-white/35">· stays on your device</span>
            </p>
          )}
          {uploadError && (
            <p className="mt-2 text-center text-[11px] text-red-300">{uploadError}</p>
          )}
          {!extracting && !uploadError && (
            <p className="mt-2 text-center text-[10.5px] leading-relaxed text-white/35">
              PDF (up to 1.5 MB), .txt, or .md. Scanned PDFs use on-device OCR — files never leave your browser.
            </p>
          )}

          {/* Optional intent line */}
          <div className="mt-4">
            <InlineInput
              label="For"
              value={p.prompt}
              onChange={p.setPrompt}
              placeholder="What's it for? e.g. a 10-minute class talk, a board readout… (optional)"
            />
          </div>
        </>
      ) : (
        <>
          <div
            className="relative rounded-3xl border border-white/12 bg-black/40 p-4 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.6)] transition focus-within:border-white/30 sm:p-5"
            data-tour="brief"
          >
            <textarea
              ref={taRef}
              value={p.prompt}
              onChange={(e) => p.setPrompt(e.target.value)}
              placeholder="e.g. A 10-slide investor update covering Q1 traction, churn, and our ask for the next round."
              rows={5}
              className="block w-full resize-none bg-transparent p-1 pb-10 text-[16px] leading-relaxed text-white outline-none placeholder:text-white/30"
              style={{ minHeight: 168, maxHeight: 360 }}
            />
            <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center justify-between text-[11px] text-white/40 sm:inset-x-5">
              <span className="line-clamp-1 pr-3">{charHint}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 tabular-nums">{charCount}</span>
            </div>
          </div>

          {/* Quick starters — suggestion chips under the composer */}
          <div className="mt-5">
            <p className="mb-2.5 text-center text-[11px] font-medium text-white/35">
              Not sure where to start? Pick an example
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => p.setPrompt(ex.prompt)}
                  title={ex.prompt}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-white/70 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Options panel: audience · tone · slides · density · refs ── */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.02]">
        {/* Audience + tone */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <PanelField
            label="Audience"
            value={p.audience}
            onChange={p.setAudience}
            placeholder="investors, students, sales team…"
          />
          <PanelField
            label="Tone"
            value={p.tone}
            onChange={p.setTone}
            placeholder="confident, casual, technical…"
            className="border-t border-white/10 sm:border-l sm:border-t-0"
          />
        </div>

        {/* Slides · density · references */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 px-4 py-3.5">
          {/* Slides */}
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Slides</span>
            <SlideCounter value={p.slideCount} onChange={p.setSlideCount} />
          </div>

          {/* Density */}
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Density</span>
            <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
              {DENSITY_OPTIONS.map((opt) => {
                const active = p.density === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => p.setDensity(opt.id)}
                    title={opt.hint}
                    className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition ${
                      active ? "bg-white text-black" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* References */}
          <button
            onClick={() => p.setIncludeReferences(!p.includeReferences)}
            className={`ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11.5px] font-medium transition ${
              p.includeReferences
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 bg-black/30 text-white/55 hover:text-white"
            }`}
            title="Add a citations slide before the closing thank-you"
          >
            <span
              className={`grid h-4 w-4 place-items-center rounded-[5px] border transition ${
                p.includeReferences ? "border-white/40 bg-white/20" : "border-white/25"
              }`}
            >
              {p.includeReferences && <Check size={11} />}
            </span>
            References slide
          </button>
        </div>
      </div>

      {/* ── Actions: pick a template, then generate ─────────────────── */}
      <div className="mt-6">
        {p.activeTemplateName ? (
          <>
            {/* Chosen template summary — tap to change */}
            <button
              onClick={p.onUseTemplate}
              data-tour="templates"
              className="group mb-2.5 flex w-full items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.02] px-4 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.05]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80">
                  <LayoutGrid size={14} />
                </span>
                <span className="min-w-0 truncate text-[13px] font-medium text-white">
                  Template:{" "}
                  <span className="inline-flex items-center gap-1 text-white/70">
                    {p.activeTemplateName}
                    <Check size={11} className="text-white/70" />
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-white/50 transition group-hover:text-white/80">Change</span>
            </button>

            {/* Primary: generate with the chosen template */}
            <button
              disabled={!ready || p.generateLoading}
              onClick={p.onGenerateDirect}
              data-tour="continue"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-[15px] font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wand2 size={16} />
              {p.generateLoading ? "Generating…" : "Generate presentation"}
            </button>

            <p className="mt-3 text-center text-[10.5px] text-white/40">
              {ready ? (
                <span className="inline-flex items-center gap-1">
                  Press
                  <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] text-white/60">⌘</kbd>
                  <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] text-white/60">Enter</kbd>
                  to generate
                </span>
              ) : (
                isContent ? "Add a paragraph or more, then generate" : "Add a few words about your deck, then generate"
              )}
            </p>
          </>
        ) : (
          <>
            {/* No template yet — choosing one is the required next step */}
            <button
              onClick={p.onUseTemplate}
              data-tour="templates"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-[15px] font-semibold text-black transition hover:bg-white/90"
            >
              <LayoutGrid size={16} />
              Choose a template
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <p className="mt-3 text-center text-[10.5px] text-white/40">
              Pick a template — it sets the look. You&rsquo;ll generate right after.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ subcomponents ----------------------------- */

function ModeTab({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-medium transition ${
        active ? "bg-white text-black" : "text-white/60 hover:text-white"
      }`}
    >
      {icon} {children}
    </button>
  );
}

/** A label-prefixed single-line input — used for the optional "what's it
 *  for" line in content mode. */
function InlineInput({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-black/40 px-3.5 py-2.5 transition focus-within:border-white/30">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
      />
    </label>
  );
}

/** A panel cell with a label above a borderless input — used inside the
 *  unified options panel for Audience and Tone. */
function PanelField({
  label, value, onChange, placeholder, className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`block px-4 py-3 transition focus-within:bg-white/[0.02] ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
      />
    </label>
  );
}

function SlideCounter({
  value, onChange,
}: { value: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(3, Math.min(20, Math.round(n)));
  return (
    <div className="inline-flex items-center rounded-lg border border-white/10 bg-black/30">
      <button
        onClick={() => onChange(clamp(value - 1))}
        className="grid h-8 w-8 place-items-center rounded-l-lg text-base text-white/60 transition hover:bg-white/10 hover:text-white"
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
        className="h-8 w-9 bg-transparent px-0 text-center text-[13px] font-semibold tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        onClick={() => onChange(clamp(value + 1))}
        className="grid h-8 w-8 place-items-center rounded-r-lg text-base text-white/60 transition hover:bg-white/10 hover:text-white"
        title="More slides"
        aria-label="Increase slide count"
      >
        +
      </button>
    </div>
  );
}
