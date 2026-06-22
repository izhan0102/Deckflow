import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, Calculator, ShieldCheck, Download } from "lucide-react";
import Logo from "@/components/Logo";
import SpreadsheetApp from "@/components/SpreadsheetApp";
import { SITE_URL, landingSoftwareJsonLd, howToJsonLd, faqListJsonLd, breadcrumbJsonLd } from "@/lib/seo";

const PATH = "/spreadsheet";
const TITLE = "AI Spreadsheet — Make & Edit Excel Sheets with AI, Free";
const DESCRIPTION =
  "Free AI spreadsheet. Type what you want — 'make a table of this data', 'add a total column', 'change C4 to 99' — and the AI builds and edits the sheet with live formulas. Export to Excel (.xlsx) or PDF. Private, in your browser.";

const KEYWORDS = [
  "ai spreadsheet", "ai excel", "ai excel generator", "make excel with ai", "spreadsheet maker",
  "online spreadsheet", "free excel online", "ai table maker", "excel ai", "create spreadsheet online",
  "spreadsheet ai", "natural language spreadsheet", "ai data table",
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
  { name: "Start with a sheet", text: "Open the grid — columns A, B, C and rows 1, 2, 3, just like Excel. Type values or formulas directly." },
  { name: "Ask the AI", text: "In the box, say things like 'make a table of sales by quarter', 'add a total row', or 'change C4 to 99'. The AI edits the sheet for you." },
  { name: "Download", text: "Export a real Excel .xlsx (formulas preserved) or a clean PDF. Everything runs on your device." },
];

const FAQ = [
  { q: "What can the AI do?", a: "Build tables from your data, add or edit cells, create total rows/columns, write formulas (SUM, AVERAGE, IF, and more), insert or delete rows and columns, and reformat — all from plain-English instructions." },
  { q: "Does it support formulas?", a: "Yes. Type formulas like =SUM(B2:B10), =AVERAGE(A1:A9), =IF(A1>10,\"high\",\"low\"), or =B2*C2 and they recalculate live. The AI writes formulas too, so totals stay correct when values change." },
  { q: "Can I export to Excel?", a: "Yes — download a real .xlsx that opens in Excel, Google Sheets, and Numbers with formulas intact, or export a clean PDF." },
  { q: "Is it free and private?", a: "The spreadsheet and exports are free and run entirely in your browser. The AI assistant requires a free sign-in. Your data isn't stored on a server." },
  { q: "What if I ask something it can't do?", a: "It tells you — a short message appears above the input (for example, 'I couldn't find that column') and disappears on its own." },
];

export default function SpreadsheetPage() {
  const jsonLd = [
    landingSoftwareJsonLd("EXdeck AI Spreadsheet", DESCRIPTION, PATH),
    howToJsonLd({ name: "How to make a spreadsheet with AI", description: DESCRIPTION, steps: STEPS }),
    faqListJsonLd(FAQ),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "AI Spreadsheet", path: PATH }]),
  ];

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {jsonLd.map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/app" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}>Make an AI deck <ArrowRight size={13} /></Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pt-12 sm:pt-14">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}><Sparkles size={12} /> AI Spreadsheet</div>
          <h1 className="mx-auto mt-3 max-w-2xl text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[42px]" style={{ color: "var(--ezd-fg-strong)" }}>Build spreadsheets by just asking</h1>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            Type your data or tell the AI what you need — tables, totals, formulas, edits. Export to Excel or PDF. Free and private, right in your browser.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border p-4 sm:p-6" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
          <SpreadsheetApp />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16">
        <h2 className="text-center text-[24px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>How it works</h2>
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

      <section className="mx-auto max-w-4xl px-5 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {[{ icon: Sparkles, t: "Plain-English editing", b: "Make tables, add totals, write formulas, change any cell — just describe it." },
            { icon: Calculator, t: "Live formulas", b: "SUM, AVERAGE, IF, arithmetic and more recalculate instantly as values change." },
            { icon: Download, t: "Excel & PDF export", b: "Download a real .xlsx with formulas intact, or a clean PDF table." }].map((f) => (
            <div key={f.t} className="flex items-start gap-3 rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}><f.icon size={19} /></span>
              <span>
                <span className="block text-[14.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{f.t}</span>
                <span className="mt-1 block text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{f.b}</span>
              </span>
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
