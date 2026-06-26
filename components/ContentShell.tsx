import Link from "next/link";
import Logo from "@/components/Logo";
import { ArrowRight } from "lucide-react";
import { LANDING_PAGES } from "@/lib/content";

/**
 * Shared dark-theme shell for SEO content pages (keyword landing pages
 * and blog posts). Header with the brand + a strong "open editor" CTA,
 * and a footer that cross-links every landing page and the blog so link
 * equity flows between them and back to home.
 */
export default function ContentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {/* Light-mode dot texture (invisible in dark). */}
      <div aria-hidden className="landing-bg" />

      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
        <nav
          className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border px-3 py-1.5 backdrop-blur-xl"
          style={{ background: "var(--ezd-nav-bg)", borderColor: "var(--ezd-hairline)" }}
        >
          <Logo size="sm" href="/" />
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition hover:bg-white/90"
          >
            Open the editor <ArrowRight size={13} />
          </Link>
        </nav>
      </header>

      {children}

      <footer style={{ borderTop: "1px solid var(--ezd-hairline)" }}>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol
              title="Make a presentation"
              items={LANDING_PAGES.map((p) => ({ label: p.h1, href: `/${p.slug}` }))}
            />
            <FooterCol
              title="Guides"
              items={[
                { label: "Blog", href: "/blog" },
                { label: "How it works", href: "/#how" },
                { label: "Examples", href: "/#examples" },
              ]}
            />
            <FooterCol
              title="EXdeck"
              items={[
                { label: "Home", href: "/" },
                { label: "About", href: "/about" },
                { label: "Contact", href: "/contact" },
                { label: "Open the editor", href: "/app" },
              ]}
            />
          </div>
          <div className="mt-8 border-t border-dashed pt-4 text-[11px]" style={{ borderColor: "var(--ezd-hairline)", opacity: 0.4 }}>
            © {new Date().getFullYear()} EXdeck — the free AI PPT maker. Make
            PowerPoint presentations from text in seconds.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ opacity: 0.4 }}>
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-[12.5px]">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="transition hover:opacity-100" style={{ opacity: 0.65 }}>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Renders the body sections shared by landing pages and blog posts. */
export function ContentSections({
  sections,
}: {
  sections: { h: string; p?: string[]; list?: string[] }[];
}) {
  return (
    <>
      {sections.map((s, i) => (
        <section key={i} className="mt-9">
          <h2 className="text-[19px] font-semibold tracking-tight text-white">{s.h}</h2>
          {s.p?.map((para, j) => (
            <p key={j} className="mt-3 text-[14.5px] leading-relaxed text-white/70">
              {para}
            </p>
          ))}
          {s.list && (
            <ul className="mt-3 space-y-2">
              {s.list.map((li, j) => (
                <li
                  key={j}
                  className="flex gap-2.5 text-[14.5px] leading-relaxed text-white/70"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/80" />
                  <span>{li}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

/** Shared FAQ block (visible + matches the FAQPage JSON-LD). */
export function ContentFaq({ faq }: { faq: { q: string; a: string }[] }) {
  return (
    <section className="mt-12">
      <h2 className="text-[19px] font-semibold tracking-tight text-white">
        Frequently asked questions
      </h2>
      <div className="mt-4 space-y-4">
        {faq.map((f, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-[14.5px] font-semibold text-white">{f.q}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
