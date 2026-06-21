import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, FileText, Keyboard, Monitor, Play, Upload } from "lucide-react";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "PDF Presenter | Present PDFs Full-Screen Like PowerPoint - EXdeck",
  description: "Free PDF presenter that turns any PDF into a presentable slideshow. Arrow-key navigation, full-screen mode, and progress tracking. No PowerPoint needed.",
  keywords: ["pdf presenter", "pdf presentation", "present pdf", "pdf slideshow", "pdf viewer", "fullscreen pdf", "pdf presentation mode"],
  openGraph: {
    title: "PDF Presenter - Present Any PDF Full-Screen",
    description: "Upload a PDF and present every page full-screen with arrow-key navigation. Free, fast, and works with any PDF.",
  },
};

export default function PDFPresenterPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <header className="border-b" style={{ borderColor: "var(--ezd-hairline)" }}>
        <div className="mx-auto max-w-6xl px-5 py-4">
          <Logo size="sm" href="/" />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        <h1 className="text-center font-bold" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--ezd-fg-strong)" }}>
          PDF Presenter<br />
          <span style={{ color: "var(--ezd-fg-muted)" }}>Present Any PDF Full-Screen</span>
        </h1>
        
        <p className="mx-auto mt-6 max-w-2xl text-center text-[15px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Only have the PDF, not the PowerPoint? Upload it and present every page full-screen like a real deck. Arrow-key navigation, progress tracking, no .pptx needed.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/pdf-to-ppt" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Open presenter <ArrowRight size={15} />
          </Link>
          <Link href="/#how" className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>
            Learn more
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
            <Step num={1} title="Upload your PDF" desc="Drag and drop a PDF file or click to browse. Files load instantly in your browser." />
            <Step num={2} title="Enter full-screen mode" desc="Press F or click the full-screen button to start presenting. Pages fill the entire screen." />
            <Step num={3} title="Navigate with arrow keys" desc="Left/right arrows move between pages. Space advances, Backspace goes back. ESC exits full-screen." />
            <Step num={4} title="Track your progress" desc="Slide counter shows your position (e.g., 12/45). Preview rail on the side lets you jump to any page." />
          </div>
        </div>

        <div className="mt-20 rounded-2xl border p-8" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Why Use EXdeck's PDF Presenter?</h2>
          <div className="mt-6 space-y-3 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>100% free, no limits:</strong> Upload and present as many PDFs as you want. No signup, no watermarks, no restrictions.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Privacy-first:</strong> PDFs process in your browser. We don't upload, store, or see your files. They never leave your device.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Works offline:</strong> After loading, everything runs locally. Present without internet if needed.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>No software install:</strong> Runs in your browser. Works on Windows, Mac, Linux, and Chromebooks.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/pdf-to-ppt" className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Start presenting <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-[13px]" style={{ color: "var(--ezd-fg-quiet)" }}>Free forever • No signup • Privacy-first</p>
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
