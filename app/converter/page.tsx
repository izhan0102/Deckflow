import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Image as ImageIcon, FileText, ScanText, ShieldCheck, Zap, ArrowLeftRight } from "lucide-react";
import Logo from "@/components/Logo";
import { CONVERTERS, CONVERTER_CATEGORIES } from "@/lib/converters";
import { SITE_URL, faqListJsonLd, breadcrumbJsonLd, landingSoftwareJsonLd } from "@/lib/seo";

const PATH = "/converter";
const TITLE = "Free File Converter — Images, PDF & OCR in Your Browser";
const DESCRIPTION =
  "Free online file converter. Convert PNG/JPG/WebP, image to PDF, PDF to JPG/PNG, merge, split and organize PDFs, and OCR scans to text — all in your browser. Private, no upload, no watermark, no sign-up.";

const KEYWORDS = [
  "file converter", "free file converter", "online converter", "image converter",
  "pdf converter", "png to jpg", "image to pdf", "pdf to jpg", "merge pdf", "split pdf",
  "organize pdf", "ocr pdf", "convert files online free", "browser file converter",
];

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}${PATH}`, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const CAT_ICON = { Images: ImageIcon, PDF: FileText, Text: ScanText } as const;

const FEATURES = [
  { icon: ShieldCheck, title: "100% private", body: "Every conversion runs on your device — files are never uploaded to a server." },
  { icon: Zap, title: "Instant & free", body: "No queues, no sign-up, no watermark, no limits. Just convert and download." },
  { icon: ArrowLeftRight, title: "Many formats", body: "Images, PDFs, and OCR — the everyday conversions, all in one place." },
];

const HUB_FAQ = [
  { q: "Is this file converter free?", a: "Yes — every converter here is completely free, with no sign-up, no watermark, and no limits." },
  { q: "Are my files uploaded?", a: "No. All conversions run entirely in your browser using on-device processing, so your files never leave your computer." },
  { q: "What can I convert?", a: "Images (PNG, JPG, WebP) in any direction, images to PDF, PDF to JPG/PNG, merge/split/organize PDFs, and OCR scanned PDFs or images to text." },
];

export default function ConverterHub() {
  const jsonLd = [
    landingSoftwareJsonLd("EXdeck File Converter", DESCRIPTION, PATH),
    faqListJsonLd(HUB_FAQ),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Converters", path: PATH }]),
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

      <section className="mx-auto max-w-5xl px-5 pt-12 text-center sm:pt-16">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}>Free converters</div>
        <h1 className="mx-auto mt-3 max-w-2xl text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[44px]" style={{ color: "var(--ezd-fg-strong)" }}>
          Convert anything, right in your browser
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Images, PDFs, and OCR — fast, free, and 100% private. Your files never leave your device.
        </p>
      </section>

      {CONVERTER_CATEGORIES.map((cat) => {
        const items = CONVERTERS.filter((c) => c.category === cat);
        const Icon = CAT_ICON[cat];
        return (
          <section key={cat} className="mx-auto max-w-5xl px-5 pt-12">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}><Icon size={16} /></span>
              <h2 className="text-[20px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>{cat}</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => (
                <Link
                  key={c.slug} href={`/converter/${c.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-2xl border p-4 transition hover:shadow-lg"
                  style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
                >
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{c.name}</span>
                    <span className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--ezd-fg-muted)" }}>{c.tagline}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--ezd-fg-strong)" }} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-4 sm:grid-cols-3">
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

      <section className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Frequently asked questions</h2>
        <div className="mt-5 divide-y" style={{ borderColor: "var(--ezd-divider)" }}>
          {HUB_FAQ.map((f) => (
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
