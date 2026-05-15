"use client";
import Link from "next/link";

export default function LegalShell({
  title, children,
}: { title: string; children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-black text-white">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-semibold tracking-tight">
          <span className="border-b-2 border-white pb-0.5">DeckFlow</span>
        </Link>
        <Link href="/" className="text-sm text-white/60 hover:text-white">← Back to home</Link>
      </header>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-4">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <div className="legal-prose">
          {children}
        </div>
      </article>
      <style jsx global>{`
        .legal-prose { color: rgba(255,255,255,0.78); line-height: 1.65; font-size: 15px; }
        .legal-prose h2 { color: #fff; font-size: 20px; font-weight: 600; margin-top: 32px; margin-bottom: 12px; }
        .legal-prose h3 { color: #fff; font-size: 16px; font-weight: 600; margin-top: 24px; margin-bottom: 8px; }
        .legal-prose p { margin-bottom: 14px; }
        .legal-prose ul { margin-bottom: 14px; padding-left: 22px; list-style: disc; }
        .legal-prose ol { margin-bottom: 14px; padding-left: 22px; list-style: decimal; }
        .legal-prose li { margin-bottom: 6px; }
        .legal-prose a { color: #c4b5fd; text-decoration: underline; text-underline-offset: 2px; }
        .legal-prose strong { color: #fff; }
        .legal-prose .meta { color: rgba(255,255,255,0.45); font-size: 13px; }
        .legal-prose hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0; }
      `}</style>
    </main>
  );
}
