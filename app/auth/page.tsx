"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  loginWithEmail, signupWithEmail, loginWithGoogle, onAuthStateChange,
  UnverifiedEmailError,
} from "@/lib/auth";
import { trackEvent } from "@/lib/stats";
import {
  ArrowRight, Check, ChevronDown, Eye, EyeOff, Loader2, Lock, Mail, Sparkles, User,
} from "lucide-react";
import Logo from "@/components/Logo";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-black text-sm text-white/60">
          Loading…
        </main>
      }
    >
      <AuthInner />
    </Suspense>
  );
}

/* ------------------------------- Page shell ------------------------------- */

function AuthInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/app";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showEmail, setShowEmail] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"none" | "email" | "google">("none");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent({ kind: "page_view", path: "/auth", ts: Date.now() });
    const unsubscribe = onAuthStateChange((u) => {
      if (!u) return;
      if (!u.emailVerified) {
        // Already signed in but unverified — bounce them to the
        // verification page rather than the gated route.
        router.replace(`/verify-email?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      router.replace(redirect);
    });
    return () => unsubscribe();
  }, [router, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("email");
    setError(null);
    try {
      const u = mode === "login"
        ? await loginWithEmail(email, password)
        : await signupWithEmail(name, email, password);
      trackEvent({
        kind: "auth",
        method: mode === "signup" ? "signup" : "email",
        ts: Date.now(),
        uid: u.uid,
      });
      router.replace(redirect);
    } catch (err: any) {
      if (err instanceof UnverifiedEmailError) {
        // Hand off to the verify-email page. Fire a tracking event
        // so the funnel reflects that signup succeeded — they just
        // haven't clicked the link yet.
        trackEvent({
          kind: "auth",
          method: mode === "signup" ? "signup" : "email",
          ts: Date.now(),
        });
        router.replace(`/verify-email?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      setError(err?.message || "Could not authenticate.");
    } finally {
      setLoading("none");
    }
  };

  const google = async () => {
    setLoading("google");
    setError(null);
    try {
      const u = await loginWithGoogle();
      trackEvent({ kind: "auth", method: "google", ts: Date.now(), uid: u.uid });
      router.replace(redirect);
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
    } finally {
      setLoading("none");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Soft brand glow shared across both panes */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(55% 45% at 25% 25%, rgba(34,211,238,0.18), transparent 70%), radial-gradient(45% 38% at 85% 85%, rgba(14,116,144,0.32), transparent 70%)",
        }}
      />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* ========== LEFT: auth controls ========== */}
        <section className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-14">
          {/* Top: brand + (mobile) toggle to right pane */}
          <div className="flex items-center justify-between">
            <Logo size="md" />
          </div>

          {/* Center: auth panel */}
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-sm">
              <div className="mb-7 text-center">
                <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-[34px]">
                  Your ideas,
                  <br />
                  perfectly presented.
                </h1>
                <p className="mt-3 text-sm text-white/55">
                  {mode === "login"
                    ? "Sign in or create your free account below."
                    : "Create your free account or sign in below."}
                </p>
              </div>

              {/* Primary actions */}
              <button
                onClick={google}
                disabled={loading !== "none"}
                className="mb-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {loading === "google" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <GoogleMark />
                )}
                Continue with Google
              </button>

              <button
                onClick={() => setShowEmail((v) => !v)}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              >
                <Mail size={14} />
                Continue with Email
              </button>

              {/* Toggle mode */}
              <div className="mt-3 text-center">
                <button
                  onClick={() => setShowEmail((v) => !v)}
                  className="inline-flex items-center gap-1 text-[12px] text-white/50 transition hover:text-white/85"
                >
                  Show other options
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${showEmail ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {/* Email form (collapsible) */}
              {showEmail && (
                <form
                  onSubmit={submit}
                  className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
                      {mode === "login" ? "Sign in with email" : "Create your account"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMode(mode === "login" ? "signup" : "login")}
                      className="text-[11px] text-white/55 hover:text-white/85"
                    >
                      {mode === "login" ? "Need an account?" : "Have an account?"}
                    </button>
                  </div>

                  {mode === "signup" && (
                    <Field
                      icon={<User size={14} />}
                      value={name}
                      onChange={setName}
                      placeholder="Your name"
                      autoComplete="name"
                      required
                    />
                  )}
                  <Field
                    icon={<Mail size={14} />}
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    required
                  />
                  <Field
                    icon={<Lock size={14} />}
                    value={password}
                    onChange={setPassword}
                    placeholder="At least 6 characters"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />

                  {error && (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading !== "none"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60"
                  >
                    {loading === "email" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        {mode === "login" ? "Sign in" : "Create account"}
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Footer: legal */}
          <div className="text-center">
            <p className="text-[11px] text-white/35">
              By continuing you agree to EZdeck's{" "}
              <Link href="/terms" className="underline-offset-2 hover:text-white/70 hover:underline">terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="underline-offset-2 hover:text-white/70 hover:underline">privacy policy</Link>.
            </p>
          </div>
        </section>

        {/* ========== RIGHT: brand panel ========== */}
        <aside className="relative hidden min-h-screen flex-col justify-center overflow-hidden border-l border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-950 to-black px-12 lg:flex">
          {/* Subtle decorations */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"
          />

          <div className="relative max-w-md">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              <Sparkles size={11} className="text-cyan-300" />
              Open source · free to try
            </div>

            <h2 className="text-[26px] font-semibold leading-tight tracking-tight text-white">
              Presentations that drive decisions.
            </h2>

            <ul className="mt-7 space-y-5 text-sm">
              <Bullet
                title="Decks in minutes, not days"
                body="Start with an idea or a brief. AI handles writing, layout, and styling so you can focus on the message."
              />
              <Bullet
                title="Look professional without a designer"
                body="36 designed templates and live style variants per layout. Edit anything inline once it's made."
              />
              <Bullet
                title="Stay on brand, every slide"
                body="Pick a theme, font, and graphic — every slide inherits them. Switch themes in one click after generation."
              />
              <Bullet
                title="Real PowerPoint and PDF export"
                body="Editable .pptx for PowerPoint, Keynote, Google Slides. High-res PDF for sharing. No lock-in."
              />
              <Bullet
                title="Auto-saved and shareable"
                body="Every deck is saved to your account. One-click public share links so anyone can view."
              />
            </ul>

            <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-[12px] text-white/65">
                Built and shipped by an indie developer. ₹15 per deck unlocks
                .pptx and .pdf — no subscriptions, no hidden fees.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* --------------------------- subcomponents ---------------------------- */

function Field({
  icon, value, onChange, placeholder, type = "text", autoComplete, required,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  // Password fields get a reveal toggle. When `type` is "password" we
  // track a local visibility flag and swap the input type between
  // "password" and "text", with an Eye / EyeOff button on the right.
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);
  const effectiveType = isPassword && revealed ? "text" : type;

  return (
    <label className="block">
      <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 transition focus-within:border-white/30">
        <span className="text-white/40">{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={effectiveType}
          autoComplete={autoComplete}
          required={required}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            tabIndex={-1}
            aria-label={revealed ? "Hide password" : "Show password"}
            title={revealed ? "Hide password" : "Show password"}
            className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white/80"
          >
            {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </span>
    </label>
  );
}

function Bullet({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
        <Check size={11} strokeWidth={3} />
      </span>
      <div>
        <div className="text-[14px] font-semibold text-white">{title}</div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-white/55">{body}</p>
      </div>
    </li>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.71H.92v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.71A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.71V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.04l3.03-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57C13.46.92 11.43 0 9 0A9 9 0 0 0 .92 4.96l3.03 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}
