import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, FileText, Keyboard, Monitor, Play, Sparkles, Upload } from "lucide-react";
import Logo from "@/components/Logo";
import { SITE_URL, landingSoftwareJsonLd, howToJsonLd, faqListJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const PATH = "/pdf-presenter";
const TITLE = "PDF Presenter — Present Any PDF Full-Screen Like Slides, Free | EXdeck";
const DESCRIPTION =
  "Free PDF presenter: upload any PDF and present every page full-screen like a real slideshow — arrow-key navigation, a slide counter, and a preview rail. No PowerPoint, no signup, runs in your browser. A rare tool most presentation sites don't offer.";

const KEYWORDS = [
  "pdf presenter", "present pdf", "present pdf full screen", "pdf presentation mode",
  "pdf slideshow", "present pdf online", "fullscreen pdf viewer", "play pdf as slides",
  "present a pdf like powerpoint", "present pdf without powerpoint", "pdf presentation tool",
  "view pdf fullscreen", "pdf to slideshow",
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
  { name: "Upload your PDF", text: "Drag and drop a PDF or click to browse. It loads instantly in your browser — nothing is uploaded to a server." },
  { name: "Enter full-screen", text: "Press F or the full-screen button to start presenting. Each page fills the entire screen, with no browser chrome." },
  { name: "Navigate with the keyboard", text: "Arrow keys move between pages, Space advances, Backspace goes back, and Esc exits — exactly like PowerPoint." },
  { name: "Track your progress", text: "A live slide counter shows your position, and the preview rail lets you jump to any page instantly." },
];

const FAQ = [
  { q: "What is a PDF presenter?", a: "It's a tool that plays any PDF as a full-screen slideshow — arrow-key navigation, a slide counter, and a page preview rail — so you can present a PDF exactly like a PowerPoint deck, without owning the original .pptx file." },
  { q: "Do I need PowerPoint to present a PDF?", a: "No. Upload the PDF and present every page full-screen right in your browser. No PowerPoint, Keynote, or any software install required." },
  { q: "Is the PDF presenter free?", a: "Yes — presenting PDFs is completely free, with no signup and no watermark." },
  { q: "Are my files private?", a: "Yes. The PDF is rendered in your browser and is never uploaded to a server, so your files never leave your device. It even works offline once loaded." },
  { q: "Why is a PDF presenter rare?", a: "Most AI presentation sites only generate or convert slides — very few let you present an existing PDF full-screen as-is. EXdeck does, alongside its AI presentation, document, spreadsheet, and resume makers." },
  { q: "What can I present?", a: "Any PDF — client decks you only received as PDFs, archived slides, reports, proposals, or briefs — page by page, full-screen." },
];

const MORE = [
  ["AI Presentations", "/presentations"],
  ["AI Documents", "/documents"],
  ["AI Spreadsheet", "/spreadsheet"],
  ["AI Resume", "/resume"],
  ["Document Analyser", "/analyse"],
  ["File Converters", "/converter"],
  ["Dashboard", "/app"],
];

export default function PDFPresenterPage() {
  const jsonLd = [
    landingSoftwareJsonLd("EXdeck PDF Presenter", DESCRIPTION, PATH),
    howToJsonLd({ name: "How to present a PDF full-screen", description: DESCRIPTION, steps: STEPS }),
    faqListJsonLd(FAQ),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "PDF Presenter", path: PATH }]),
  ];

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {jsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}

      <header className="border-b" style={{ borderColor: "var(--ezd-hairline)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/app" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}>Open dashboard <ArrowRight size={13} /></Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}>
            <Sparkles size={12} /> A rare tool — few sites have this
          </span>
        </div>

        <h1 className="mt-5 text-center font-bold" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--ezd-fg-strong)" }}>
          PDF Presenter<br />
          <span style={{ color: "var(--ezd-fg-muted)" }}>Present Any PDF Full-Screen</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-center text-[15px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Only have the PDF, not the PowerPoint? Upload it and present every page full-screen like a real deck — arrow-key navigation, a slide counter, and a preview rail. No .pptx, no signup, and most presentation tools can&rsquo;t do this at all.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/pdf-to-ppt" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Open PDF presenter <ArrowRight size={15} />
          </Link>
          <Link href="/app" className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>
            Open the dashboard
          </Link>
        </div>

        <div className="mt-20 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<Upload size={24} />} title="Drag & Drop Upload" desc="Drop any PDF file and it renders instantly. No conversion, no processing time — just upload and present." />
          <Feature icon={<Play size={24} />} title="Full-Screen Mode" desc="Press F to enter full-screen presentation mode. Clean, distraction-free view with no browser chrome." />
          <Feature icon={<Keyboard size={24} />} title="Arrow-Key Navigation" desc="Left/right arrows to navigate slides. Space to advance, Backspace to go back. Works like PowerPoint." />
          <Feature icon={<Monitor size={24} />} title="Progress Bar" desc="Live slide counter (e.g., 5/23) so you always know where you are in the deck." />
          <Feature icon={<Eye size={24} />} title="Preview Rail" desc="See all pages at once in a scrollable sidebar. Jump to any slide instantly." />
          <Feature icon={<FileText size={24} />} title="Works Offline" desc="After upload, the PDF loads in your browser. No server processing, so it works even without internet." />
        </div>

        <div className="mt-20 rounded-2xl border p-8 sm:p-12" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-2xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Perfect For</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <UseCase title="Client Presentations" desc="Present decks you received as PDFs without needing the original PowerPoint file." />
            <UseCase title="Archived Slides" desc="Old presentations saved as PDFs. Present them again without tracking down the .pptx source." />
            <UseCase title="Shared Decks" desc="Someone sent you a PDF to present. Upload and present immediately, no conversion needed." />
            <UseCase title="Reports & Documents" desc="Present multi-page reports, proposals, or briefs page-by-page in full-screen." />
          </div>
        </div>

        <div className="mt-20 rounded-2xl border p-8" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>How It Works</h2>
          <div className="mt-6 space-y-4">
            {STEPS.map((s, i) => (
              <Step key={s.name} num={i + 1} title={s.name} desc={s.text} />
            ))}
          </div>
        </div>

        <div className="mt-20">
          <h2 className="text-center text-2xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Frequently asked questions</h2>
          <div className="mx-auto mt-6 max-w-2xl divide-y" style={{ borderColor: "var(--ezd-divider)" }}>
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{f.q}</summary>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-20 rounded-2xl border p-8" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Why Use EXdeck&rsquo;s PDF Presenter?</h2>
          <div className="mt-6 space-y-3 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>A genuinely rare feature:</strong> Most AI presentation tools only generate or convert slides — almost none let you present an existing PDF full-screen, as-is. EXdeck does.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>100% free, no limits:</strong> Upload and present as many PDFs as you want. No signup, no watermarks, no restrictions.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Privacy-first:</strong> PDFs process in your browser. We don&rsquo;t upload, store, or see your files — they never leave your device.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>No install:</strong> Runs in your browser on Windows, Mac, Linux, and Chromebooks.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/pdf-to-ppt" className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Start presenting <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-[13px]" style={{ color: "var(--ezd-fg-quiet)" }}>Free forever • No signup • Privacy-first</p>
        </div>

        {/* All features — so brand visitors discover everything EXdeck does */}
        <div className="mt-16 border-t pt-10" style={{ borderColor: "var(--ezd-divider)" }}>
          <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ezd-fg-quiet)" }}>Explore all of EXdeck</h2>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {MORE.map(([label, href]) => (
              <Link key={href} href={href} className="rounded-full border px-4 py-2 text-[13px] font-medium transition hover:border-white/25" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div>
      <div className="grid h-12 w-12 place-items-center rounded-xl border" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}>
        {icon}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{desc}</p>
    </div>
  );
}

function UseCase({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-page)" }}>
      <h3 className="text-[14px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{desc}</p>
    </div>
  );
}

function Step({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border text-[14px] font-bold" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-page)", color: "var(--ezd-fg-strong)" }}>
        {num}
      </div>
      <div>
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{desc}</p>
      </div>
    </div>
  );
}
