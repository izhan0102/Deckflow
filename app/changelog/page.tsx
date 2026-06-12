import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import ChangelogView from "@/components/ChangelogView";
import { fetchChangelog } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Every update to EXdeck, the free AI PPT maker — pulled live from the public GitHub history. New features, fixes, and improvements by release.",
  alternates: { canonical: "/changelog" },
};

// Rebuild at most hourly; the fetch itself is also ISR-cached.
export const revalidate = 3600;

export default async function ChangelogPage() {
  const groups = await fetchChangelog();

  if (!groups || groups.length === 0) {
    return <Fallback />;
  }

  return <ChangelogView groups={groups} />;
}

/** Shown only if the live GitHub fetch fails or is rate-limited. */
function Fallback() {
  return (
    <main
      className="relative grid min-h-screen place-items-center px-6"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}
    >
      <div className="absolute inset-x-0 top-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Logo size="sm" href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white"
          >
            <ArrowLeft size={12} /> Back to home
          </Link>
        </div>
      </div>

      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
          Changelog
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-white/65">
          The live changelog is taking a breather (GitHub rate limit). Check
          back shortly, or read the full history on{" "}
          <a
            href="https://github.com/izhan0102/Deckflow/commits"
            target="_blank"
            rel="noreferrer"
            className="text-white underline-offset-4 hover:underline"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </main>
  );
}
