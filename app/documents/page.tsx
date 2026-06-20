import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Grid3x3, Image, List, Type } from "lucide-react";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "AI Document Maker | Create Structured Documents with AI - EXdeck",
  description: "Free AI document generator that writes structured, Word-style documents. Headings, tables, charts, watermarks, and clean PDF export. Perfect for reports, proposals, and briefs.",
  keywords: ["ai document maker", "document generator", "ai writer", "document creator", "business document maker", "report generator", "proposal maker"],
  openGraph: {
    title: "AI Document Maker - Create Documents in Seconds",
    description: "Generate structured documents with AI. Tables, charts, headings, and professional formatting. Export to PDF instantly.",
  },
};

export default function DocumentsPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <header className="border-b" style={{ borderColor: "var(--ezd-hairline)" }}>
        <div className="mx-auto max-w-6xl px-5 py-4">
          <Logo size="sm" href="/" />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        <h1 className="text-center font-bold" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--ezd-fg-strong)" }}>
          AI Document Maker<br />
          <span style={{ color: "var(--ezd-fg-muted)" }}>Write Professional Documents in Seconds</span>
        </h1>
        
        <p className="mx-auto mt-6 max-w-2xl text-center text-[15px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Describe what you need and AI writes a structured document — headings, paragraphs, tables, charts, and watermarks. Export to PDF instantly.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/docs" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Create a document <ArrowRight size={15} />
          </Link>
          <Link href="/#how" className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>
            See examples
          </Link>
        </div>

        <div className="mt-20 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<FileText size={24} />} title="AI Content Generation" desc="Describe the document type and topic. AI writes structured content with proper headings, sections, and formatting." />
          <Feature icon={<Type size={24} />} title="Rich Text Editing" desc="Live inline editor with bold, italic, underline, lists, and font controls. Edit every word to match your voice." />
          <Feature icon={<Grid3x3 size={24} />} title="Tables & Data" desc="Add tables with custom columns and rows. Perfect for comparisons, specifications, or pricing breakdowns." />
          <Feature icon={<BarChart3 size={24} />} title="Built-in Charts" desc="Insert data charts directly into documents. Bar, line, pie, and area charts that export cleanly to PDF." />
          <Feature icon={<Image size={24} />} title="Images & Watermarks" desc="Upload images, add custom watermarks, and control document size and layout. Multi-page PDF export included." />
          <Feature icon={<List size={24} />} title="Document Templates" desc="Business reports, proposals, case studies, briefs, and more. Each template starts with the right structure." />
        </div>

        <div className="mt-20 rounded-2xl border p-8 sm:p-12" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-2xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Perfect For</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <UseCase title="Business Reports" desc="Quarterly reviews, project summaries, executive briefs. AI writes the structure; you refine the details." />
            <UseCase title="Proposals & Pitches" desc="Client proposals, project plans, RFP responses. Tables for pricing, charts for data, headings for clarity." />
            <UseCase title="Case Studies" desc="Problem, solution, results. AI formats the story; you add the specifics and proof points." />
            <UseCase title="White Papers & Briefs" desc="Industry reports, research summaries, policy briefs. Structured, professional, and export-ready." />
          </div>
        </div>

        <div className="mt-20 rounded-2xl border p-8" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Why EXdeck for Documents?</h2>
          <div className="mt-6 space-y-3 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>All-in-one tool:</strong> Presentations, documents, and resumes in one place. No need for separate subscriptions.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Real PDF export:</strong> Clean, multi-page PDFs you can share, print, or email. No web-only lock-in.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Pro plan required:</strong> Documents are a premium feature. $5/month unlocks unlimited documents, presentations, and resumes.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/docs" className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Start writing <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-[13px]" style={{ color: "var(--ezd-fg-quiet)" }}>Pro plan • $5/month • Clean PDF export</p>
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
