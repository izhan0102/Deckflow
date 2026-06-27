import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Download, Languages, MessageSquare, Play, Sparkles, Wand2 } from "lucide-react";
import Logo from "@/components/Logo";
import { softwareJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AI Presentation Maker | Create PowerPoint Slides in Seconds - EXdeck",
  description: "Free AI presentation maker that turns your brief into fully designed PowerPoint slides. Real charts, speaker notes, 45 themes, and instant .pptx export. No design skills needed.",
  keywords: ["ai presentation maker", "ai ppt maker", "powerpoint generator", "presentation creator", "slide maker", "free ppt maker", "ai slides"],
  openGraph: {
    title: "AI Presentation Maker - Create Slides in Seconds",
    description: "Turn a brief into a fully designed presentation with AI. Real charts, speaker notes, and instant PowerPoint export.",
  },
};

export default function PresentationsPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd()) }} />
      
      <header className="border-b" style={{ borderColor: "var(--ezd-hairline)" }}>
        <div className="mx-auto max-w-6xl px-5 py-4">
          <Logo size="sm" href="/" />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        <h1 className="text-center font-bold" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--ezd-fg-strong)" }}>
          AI Presentation Maker<br />
          <span style={{ color: "var(--ezd-fg-muted)" }}>Create PowerPoint Slides in Seconds</span>
        </h1>
        
        <p className="mx-auto mt-6 max-w-2xl text-center text-[15px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Type a brief and get a fully designed presentation with real charts, speaker notes, and professional layouts. Export to .pptx or .pdf instantly.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/app" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[14.5px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Start creating <ArrowRight size={15} />
          </Link>
          <Link href="/#how" className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[14.5px] font-medium transition hover:border-white/25" style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}>
            See how it works
          </Link>
        </div>

        <div className="mt-20 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<Wand2 size={24} />} title="AI-Powered Generation" desc="Describe your topic in one line. AI picks the best layouts, writes content, and designs slides that fit your message." />
          <Feature icon={<BarChart3 size={24} />} title="Real Data Charts" desc="Automatic bar, line, pie, and area charts with your real data. No manual graphing — the AI decides when numbers need visuals." />
          <Feature icon={<MessageSquare size={24} />} title="Speaker Notes" desc="AI-generated speaker notes for every slide. Practice mode, teleprompter view, and Q&A prep included." />
          <Feature icon={<Sparkles size={24} />} title="45 Premium Themes" desc="Professional color palettes, 28 Google fonts, and 27 background graphics. Canva-grade templates in one click." />
          <Feature icon={<Languages size={24} />} title="Instant Translation" desc="Translate your entire deck into any language while preserving layout, charts, and formatting." />
          <Feature icon={<Download size={24} />} title="Real PowerPoint Export" desc="Download as .pptx (Microsoft PowerPoint) or .pdf. No lock-in — edit locally in PowerPoint, Keynote, or Google Slides." />
        </div>

        <div className="mt-20 rounded-2xl border p-8 sm:p-12" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <h2 className="text-center text-2xl font-bold" style={{ color: "var(--ezd-fg-strong)" }}>Why Choose EXdeck for Presentations?</h2>
          <div className="mt-8 space-y-4 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Up to 10× cheaper than competitors:</strong> $1.99/month for unlimited presentations vs $15-20/month for Gamma, Tome, or Beautiful.ai.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>True PowerPoint export:</strong> Most AI presentation tools lock you into their web editor. We give you real .pptx files you can edit anywhere.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>No design skills needed:</strong> AI picks layouts based on your content type — title hero for intros, bullets for points, charts for data, two-column for comparisons.</p>
            <p><strong style={{ color: "var(--ezd-fg-strong)" }}>Free plan available:</strong> 1 presentation per month, full AI generation, all themes and exports. No credit card required.</p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/app" className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            Create your first presentation <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-[13px]" style={{ color: "var(--ezd-fg-quiet)" }}>Free plan • No credit card • Export to PowerPoint</p>
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
