"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  loginWithEmail, signupWithEmail, loginWithGoogle, onAuthStateChange,
} from "@/lib/auth";
import { trackEvent } from "@/lib/stats";
import { ArrowRight, Loader2, Mail, Lock, User } from "lucide-react";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-black text-white/60 text-sm">
          Loading…
        </main>
      }
    >
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/app";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"none" | "email" | "google">("none");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent({ kind: "page_view", path: "/auth", ts: Date.now() });
    // If a session is already restored, bounce to redirect.
    const unsubscribe = onAuthStateChange((u) => {
      if (u) router.replace(redirect);
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
      trackEvent({ kind: "auth", method: mode === "signup" ? "signup" : "email", ts: Date.now(), uid: u.uid });
      router.replace(redirect);
    } catch (err: any) {
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
      <div
        aria-hidden
        className="absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(124,92,255,0.25), transparent 70%), radial-gradient(40% 35% at 80% 80%, rgba(34,197,94,0.12), transparent 70%)",
        }}
      />
      <header className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <Link href="/" className="font-semibold tracking-tight">
          <span className="border-b-2 border-white pb-0.5">DeckFlow</span>
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-md px-6 pb-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur">
          <div className="mb-5 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              {mode === "login" ? "Sign in to keep editing your decks." : "It takes 10 seconds."}
            </p>
          </div>

          <button
            onClick={google}
            disabled={loading !== "none"}
            className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
          >
            {loading === "google" ? <Loader2 size={16} className="animate-spin" /> : <GoogleMark />}
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/40">
            <span className="h-px flex-1 bg-white/10" />
            <span>or {mode === "login" ? "sign in" : "sign up"} with email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <Field
                label="Name"
                icon={<User size={14} />}
                value={name}
                onChange={setName}
                placeholder="Jane Doe"
                autoComplete="name"
                required
              />
            )}
            <Field
              label="Email"
              icon={<Mail size={14} />}
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
            />
            <Field
              label="Password"
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

          <div className="mt-5 text-center text-xs text-white/55">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-white underline-offset-2 hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have one?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-white underline-offset-2 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/35">
          By continuing you agree to DeckFlow's terms of use.
        </p>
      </section>
    </main>
  );
}

function Field({
  label, icon, value, onChange, placeholder, type = "text", autoComplete, required,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-white/45">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 focus-within:border-white/30">
        <span className="text-white/40">{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          autoComplete={autoComplete}
          required={required}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
        />
      </span>
    </label>
  );
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.71H.92v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.71A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.71V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.04l3.03-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57C13.46.92 11.43 0 9 0A9 9 0 0 0 .92 4.96l3.03 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}
