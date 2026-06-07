"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, LayoutGrid, Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 200), 420)}px`;
  }, [p.prompt, isContent]);

  // Cmd/Ctrl + Enter to continue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && p.prompt.trim().length >= 5) {
        e.preventDefault();
        if (p.activeTemplateName && p.onGenerateDirect) p.onGenerateDirect();
        else p.onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.prompt, p.onNext, p.activeTemplateName, p.onGenerateDirect, p]);

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

  const onContinue = () => {
    if (p.activeTemplateName) setConfirmOpen(true);
    else p.onNext();
  };

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
    <div className="fade-in mx-auto w-full max-w-6xl">
      {/* Page header */}
      <div className="mb-8 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-[34px]">
            {isContent ? "Turn your content into slides" : "Tell me about the deck"}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-white/55">
            {isContent
              ? "Upload a PDF, or paste your essay, report, or notes. AI keeps your words and organizes them into a presentation."
              : "A sentence or two is enough. Audience and tone help, but they're optional."}
          </p>
        </div>
        {p.onBack && (
          <button
            onClick={p.onBack}
            className="group inline-flex items-center gap-1.5 text-[12px] text-white/55 transition hover:text-white"
          >
            <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">←</span>
            Dashboard
          </button>
        )}
      </div>

      {/* Input mode toggle — describe a topic, or import existing content. */}
      <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
        <button
          onClick={() => p.setInputMode("prompt")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-medium transition ${
            !isContent ? "bg-white text-black" : "text-white/65 hover:text-white"
          }`}
        >
          <Sparkles size={12} /> Describe a topic
        </button>
        <button
          onClick={() => p.setInputMode("content")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-medium transition ${
            isContent ? "bg-white text-black" : "text-white/65 hover:text-white"
          }`}
        >
          <FileText size={12} /> Upload / paste content
        </button>
      </div>

      {/* Two-column workspace: brief on the left, side rail on the right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* ============ LEFT: the brief ============ */}
        <section className="rounded-2xl border border-white/20 bg-white/[0.02] p-5 lg:p-6">
          {isContent ? (
            <>
              {/* Drop zone — paste in the box, or drag a PDF/TXT/MD onto it. */}
              <div
                className="relative"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
              >
                <textarea
                  ref={taRef}
                  value={p.sourceText}
                  onChange={(e) => { p.setSourceText(e.target.value); if (uploadName) setUploadName(null); }}
                  placeholder={"Paste your essay, report, article, or notes here — or drag and drop a PDF / .txt / .md file onto this box.\n\nAI keeps your words and turns them into slides. It won't rewrite your content into something generic."}
                  rows={10}
                  className={`block w-full resize-none rounded-xl border bg-black/40 p-4 pb-12 text-[15px] leading-relaxed outline-none transition placeholder:text-white/30 focus:border-white/30 ${
                    dragOver ? "border-white/40" : "border-white/10"
                  }`}
                  style={{ minHeight: 300, maxHeight: 520 }}
                />

                {/* Drag-over overlay */}
                {dragOver && (
                  <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-white/40 bg-black/70 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2 text-white/85">
                      <Upload size={22} />
                      <span className="text-sm font-medium">Drop your file to read it</span>
                      <span className="text-[11px] text-white/45">PDF, .txt or .md · up to 1.5 MB</span>
                    </div>
                  </div>
                )}

                {/* Empty-state upload affordance, centered over the textarea */}
                {!p.sourceText && !dragOver && !extracting && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-14 flex flex-col items-center gap-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-white/80 transition hover:bg-white/12"
                    >
                      <Upload size={13} /> Click to upload a file
                    </button>
                    <span className="text-[10.5px] text-white/40">or drag &amp; drop a PDF here · or paste above</span>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between text-[11px] text-white/40">
                  <span className="line-clamp-1 pr-3">
                    {extracting
                      ? extracting
                      : sourceCount === 0
                      ? "Paste anything from a paragraph to a full document."
                      : sourceCount < 40
                      ? "A little more text and I can build a proper deck."
                      : "Looks good — I'll keep your content and structure it into slides."}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 tabular-nums">
                    {sourceCount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Upload row */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,application/pdf,.txt,.md,.markdown,.csv,.text,text/plain"
                  className="hidden"
                  onChange={(e) => { onFile(e.target.files?.[0] || null); e.currentTarget.value = ""; }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={!!extracting}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {extracting
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Upload size={12} />}
                  {extracting ? "Working…" : "Upload PDF, .txt or .md"}
                </button>
                {uploadName && !extracting && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                    <FileText size={11} /> {uploadName}
                  </span>
                )}
                {p.sourceText.trim().length > 0 && !extracting && (
                  <button
                    onClick={() => { p.setSourceText(""); setUploadName(null); setUploadError(null); }}
                    className="text-[11px] text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {extracting && (
                <p className="mt-2 text-[11px] text-white/55">
                  {extracting} <span className="text-white/35">· stays on your device</span>
                </p>
              )}
              {uploadError && (
                <p className="mt-2 text-[11px] text-red-300">{uploadError}</p>
              )}
              <p className="mt-2 text-[10.5px] leading-relaxed text-white/35">
                Drag &amp; drop or upload a PDF (up to 1.5 MB), .txt, or .md. Scanned PDFs are read with on-device OCR. Files never leave your browser.
              </p>

              {/* Optional intent line */}
              <div className="mt-6">
                <Field label="What's it for? (optional)">
                  <input
                    type="text"
                    value={p.prompt}
                    onChange={(e) => p.setPrompt(e.target.value)}
                    placeholder="e.g. a 10-minute class presentation, a board readout…"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <div className="relative" data-tour="brief">
                <textarea
                  ref={taRef}
                  value={p.prompt}
                  onChange={(e) => p.setPrompt(e.target.value)}
                  placeholder="e.g. A 10-slide investor update covering Q1 traction, churn, and our ask for the next round."
                  rows={6}
                  className="block w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 pb-12 text-base leading-relaxed outline-none placeholder:text-white/30 focus:border-white/30"
                  style={{ minHeight: 200, maxHeight: 420 }}
                />

                {/* Footer row inside the textarea — char count + hint */}
                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between text-[11px] text-white/40">
                  <span className="line-clamp-1 pr-3">{charHint}</span>
                  <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 tabular-nums">
                    {charCount}
                  </span>
                </div>
              </div>

              {/* Quick starters */}
              <div className="mt-5">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-white/45">
                  Quick starters
                </div>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      onClick={() => p.setPrompt(ex.prompt)}
                      title={ex.prompt}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 transition hover:border-white/30 hover:bg-white/10"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Audience + tone — sit inline within the same card so the
              brief and its modifiers feel like one block. */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Audience">
              <input
                type="text"
                value={p.audience}
                onChange={(e) => p.setAudience(e.target.value)}
                placeholder="investors, students, sales team…"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </Field>
            <Field label="Tone">
              <input
                type="text"
                value={p.tone}
                onChange={(e) => p.setTone(e.target.value)}
                placeholder="confident, casual, technical…"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </Field>
          </div>
        </section>

        {/* ============ RIGHT: side rail ============ */}
        <aside className="space-y-4">
          {/* Shape */}
          <div className="rounded-2xl border border-white/20 bg-white/[0.02] p-4">
            <Field label="Slides">
              <SlideCounter value={p.slideCount} onChange={p.setSlideCount} />
            </Field>

            <div className="mt-4">
              <Field label="Density">
                <div className="grid grid-cols-2 gap-2">
                  {DENSITY_OPTIONS.map((opt) => {
                    const active = p.density === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => p.setDensity(opt.id)}
                        className={`rounded-lg border px-2.5 py-2 text-left transition ${
                          active
                            ? "border-white/60 bg-white/10 text-white"
                            : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <div className="text-[12px] font-medium">{opt.label}</div>
                        <div className="mt-0.5 text-[10px] text-white/50">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left cursor-pointer hover:bg-white/[0.06]">
              <input
                type="checkbox"
                checked={p.includeReferences}
                onChange={(e) => p.setIncludeReferences(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-cyan-400"
              />
              <div className="flex-1">
                <div className="text-[12px] font-medium text-white">Add a references slide</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-white/50">
                  Citations slide before the closing thank-you.
                </div>
              </div>
            </label>
          </div>

          {/* Continue card */}
          <div className="rounded-2xl border border-white/20 bg-white/[0.02] p-4">
            {/* Use a template — sits above the Choose theme button, with an
                "or" divider so the two paths read as alternatives. */}
            {p.onUseTemplate && (
              <>
                <button
                  onClick={p.onUseTemplate}
                  data-tour="templates"
                  className="group flex w-full items-start gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/[0.02] to-transparent p-3.5 text-left transition hover:border-cyan-300/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                    <LayoutGrid size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm font-medium text-white">
                      <span className="flex items-center gap-1.5">
                        Use a template
                        {p.activeTemplateName && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] text-emerald-200">
                            <Check size={9} />
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-white/55">
                        {p.activeTemplateName ? "Change" : "Browse"}
                      </span>
                    </div>
                    {p.activeTemplateName ? (
                      <p className="mt-1 truncate text-[11px] text-emerald-200/80">
                        {p.activeTemplateName} applied
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                        A designed style — theme, font, graphic in one pick.
                      </p>
                    )}
                  </div>
                </button>

                {/* or divider */}
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">or</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              </>
            )}

            {p.activeTemplateName && p.onGenerateDirect && (
              <button
                disabled={!ready || p.generateLoading}
                onClick={p.onGenerateDirect}
                className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-4 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50"
                title="Use the picked template's theme, font, and graphic — skip the next steps."
              >
                <Wand2 size={14} />
                {p.generateLoading ? "Generating…" : "Generate with template"}
              </button>
            )}
            <button
              disabled={!ready}
              onClick={onContinue}
              data-tour="continue"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {p.activeTemplateName ? "Customize theme" : "Choose theme"}
              <span aria-hidden>→</span>
            </button>
            <p className="mt-2 text-center text-[10px] text-white/40">
              {ready ? "Press ⌘ + Enter to continue" : "Type at least a few words to continue"}
            </p>
          </div>
        </aside>
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

function Field({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/45">
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
    <div className="flex items-center rounded-xl border border-white/10 bg-black/40">
      <button
        onClick={() => onChange(clamp(value - 1))}
        className="grid h-10 w-10 place-items-center rounded-l-xl text-white/60 hover:bg-white/10"
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
        className="h-10 w-full bg-transparent px-1 text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        onClick={() => onChange(clamp(value + 1))}
        className="grid h-10 w-10 place-items-center rounded-r-xl text-white/60 hover:bg-white/10"
        title="More slides"
        aria-label="Increase slide count"
      >
        +
      </button>
    </div>
  );
}
