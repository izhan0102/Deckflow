"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail, RefreshCw, LogOut } from "lucide-react";
import {
  logout, onAuthStateChange, reloadUser, resendVerificationEmail,
  type AppUser,
} from "@/lib/auth";
import Logo from "@/components/Logo";

/**
 * Email verification gate.
 *
 * Where the user lands after signup or after trying to sign in
 * unverified. Shows their email, a resend button, a "I've verified"
 * button (which calls reloadUser and bounces them to the redirect),
 * and an automatic poller that runs every 4 seconds — when Firebase
 * reports the email as verified, we redirect immediately.
 *
 * Read more about Firebase verification here:
 * https://firebase.google.com/docs/auth/web/manage-users#send_a_user_a_verification_email
 */

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <main className="grid min-h-screen place-items-center text-sm text-white/60"
        style={{ background: "var(--ezd-bg-page)" }}>
        Loading…
      </main>
    }>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/app";

  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Subscribe to auth changes. If a user is signed in and verified,
  // bounce them to the redirect. If signed out, send them to /auth.
  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        router.replace(`/auth?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      if (u.emailVerified) {
        setVerified(true);
        // Brief moment to show the success state before redirecting.
        window.setTimeout(() => router.replace(redirect), 900);
      }
    });
    return () => unsub();
  }, [router, redirect]);

  // Poll: every 4s, reload the user so we catch the verified state
  // quickly after the user clicks the link in their email. Stop
  // polling once verified, on unmount, or when the tab is hidden.
  useEffect(() => {
    if (!user || verified) return;
    const tick = async () => {
      try {
        const updated = await reloadUser();
        if (updated?.emailVerified) {
          setVerified(true);
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          window.setTimeout(() => router.replace(redirect), 700);
        }
      } catch { /* network blip — try again next tick */ }
    };
    const id = window.setInterval(tick, 4000);
    pollRef.current = id;
    // Immediate check too, in case the user just came back via the link.
    tick();
    return () => window.clearInterval(id);
  }, [user, verified, router, redirect]);

  const onResend = async () => {
    setResending(true);
    setError(null);
    try {
      await resendVerificationEmail();
      setResentAt(Date.now());
    } catch (e: any) {
      // Firebase returns "auth/too-many-requests" if mashed; surface a
      // friendly message but log the raw error for diagnosis.
      // eslint-disable-next-line no-console
      console.warn("[verify-email] resend failed:", e);
      const msg = e?.code === "auth/too-many-requests"
        ? "Too many resend attempts. Wait a few minutes and try again."
        : (e?.message || "Could not send the verification email.");
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  const onSignOut = async () => {
    await logout();
    router.replace("/");
  };
  const onUseDifferentAccount = async () => {
    await logout();
    router.replace("/auth");
  };

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-white/60"
        style={{ background: "var(--ezd-bg-page)" }}>
        Loading…
      </main>
    );
  }

  return (
    <main
      className="relative grid min-h-screen place-items-center px-6 text-white"
      style={{
        background:
          "radial-gradient(55% 45% at 25% 25%, rgba(255,255,255,0.05), transparent 70%), var(--ezd-bg-page)",
      }}
    >
      <header className="absolute inset-x-0 top-0 mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Logo size="sm" />
        <button
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/75 transition hover:bg-white/10"
        >
          <LogOut size={11} /> Sign out
        </button>
      </header>

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8 text-center backdrop-blur">
        {verified ? <SuccessCard /> : (
          <PendingCard
            email={user?.email || ""}
            onResend={onResend}
            resending={resending}
            resentAt={resentAt}
            error={error}
            onUseDifferentAccount={onUseDifferentAccount}
          />
        )}
      </div>
    </main>
  );
}

function SuccessCard() {
  return (
    <>
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
        <CheckCircle2 size={22} />
      </div>
      <h1 className="text-xl font-semibold text-white">Email verified</h1>
      <p className="mt-2 text-sm text-white/65">
        You&rsquo;re in. Redirecting now…
      </p>
    </>
  );
}

function PendingCard({
  email,
  onResend,
  resending,
  resentAt,
  error,
  onUseDifferentAccount,
}: {
  email: string;
  onResend: () => void;
  resending: boolean;
  resentAt: number | null;
  error: string | null;
  onUseDifferentAccount: () => void;
}) {
  return (
    <>
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
        <Mail size={20} />
      </div>
      <h1 className="text-xl font-semibold text-white">Check your email</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">
        We sent a verification link to{" "}
        <span className="font-semibold text-white">{email || "your inbox"}</span>.
        Click the link to activate your account.
      </p>
      <p className="mt-1 text-[12px] text-white/45">
        This page will redirect automatically once you verify.
        It can take up to a minute for new emails to arrive.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[12px] text-red-200">
          {error}
        </div>
      )}

      {resentAt && !error && (
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-[12px] text-emerald-200">
          Sent again — keep an eye on your inbox (and spam folder).
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <button
          onClick={onResend}
          disabled={resending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#03070F] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {resending ? "Sending…" : "Resend verification email"}
        </button>
        <p className="mt-2 text-[11px] text-white/40">
          Wrong inbox?{" "}
          <button
            type="button"
            onClick={onUseDifferentAccount}
            className="text-white/70 underline-offset-4 hover:underline"
          >
            Sign in with a different account
          </button>
        </p>
      </div>
    </>
  );
}
