"use client";
import Link from "next/link";

export default function LegalShell({
  title, children,
}: { title: string; children: React.ReactNode }) {
  return (
    <main
      className="relative min-h-screen"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}
    >
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-semibold tracking-tight">
          <span
            className="border-b-2 pb-0.5"
            style={{ borderColor: "var(--ezd-fg-strong)", color: "var(--ezd-fg-strong)" }}
          >
            EZdeck
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm hover:opacity-100"
          style={{ color: "var(--ezd-fg-muted)" }}
        >
          ← Back to home
        </Link>
      </header>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-4">
        <h1
          className="mb-2 text-3xl font-semibold tracking-tight md:text-4xl"
          style={{ color: "var(--ezd-fg-strong)" }}
        >
          {title}
        </h1>
        <div className="legal-prose">
          {children}
        </div>
      </article>
      <style jsx global>{`
        .legal-prose { color: var(--ezd-fg-muted); line-height: 1.65; font-size: 15px; }
        .legal-prose h2 { color: var(--ezd-fg-strong); font-size: 20px; font-weight: 600; margin-top: 32px; margin-bottom: 12px; }
        .legal-prose h3 { color: var(--ezd-fg-strong); font-size: 16px; font-weight: 600; margin-top: 24px; margin-bottom: 8px; }
        .legal-prose p { margin-bottom: 14px; }
        .legal-prose ul { margin-bottom: 14px; padding-left: 22px; list-style: disc; }
        .legal-prose ol { margin-bottom: 14px; padding-left: 22px; list-style: decimal; }
        .legal-prose li { margin-bottom: 6px; }
        .legal-prose a { color: var(--ezd-fg-strong); text-decoration: underline; text-underline-offset: 2px; }
        .legal-prose strong { color: var(--ezd-fg-strong); }
        .legal-prose .meta { color: var(--ezd-fg-quiet); font-size: 13px; }
        .legal-prose hr { border: none; border-top: 1px solid var(--ezd-divider); margin: 24px 0; }
      `}</style>
    </main>
  );
}
