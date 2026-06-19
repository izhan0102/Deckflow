import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, UploadCloud, Play, MonitorPlay, ShieldCheck, Keyboard, Zap } from "lucide-react";
import Logo from "@/components/Logo";
import PdfPresenter from "@/components/PdfPresenter";
import { SITE_URL, landingSoftwareJsonLd, howToJsonLd, faqListJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const PATH = "/pdf-to-ppt";
const TITLE = "PDF to PPT Presenter — Present a PDF as Full-Screen Slides (Free)";
const DESCRIPTION =
  "Free PDF to PPT presenter. Upload a PDF and present it full-screen like a PowerPoint — no .pptx file needed. Perfect when you only saved the PDF. Runs in your browser; your file never leaves your device.";

const KEYWORDS = [
  "pdf to ppt", "pdf to ppt presenter", "pdf to powerpoint", "present pdf as slides",
  "pdf slideshow", "present pdf fullscreen", "pdf presenter", "convert pdf to presentation",
  "pdf to ppt converter", "present a pdf", "pdf full screen presentation", "play pdf as slideshow",
  "pdf presentation mode", "present pdf without powerpoint", "pdf to slides",
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
  { name: "Upload your PDF", text: "Drag in any PDF — a slide export, a report, a document. It's read locally in your browser and never uploaded." },
  { name: "Each page becomes a slide", text: "Every PDF page is rendered as a crisp, full-screen slide, in order, ready to present." },
  { name: "Present full-screen", text: "Hit Start presenting for a PowerPoint-style full-screen show with arrow-key navigation and a slide counter." },
];

const FEATURES = [
  { icon: MonitorPlay, title: "True full-screen show", body: "A real presentation view on a black stage — exactly like running a .pptx in PowerPoint or Keynote." },
  { icon: Keyboard, title: "Presenter controls", body: "Arrow keys, Space, Page Up/Down, Home/End, click-to-advance, and F for fullscreen. Esc to exit." },
  { icon: ShieldCheck, title: "100% private", body: "Your PDF is rendered entirely on your device. Nothing is uploaded to a server — no account required." },
  { icon: Zap, title: "Instant, no install", body: "No PowerPoint, no plugins, no conversion wait. Open the page, drop a PDF, present." },
];

const FAQ = [
  { q: "How do I present a PDF as a PowerPoint?", a: "Upload your PDF here and click Start presenting. Each page is shown as a full-screen slide with arrow-key navigation — the same experience as presenting a .pptx in PowerPoint, without needing the original PowerPoint file." },
  { q: "I only have the PDF, not the PPTX. Can I still present it?", a: "Yes — that's exactly what this tool is for. If you saved or were sent only the PDF version of a deck, drop it here and present it full-screen. You don't need the original .pptx." },
  { q: "Is the PDF to PPT presenter free?", a: "Yes, it's completely free and needs no sign-up. Upload a PDF and present it right away." },
  { q: "Is my file uploaded anywhere?", a: "No. The PDF is read and rendered entirely in your browser using on-device rendering. The file never leaves your computer, so it's safe for confidential decks." },
  { q: "What keyboard shortcuts work while presenting?", a: "Right arrow / Space / Page Down move forward, Left arrow / Page Up move back, Home and End jump to the first and last slide, F toggles fullscreen, and Esc exits the presentation." },
  { q: "Does it work on any PDF?", a: "Any standard PDF works — slide exports, reports, scanned documents. Each page is rendered as a slide in its original order and aspect ratio." },
];

export default function PdfToPptPage() {
  const jsonLd = [
    landingSoftwareJsonLd("EXdeck PDF to PPT Presenter", DESCRIPTION, PATH),
    howToJsonLd({ name: "How to present a PDF as a PowerPoint", description: DESCRIPTION, steps: STEPS }),
    faqListJsonLd(FAQ),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "PDF to PPT Presenter", path: PATH }]),
  ];

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {jsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/app" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}>
            Make an AI deck <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* hero + tool */}
      <section className="mx-auto max-w-4xl px-5 pt-12 sm:pt-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}>
            <MonitorPlay size={13} /> PDF to PPT Presenter
          </div>
          <h1 className="mx-auto mt-3 max-w-2xl text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[44px]" style={{ color: "var(--ezd-fg-strong)" }}>
            Present any PDF as full-screen slides
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            Only have the PDF, not the PowerPoint? Drop it in and present it like a real deck — full-screen, with arrow-key navigation. Free, no sign-up, and your file never leaves your device.
          </p>
        </div>

        <div className="mt-9 rounded-3xl border p-4 sm:p-6" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
          <PdfPresenter />
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-4xl px-5 py-16">
        <h2 className="text-center text-[24px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>How to present a PDF as a PowerPoint</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.name} className="rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <div className="grid h-8 w-8 place-items-center rounded-lg text-[14px] font-bold" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>{i + 1}</div>
              <h3 className="mt-3 text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{s.name}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-4xl px-5 pb-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3 rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}><f.icon size={19} /></span>
              <span>
                <span className="block text-[14.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{f.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{f.body}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-16">
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

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-24">
        <div className="rounded-3xl border p-8 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Need to build the deck, not just present it?</h2>
          <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            EXdeck turns a one-line brief into a fully editable presentation with real charts and themes — then exports a true .pptx and PDF.
          </p>
          <Link href="/app" className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            <Play size={15} /> Make a presentation with AI
          </Link>
        </div>
        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>
          <UploadCloud size={12} /> Built by EXdeck · exdeck.xyz
        </p>
      </section>
    </main>
  );
}
