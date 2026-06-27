import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Grid3x3, Image, List, Type } from "lucide-react";
import Logo from "@/components/Logo";
import { SITE_URL, landingSoftwareJsonLd, howToJsonLd, faqListJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const PATH = "/documents";
const TITLE = "AI Document Maker — Write Reports, Proposals & Docs with AI | EXdeck";
const DESCRIPTION =
  "Free AI document maker. Describe a report, proposal, brief, or essay and AI writes a structured, Word-style document — headings, tables, data charts, images, and watermarks — with clean multi-page PDF export.";

const KEYWORDS = [
  "ai document maker", "ai document generator", "document generator", "ai writer",
  "ai report generator", "proposal generator", "ai essay writer", "word document ai",
  "business document maker", "ai doc maker", "create document online", "ai report writer",
  "ai letter writer", "document creator online", "ai word document generator",
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
  { name: "Describe your document", text: "Tell the AI what you need — a business report, proposal, case study, brief, or essay — plus the topic. It starts with the right structure." },
  { name: "AI writes it", text: "In seconds you get a structured, Word-style document: headings, paragraphs, tables, data charts, and callouts — all editable inline." },
  { name: "Edit & export", text: "Refine any text, add images or a custom watermark, then export a clean multi-page PDF ready to share, print, or email." },
];

const FAQ = [
  { q: "What is the AI document maker?", a: "It's a free AI writer that turns a short brief into a structured, Word-style document — headings, paragraphs, tables, data charts, images, and watermarks — that you edit inline and export to PDF." },
  { q: "What types of documents can it write?", a: "Business reports, project proposals, case studies, white papers, briefs, letters, and essays. You describe the type and topic, and the AI starts with the right structure and formatting." },
  { q: "Can I edit the document after it's generated?", a: "Yes — it's a true inline editor. Change any word, restyle text, add or edit tables and charts, drag in images, and set a custom watermark." },
  { q: "Can I export to PDF?", a: "Yes. Export a clean, multi-page PDF that's ready to share, print, or email. Your tables, charts, and images are preserved in the layout." },
  { q: "Is the AI document maker free?", a: "Yes — you can make documents on the free plan using your monthly AI credits. Pro ($1.99/month) unlocks unlimited documents along with presentations, spreadsheets, and resumes." },
  { q: "How is a document different from a presentation?", a: "Documents are long-form, Word-style pages — reports, proposals, essays — while presentations are slides. EXdeck makes both, plus spreadsheets and resumes, in one place." },
];

export default function DocumentsPage() {
  const jsonLd = [
    landingSoftwareJsonLd("EXdeck AI Document Maker", DESCRIPTION, PATH),
    howToJsonLd({ name: "How to make a document with AI", description: DESCRIPTION, steps: STEPS }),
    faqListJsonLd(FAQ),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AI Document Maker", path: PATH }]),
  ];

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {jsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}

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
          Describe a report, proposal, brief, or essay and AI writes a structured, Word-style document — headings, paragraphs, tables, charts, and watermarks. Export to PDF instantly.
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

        <div className="mt-20">
          <h2 className="text-center text-2xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>How to make a document with AI</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.name} className="rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
                <div className="grid h-8 w-8 place-items-center rounded-lg text-[14px] font-bold" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>{i + 1}</div>
                <h3 className="mt-3 text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{s.name}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{s.text}</p>
              </div>
            ))}
          </div>
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
          <h2 className="text-center text-xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Why EXdeck for Documents?</h2>
          <div className="mt-6 space-y-3 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>All-in-one workspace:</strong> Presentations, documents, spreadsheets, and resumes in one place — no separate subscriptions.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Real PDF export:</strong> Clean, multi-page PDFs you can share, print, or email. No web-only lock-in.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Free to start:</strong> Make documents on the free plan with your monthly credits; Pro ($1.99/month) unlocks unlimited documents, presentations, spreadsheets, and resumes.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/docs" className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Start writing <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-[13px]" style={{ color: "var(--ezd-fg-quiet)" }}>Free to start • Clean PDF export • Pro from $1.99/month</p>
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
