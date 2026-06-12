"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Star } from "lucide-react";
import Logo from "@/components/Logo";
import { submitReview, REVIEW_LIMITS } from "@/lib/reviews";

/**
 * Public feedback form. No auth. Submissions land in RTDB /reviews and the
 * owner hand-picks which show in the landing hero (via /reviews viewer).
 */
export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setState("saving");
    try {
      await submitReview({ name, role, rating, text });
      setState("done");
    } catch (e: any) {
      setError(e?.message || "Couldn't submit. Try again.");
      setState("idle");
    }
  };

  const shown = hover || rating;

  return (
    <main
      className="relative min-h-screen"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}
    >
      <div aria-hidden className="landing-bg" />

      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
          <Logo size="sm" href="/" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white">
            <ArrowLeft size={12} /> Back to home
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-2xl px-6 pb-24 pt-12 sm:pt-16">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
          Feedback
        </div>
        <h1
          className="mt-3 font-semibold text-white"
          style={{
            fontFamily: '"Fredoka", ui-rounded, "Segoe UI", system-ui, sans-serif',
            fontWeight: 600,
            fontSize: "clamp(30px, 5vw, 44px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          Tell us what you think
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/55">
          Tried EXdeck? Drop an honest review. The good ones get featured on
          the homepage with your name and what you do.
        </p>

        {state === "done" ? (
          <div className="mt-10 rounded-2xl border border-white/15 bg-white/[0.03] p-8 text-center">
            <div
              className="mx-auto grid h-12 w-12 place-items-center rounded-full"
              style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
            >
              <Check size={22} />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold text-white">Thank you, truly.</h2>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-white/55">
              Your review is in. If it&rsquo;s featured, you&rsquo;ll spot your name
              on the homepage. This kind of feedback keeps EXdeck improving.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2.5">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition hover:bg-white/90"
              >
                Back to home
              </Link>
              <button
                onClick={() => {
                  setName(""); setRole(""); setRating(5); setText(""); setState("idle");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/85 transition hover:bg-white/10"
              >
                Submit another
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-9 space-y-5 rounded-2xl border border-white/15 bg-white/[0.02] p-5 sm:p-6">
            {/* Name + role */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Your name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, REVIEW_LIMITS.name))}
                  placeholder="e.g. Aarav Mehta"
                  className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-white/30"
                />
              </Field>
              <Field label="What you do">
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value.slice(0, REVIEW_LIMITS.role))}
                  placeholder="e.g. Product designer, Student"
                  className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-white/30"
                />
              </Field>
            </div>

            {/* Rating */}
            <Field label="Rating">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHover(n)}
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        size={26}
                        className="transition"
                        style={{
                          fill: n <= shown ? "var(--ezd-fg-strong)" : "transparent",
                          color: n <= shown ? "var(--ezd-fg-strong)" : "var(--ezd-divider)",
                        }}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-[13px] tabular-nums text-white/60">{shown} / 5</span>
              </div>
            </Field>

            {/* Description */}
            <Field label="Your review">
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, REVIEW_LIMITS.text))}
                  placeholder="A line or two about your experience — the UI, speed, workflow, whatever stood out."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/12 bg-black/40 p-3 pb-7 text-sm leading-relaxed outline-none placeholder:text-white/30 focus:border-white/30"
                />
                <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-white/35">
                  {text.length}/{REVIEW_LIMITS.text}
                </span>
              </div>
            </Field>

            {error && <p className="text-[12.5px] text-red-300">{error}</p>}

            <button
              onClick={submit}
              disabled={state === "saving"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "saving" ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
              {state === "saving" ? "Submitting…" : "Submit review"}
            </button>
            <p className="text-center text-[11px] text-white/35">
              No account needed. We may feature your review on the homepage.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-white/45">
        {label}
      </label>
      {children}
    </div>
  );
}
