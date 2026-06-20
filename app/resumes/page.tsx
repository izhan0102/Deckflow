import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Briefcase, Contact, Download, FileText, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "AI Resume Builder | Create ATS-Friendly Resumes in Minutes - EXdeck",
  description: "Free AI resume builder with 6 professional templates. Auto-fit to one page, ATS-friendly formatting, and clean PDF export. Build your resume in minutes, not hours.",
  keywords: ["ai resume builder", "resume maker", "cv builder", "resume generator", "ats resume", "free resume builder", "professional resume"],
  openGraph: {
    title: "AI Resume Builder - Create Professional Resumes Fast",
    description: "Build ATS-friendly resumes with AI. 6 templates, auto-fit to one page, and instant PDF export. Free for everyone.",
  },
};

export default function ResumesPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <header className="border-b" style={{ borderColor: "var(--ezd-hairline)" }}>
        <div className="mx-auto max-w-6xl px-5 py-4">
          <Logo size="sm" href="/" />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        <h1 className="text-center font-bold" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--ezd-fg-strong)" }}>
          AI Resume Builder<br />
          <span style={{ color: "var(--ezd-fg-muted)" }}>Create ATS-Friendly Resumes in Minutes</span>
        </h1>
        
        <p className="mx-auto mt-6 max-w-2xl text-center text-[15px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Choose a template, fill in your details, and let AI refine your bullets. Auto-fit to one page with clean, ATS-friendly formatting. Export to PDF instantly.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/resume" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Build your resume <ArrowRight size={15} />
          </Link>
          <Link href="/#how" className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>
            See templates
          </Link>
        </div>

        <div className="mt-20 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<FileText size={24} />} title="6 Professional Templates" desc="Classic, modern, minimal, compact, sidebar, and professional layouts. Pick what fits your industry." />
          <Feature icon={<Sparkles size={24} />} title="AI Refinement" desc="Paste your raw bullets and AI rewrites them for impact: stronger verbs, quantified results, and cleaner phrasing." />
          <Feature icon={<Contact size={24} />} title="ATS-Friendly Format" desc="Clean, parseable structure that applicant tracking systems can read. No fancy fonts or graphics that break scanners." />
          <Feature icon={<Briefcase size={24} />} title="All Sections Included" desc="Experience, education, skills, projects, certifications, and languages. Add or remove sections as needed." />
          <Feature icon={<Award size={24} />} title="Auto-Fit to One Page" desc="Adjusts font sizes and spacing to fit everything on one page without manual tweaking." />
          <Feature icon={<Download size={24} />} title="Clean PDF Export" desc="Download a professional, print-ready PDF. No watermarks, no branding, just your resume." />
        </div>

        <div className="mt-20 rounded-2xl border p-8 sm:p-12" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-2xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>How It Works</h2>
          <div className="mt-8 space-y-6">
            <Step num={1} title="Choose a template" desc="Pick from 6 layouts designed for different industries and experience levels." />
            <Step num={2} title="Fill in your details" desc="Add your contact info, work experience, education, skills, and projects. Drag to reorder." />
            <Step num={3} title="Refine with AI (optional)" desc="Paste your raw bullets and AI rewrites them for clarity and impact. Review and accept or reject each change." />
            <Step num={4} title="Export to PDF" desc="Download a clean, one-page PDF ready to submit. No signup required, completely free." />
          </div>
        </div>

        <div className="mt-20 rounded-2xl border p-8" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Why EXdeck for Resumes?</h2>
          <div className="mt-6 space-y-3 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>100% free, forever:</strong> No hidden costs, no premium tiers, no watermarks. Build unlimited resumes and download as many PDFs as you need.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>ATS-optimized:</strong> Clean structure, standard section names, and no graphics that confuse applicant tracking systems.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Privacy-first:</strong> Your resume data stays in your browser. We don't store it, sell it, or share it with anyone.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>No signup required:</strong> Start building immediately. Sign up only if you want to save multiple versions in the cloud.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/resume" className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Create your resume now <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-[13px]" style={{ color: "var(--ezd-fg-quiet)" }}>Free forever • No signup required • ATS-friendly</p>
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
