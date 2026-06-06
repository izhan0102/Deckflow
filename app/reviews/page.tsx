"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Loader2, Star } from "lucide-react";
import Logo from "@/components/Logo";
import { loadReviews, type Review } from "@/lib/reviews";

/**
 * Owner-facing review browser. No auth — it's an unlisted utility page
 * (not linked anywhere, not in the sitemap) for reading every submitted
 * review and copying the ones worth featuring in the hero.
 *
 * It's a client page that reads RTDB /reviews directly (public read), so
 * there's nothing to protect server-side.
 */
export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setReviews(await loadReviews());
      } catch {
        setError("Couldn't load reviews.");
      }
    })();
  }, []);

  const avg = useMemo(() => {
    if (!reviews || reviews.length === 0) return "0.0";
    return (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  // Copy a review as a ready-to-paste REVIEWS entry for app/page.tsx.
  const copyAsCode = async (r: Review) => {
    const snippet = `  {
    name: ${JSON.stringify(r.name)},
    role: ${JSON.stringify(r.role)},
    rating: ${r.rating},
    text: ${JSON.stringify(r.text)},
  },`;

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API not supported");
      }

      await navigator.clipboard.writeText(snippet);

      setCopied(r.id || r.name);
      setCopyError(null);

      window.setTimeout(() => {
        setCopied(null);
      }, 1600);
    } catch (err) {
      console.error("Failed to copy review:", err);
      setCopyError(
        "Copy failed. Your browser may not support clipboard access."
      );
    }
  };

  return (
    <main
      className="relative min-h-screen"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}
    >
      <div aria-hidden className="landing-bg" />

      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Logo size="sm" href="/" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white">
            <ArrowLeft size={12} /> Home
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
              Submitted reviews
            </div>
            <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-white">
              {reviews ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "Loading…"}
            </h1>
          </div>
          {reviews && reviews.length > 0 && (
            <div className="flex items-center gap-2 text-[13px] text-white/70">
              <Star size={15} style={{ fill: "var(--ezd-fg-strong)", color: "var(--ezd-fg-strong)" }} />
              <span><span className="font-semibold text-white">{avg}</span> / 5 avg</span>
            </div>
          )}
        </div>

        <p className="mt-2 text-[12.5px] text-white/45">
          Newest first. Click &ldquo;Copy&rdquo; on any review to grab a ready-to-paste
          entry for the hero <code className="text-white/60">REVIEWS</code> array.
        </p>

        <div className="mt-8 space-y-3">
          {error && <p className="text-[13px] text-red-300">{error}</p>}

          {copyError && (
            <p className="text-[13px] text-red-300">
              {copyError}
            </p>
          )}

          {!reviews && !error && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-12">
              <Loader2 size={20} className="animate-spin text-white/45" />
            </div>
          )}

          {reviews && reviews.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-10 text-center text-[13px] text-white/50">
              No reviews yet. Share <Link href="/feedback" className="text-white underline-offset-2 hover:underline">/feedback</Link> to collect some.
            </div>
          )}

          {reviews?.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-[12px] font-semibold text-white">
                    {r.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="text-[13.5px] font-semibold text-white">{r.name}</div>
                    <div className="text-[11.5px] text-white/50">{r.role}</div>
                  </div>
                </div>
                <button
                  onClick={() => copyAsCode(r)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
                  title="Copy as a REVIEWS array entry"
                >
                  <Copy size={11} /> {copied === (r.id || r.name) ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="mt-2.5 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={14}
                    style={{
                      fill: n <= Math.round(r.rating) ? "var(--ezd-fg-strong)" : "transparent",
                      color: n <= Math.round(r.rating) ? "var(--ezd-fg-strong)" : "var(--ezd-divider)",
                    }}
                  />
                ))}
                <span className="ml-1 text-[11.5px] tabular-nums text-white/50">{r.rating}/5</span>
              </div>

              <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/80">
                &ldquo;{r.text}&rdquo;
              </p>
              {r.createdAt ? (
                <div className="mt-2 text-[10.5px] text-white/35">
                  {new Date(r.createdAt).toLocaleString()}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
