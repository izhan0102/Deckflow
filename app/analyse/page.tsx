import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Brain, Layers, ShieldCheck, FileText } from "lucide-react";
import Logo from "@/components/Logo";
import DocumentAnalyser from "@/components/DocumentAnalyser";
import { SITE_URL, landingSoftwareJsonLd, howToJsonLd, faqListJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const PATH = "/analyse";
const TITLE = "AI Document Analyser — Analyse Word, Excel, PPT, PDF, Code & More";
const DESCRIPTION =
  "Free AI document analyser. Upload one or many files — Word, Excel, PowerPoint, PDF, txt, JSON, code, images — pick how deep to go, and get a sharp analysis per document plus a cross-document synthesis that finds connections and contradictions. Private, in your browser.";

const KEYWORDS = [
  "ai document analyser", "ai document analyzer", "analyse document with ai", "pdf analyzer ai",
  "excel analyzer", "word document analyzer", "ai file analyzer", "compare documents ai",
  "ai code analyzer", "summarize document ai", "multi document analysis", "document insights ai",
];

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}${PATH}`, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const STEPS = [
  { name: "Upload anything", text: "Drop one or more files — Word, Excel, PowerPoint, PDF, text, CSV, JSON, source code, or images. They're read privately on your device." },
  { name: "Choose the depth", text: "Pick the analysis strength — Overview, Moderate, or Deep — and a focus like key insights, risks, action items, data, or code review." },
  { name: "Get the analysis", text: "EXdeck returns a clear analysis per document, plus a cross-document synthesis that surfaces overlaps, connections, and contradictions." },
];
const FAQ = [
  { q: "What file types can it analyse?", a: "Word (.docx), Excel (.xlsx), PowerPoint (.pptx), PDF, plain text, Markdown, CSV, JSON, source code in any language, and images (via OCR). Anything readable." },
  { q: "Can it analyse multiple documents at once?", a: "Yes — upload up to 8 files. You get a separate analysis for each (Doc 1, Doc 2, …) plus a cross-document synthesis that connects them and flags contradictions." },
  { q: "What does 'analysis strength' mean?", a: "It controls how deep the AI goes: Overview is a quick gist, Moderate is balanced, and Deep is a thorough multi-section breakdown." },
  { q: "Is it private and free?", a: "Files are parsed entirely in your browser and never uploaded as files. The AI analysis runs on a free plan within your monthly credits; Pro gives far more." },
];

export default function AnalysePage() {
  const jsonLd = [
    landingSoftwareJsonLd("EXdeck AI Document Analyser", DESCRIPTION, PATH),
    howToJsonLd({ name: "How to analyse documents with AI", description: DESCRIPTION, steps: STEPS }),
    faqListJsonLd(FAQ),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Document Analyser", path: PATH }]),
  ];

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {jsonLd.map((obj, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />)}

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/app" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}>Make an AI deck <ArrowRight size={13} /></Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 pt-12 text-center sm:pt-14">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}><Brain size={12} /> AI Document Analyser</div>
        <h1 className="mx-auto mt-3 max-w-2xl text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[42px]" style={{ color: "var(--ezd-fg-strong)" }}>Understand any document in seconds</h1>
        <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Upload anything — reports, spreadsheets, slides, PDFs, code — and get a clear analysis at the depth you choose. Analyse several at once and see how they connect.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-5 pt-8">
        <div className="rounded-3xl border p-4 sm:p-6" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
          <DocumentAnalyser />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {[{ icon: Layers, t: "Cross-document synthesis", b: "Analyse many files at once and see overlaps, connections, and contradictions between them — not just isolated summaries." },
            { icon: FileText, t: "Any format", b: "Word, Excel, PowerPoint, PDF, text, CSV, JSON, code, and images (OCR) — all read on your device." },
            { icon: ShieldCheck, t: "Private by design", b: "Files are parsed in your browser; only the extracted text is analysed. Nothing is stored." }].map((f) => (
            <div key={f.t} className="flex items-start gap-3 rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}><f.icon size={19} /></span>
              <span><span className="block text-[14.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{f.t}</span><span className="mt-1 block text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{f.b}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Frequently asked questions</h2>
        <div className="mt-6 divide-y" style={{ borderColor: "var(--ezd-divider)" }}>
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{f.q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
