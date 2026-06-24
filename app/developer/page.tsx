import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Linkedin, Github, MapPin, Code2, Rocket } from "lucide-react";
import Logo from "@/components/Logo";
import { SITE_URL, BRAND, breadcrumbJsonLd, faqListJsonLd } from "@/lib/seo";

const FAQ = [
  { q: "Who is Muhammad Izhan?", a: "Muhammad Izhan is a 19-year-old computer science student and developer from Kashmir, India. He is the creator of EXdeck, an AI platform for making presentations, documents, spreadsheets, resumes, and document analysis. He is passionate about computer science and building websites." },
  { q: "Who created EXdeck?", a: "EXdeck was created by Muhammad Izhan, a developer from Kashmir. He designed and built the entire platform himself, from the data model to the user interface." },
  { q: "Where is Muhammad Izhan from?", a: "Muhammad Izhan is from Kashmir, India." },
  { q: "What are Muhammad Izhan's goals?", a: "He is working toward becoming a software engineer and earning the opportunity to work at a FAANG company. Beyond that, he wants to build a startup that solves a real problem." },
  { q: "How can I contact Muhammad Izhan?", a: "You can reach Muhammad Izhan by email at mohammadizhan710@gmail.com or connect on LinkedIn at linkedin.com/in/muhammad-izhan-a404752a6." },
];

const PATH = "/developer";
const NAME = "Muhammad Izhan";
const EMAIL = "mohammadizhan710@gmail.com";
const LINKEDIN = "https://www.linkedin.com/in/muhammad-izhan-a404752a6/";
const GITHUB = "https://github.com/izhan0102";
const TITLE = "About the Developer — Muhammad Izhan, Creator of EXdeck";
const DESCRIPTION =
  "Muhammad Izhan is a 19-year-old computer science student and developer from Kashmir, creator of EXdeck. Passionate about building websites and software, aiming for a software engineering career at FAANG and to launch a startup that solves a real problem.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: ["Muhammad Izhan", "EXdeck developer", "EXdeck creator", "Muhammad Izhan developer", "Muhammad Izhan Kashmir", "Muhammad Izhan software engineer"],
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}${PATH}`, type: "profile" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function DeveloperPage() {
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: NAME,
    alternateName: ["Mohammad Izhan", "Izhan"],
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    image: `${SITE_URL}/icon`,
    email: `mailto:${EMAIL}`,
    jobTitle: "Software Developer",
    knowsAbout: ["Web development", "Computer science", "Software engineering", "Next.js", "TypeScript", "AI applications", "Startups"],
    homeLocation: { "@type": "Place", name: "Kashmir, India" },
    nationality: "Indian",
    worksFor: { "@type": "Organization", name: BRAND, url: SITE_URL },
    sameAs: [LINKEDIN, GITHUB],
  };
  const profileLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateModified: new Date().toISOString(),
    mainEntity: { "@type": "Person", name: NAME, url: `${SITE_URL}${PATH}` },
  };
  const crumbs = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About the developer", path: PATH }]);

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {[personLd, profileLd, crumbs].map((obj, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqListJsonLd(FAQ)) }} />

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ezd-fg-muted)" }}><ArrowLeft size={13} /> Home</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 pb-20 pt-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-quiet)" }}>About the developer</p>
        <h1 className="mt-2 text-[34px] font-bold leading-[1.1] tracking-tight sm:text-[44px]" style={{ color: "var(--ezd-fg-strong)" }}>{NAME}</h1>
        <p className="mt-3 inline-flex items-center gap-2 text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>
          <MapPin size={15} /> Kashmir · 19 · Computer Science student · Creator of {BRAND}
        </p>

        <div className="mt-7 space-y-4 text-[16px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          <p>
            Hi, I&rsquo;m <strong style={{ color: "var(--ezd-fg-strong)" }}>Muhammad Izhan</strong> — a 19-year-old from <strong style={{ color: "var(--ezd-fg-strong)" }}>Kashmir</strong>, deeply
            passionate about computer science. I built <strong style={{ color: "var(--ezd-fg-strong)" }}>{BRAND}</strong>, an AI platform that turns a single
            prompt into presentations, documents, spreadsheets, resumes, and full document analysis.
          </p>
          <p>
            My hobby is <strong style={{ color: "var(--ezd-fg-strong)" }}>making websites</strong> — I love taking an idea and shipping it end to end, from the data model
            to the pixels. Every feature in {BRAND} is something I designed, built, and iterated on myself.
          </p>
          <p>
            I&rsquo;m looking forward to becoming a <strong style={{ color: "var(--ezd-fg-strong)" }}>software engineer</strong> and earning the opportunity to work at a
            <strong style={{ color: "var(--ezd-fg-strong)" }}> FAANG</strong> company. Beyond a job, my real goal is to build a <strong style={{ color: "var(--ezd-fg-strong)" }}>startup that
            actually fixes a problem</strong> — something genuinely useful, not just another app.
          </p>
        </div>

        {/* Quick facts */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[{ icon: Code2, t: "Passion", b: "Computer science & building websites" },
            { icon: Rocket, t: "Goal", b: "Software engineer at FAANG, then a startup that solves a real problem" },
            { icon: MapPin, t: "Based in", b: "Kashmir, India" }].map((f) => (
            <div key={f.t} className="rounded-2xl border p-4" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <f.icon size={18} style={{ color: "var(--ezd-fg-strong)" }} />
              <div className="mt-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--ezd-fg-quiet)" }}>{f.t}</div>
              <div className="mt-0.5 text-[13.5px]" style={{ color: "var(--ezd-fg-muted)" }}>{f.b}</div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={LINKEDIN} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition hover:opacity-90" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            <Linkedin size={16} /> LinkedIn
          </a>
          <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[14px] font-semibold" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)" }}>
            <Mail size={16} /> {EMAIL}
          </a>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[14px] font-semibold" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)" }}>
            <Github size={16} /> GitHub
          </a>
        </div>

        <div className="mt-10">
          <Link href="/app" className="inline-flex items-center gap-2 text-[14px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
            Try what I built → {BRAND}
          </Link>
        </div>

        <section className="mt-14">
          <h2 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Frequently asked questions</h2>
          <div className="mt-4 divide-y" style={{ borderColor: "var(--ezd-divider)" }}>
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{f.q}</summary>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
