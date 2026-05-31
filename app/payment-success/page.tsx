"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { onAuthStateChange, type AppUser } from "@/lib/auth";
import { markDeckPaid } from "@/lib/decks";

/**
 * Razorpay redirects here after a successful Payment Page checkout.
 * The redirect itself is our proof of payment — Razorpay only sends
 * users here when the transaction completed.
 *
 * Flow:
 *   1. Read pending deck id from localStorage (set by PaymentDialog).
 *   2. Wait for the auth listener to settle.
 *   3. Flip `decks/{uid}/{deckId}/deck.paid` in Firebase.
 *   4. Bounce back to /app?id={deckId} where the PPTX download is now
 *      unlocked because the live `paid` flag is true.
 */

const STORAGE_KEY = "deckflow_pending_paid_deck_id";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={
      <main className="grid min-h-screen place-items-center bg-black text-sm text-white/60">
        Loading…
      </main>
    }>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState<"verifying" | "success" | "missing-deck" | "error">("verifying");
  const [errMsg, setErrMsg] = useState("");
  const [deckId, setDeckId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      // Not signed in — push them to sign-in with a return-to back here.
      router.replace("/auth?redirect=/payment-success");
      return;
    }
    if (!user.emailVerified) {
      // Verified email is required before any deck operation.
      router.replace(`/verify-email?redirect=${encodeURIComponent("/payment-success")}`);
      return;
    }
    let id: string | null = null;
    try { id = window.localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (!id) {
      setStatus("missing-deck");
      return;
    }
    setDeckId(id);
    (async () => {
      try {
        await markDeckPaid(user.uid, id!);
        try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        setStatus("success");
        // Brief delay so the user sees the confirmation before bouncing.
        window.setTimeout(() => {
          router.replace(`/app?id=${id}`);
        }, 1400);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error("[payment-success] markDeckPaid failed:", e);
        setErrMsg(e?.message || "We couldn't unlock the deck. Please contact support.");
        setStatus("error");
      }
    })();
  }, [authReady, user, router]);

  return (
    <main
      className="grid min-h-screen place-items-center px-4"
      style={{
        background:
          "radial-gradient(60% 50% at 50% 30%, rgba(255,255,255,0.05), transparent 70%), var(--ezd-bg-page)",
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-7 text-center shadow-2xl">
        {status === "verifying" && (
          <>
            <Loader2 size={32} className="mx-auto mb-4 animate-spin text-cyan-300" />
            <h1 className="text-xl font-semibold text-white">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-white/60">
              Just a moment. We're unlocking your deck.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 size={36} className="mx-auto mb-4 text-emerald-300" />
            <h1 className="text-xl font-semibold text-white">Payment received</h1>
            <p className="mt-2 text-sm text-white/65">
              Your deck is unlocked. Redirecting you back now…
            </p>
            <Link
              href={deckId ? `/app?id=${deckId}` : "/app/decks"}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Open my deck
            </Link>
          </>
        )}

        {status === "missing-deck" && (
          <>
            <h1 className="text-xl font-semibold text-white">Payment received, but…</h1>
            <p className="mt-2 text-sm text-white/65">
              We couldn't tell which deck this payment was for. This usually
              happens if you started the payment in another browser or cleared
              site data. Open your decks below and we'll help you sort it out.
            </p>
            <Link
              href="/app/decks"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              View my decks
            </Link>
            <p className="mt-3 text-[11px] text-white/45">
              Need help? Email mohammadizhan710@gmail.com with your payment id.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
            <p className="mt-2 text-sm text-white/65">{errMsg}</p>
            <Link
              href="/app/decks"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Go to my decks
            </Link>
            <p className="mt-3 text-[11px] text-white/45">
              Email mohammadizhan710@gmail.com with your payment id and we'll fix it.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
