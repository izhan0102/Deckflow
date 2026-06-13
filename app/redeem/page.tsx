"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Check, Clock, Crown, Loader2, LogIn, MailWarning, ShieldAlert, Sparkles,
} from "lucide-react";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";
import { PLANS, PROMO_OFFER_END, isPromoOpen } from "@/lib/plans";

export const dynamic = "force-dynamic";

type Status =
  | "auth"        // resolving auth state
  | "needsLogin"  // not signed in
  | "needsVerify" // signed in, email not verified
  | "claiming"    // activating
  | "success"     // just activated
  | "already"     // already active on this account
  | "deviceUsed"  // another account used this device
  | "offerExpired"// promo window has closed
  | "error";

/** Persistent per-device id (RTDB-key-safe) used to enforce one account
 *  per device. Lives in localStorage so it survives refreshes. */
function getDeviceId(): string {
  const KEY = "exdeck_device_id";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      const raw =
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      id = raw.replace(/[^A-Za-z0-9_-]/g, "");
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "in one month";
  }
}

export default function RedeemPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("auth");
  const [user, setUser] = useState<AppUser | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const claimedRef = useRef(false);

  // Resolve auth, then auto-claim once.
  useEffect(() => {
    // Promo window closed — short-circuit before touching auth.
    if (!isPromoOpen()) { setStatus("offerExpired"); return; }
    const unsub = onAuthStateChange((u) => {
      setUser(u);
      if (!u) { setStatus("needsLogin"); return; }
      if (!u.emailVerified) { setStatus("needsVerify"); return; }
      if (claimedRef.current) return;
      claimedRef.current = true;
      void claim();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claim = async () => {
    setStatus("claiming");
    try {
      const token = await getIdToken(true);
      const res = await fetch("/api/claim-proplus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        setExpiresAt(typeof data.expiresAt === "number" ? data.expiresAt : null);
        setStatus(data.alreadyClaimed ? "already" : "success");
        return;
      }

      switch (data?.code) {
        case "device_used": setStatus("deviceUsed"); break;
        case "offer_expired": setStatus("offerExpired"); break;
        case "unverified":  setStatus("needsVerify"); break;
        case "unauthorized": setStatus("needsLogin"); break;
        default:
          setErrorMsg(data?.error || "Something went wrong activating Pro Plus.");
          setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Check your connection and try again.");
      setStatus("error");
    }
  };

  const retry = () => { claimedRef.current = true; void claim(); };

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: "var(--ezd-bg-page)" }}
    >
      <div aria-hidden className="landing-bg" />
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(34,211,238,0.20), transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 py-16">
        {/* Brand */}
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight text-white/70 transition hover:text-white">
          <Sparkles size={14} className="text-cyan-300" /> EXdeck
        </Link>

        <div className="w-full overflow-hidden rounded-3xl border border-white/12 bg-white/[0.03] shadow-[0_40px_120px_-50px_rgba(0,0,0,0.7)] backdrop-blur">
          {/* Header band */}
          <div
            className="relative px-7 pt-8 pb-7 text-center"
            style={{ background: "linear-gradient(180deg, rgba(34,211,238,0.12), transparent)" }}
          >
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
              <Crown size={26} />
            </div>
            {(status === "auth" || status === "needsLogin" || status === "needsVerify" || status === "claiming") && (
              <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-cyan-100">
                <Clock size={11} /> Free offer ends {fmtDate(PROMO_OFFER_END)}
              </div>
            )}
            <Content
              status={status}
              user={user}
              expiresAt={expiresAt}
              errorMsg={errorMsg}
            />
          </div>

          {/* Body */}
          <div className="px-7 pb-7">
            {(status === "success" || status === "already") && (
              <>
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {PLANS.proplus.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-[13px] text-white/75">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-cyan-300/15 text-cyan-200">
                        <Check size={11} />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/app"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-[15px] font-semibold text-black transition hover:bg-white/90"
                >
                  Start creating <ArrowRight size={16} />
                </Link>
              </>
            )}

            {status === "claiming" && (
              <div className="flex items-center justify-center gap-2 py-2 text-[13px] text-white/55">
                <Loader2 size={15} className="animate-spin" /> Activating your pass…
              </div>
            )}

            {status === "needsLogin" && (
              <button
                onClick={() => router.push("/auth?redirect=/redeem")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-[15px] font-semibold text-black transition hover:bg-white/90"
              >
                <LogIn size={16} /> Sign in to claim
              </button>
            )}

            {status === "needsVerify" && (
              <Link
                href="/verify-email?redirect=/redeem"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-[15px] font-semibold text-black transition hover:bg-white/90"
              >
                <MailWarning size={16} /> Verify your email
              </Link>
            )}

            {status === "deviceUsed" && (
              <Link
                href="/app"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-[14px] font-medium text-white transition hover:bg-white/10"
              >
                Go to the app <ArrowRight size={15} />
              </Link>
            )}

            {status === "offerExpired" && (
              <Link
                href="/app"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-[14px] font-medium text-white transition hover:bg-white/10"
              >
                Go to the app <ArrowRight size={15} />
              </Link>
            )}

            {status === "error" && (
              <button
                onClick={retry}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-[15px] font-semibold text-black transition hover:bg-white/90"
              >
                Try again
              </button>
            )}

            <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
              One activation per device. Free activation ends {fmtDate(PROMO_OFFER_END)} — once
              claimed, Pro Plus lasts 30 days, then your account returns to the free plan.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Content({
  status, user, expiresAt, errorMsg,
}: {
  status: Status;
  user: AppUser | null;
  expiresAt: number | null;
  errorMsg: string;
}) {
  switch (status) {
    case "auth":
    case "claiming":
      return (
        <>
          <H>Unlock Pro Plus</H>
          <P>Sit tight — setting up your free month of everything.</P>
        </>
      );
    case "needsLogin":
      return (
        <>
          <H>Claim your Pro Plus month</H>
          <P>Sign in with any account and we&rsquo;ll instantly unlock Pro Plus — free for 30 days.</P>
        </>
      );
    case "needsVerify":
      return (
        <>
          <H>Almost there</H>
          <P>Verify your email{user?.email ? ` (${user.email})` : ""} to activate your Pro Plus month.</P>
        </>
      );
    case "success":
      return (
        <>
          <Badge>Activated</Badge>
          <H>You&rsquo;re on Pro Plus 🎉</H>
          <P>
            Everything is unlocked{expiresAt ? <> until <span className="font-semibold text-white">{fmtDate(expiresAt)}</span></> : ""}. Enjoy the full studio.
          </P>
        </>
      );
    case "already":
      return (
        <>
          <Badge>Active</Badge>
          <H>Pro Plus is already on</H>
          <P>
            This account is active{expiresAt ? <> until <span className="font-semibold text-white">{fmtDate(expiresAt)}</span></> : ""}. You&rsquo;re all set.
          </P>
        </>
      );
    case "deviceUsed":
      return (
        <>
          <div className="mx-auto mb-1 -mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-200">
            <ShieldAlert size={11} /> Already used
          </div>
          <H>This device already claimed it</H>
          <P>Pro Plus can be activated once per device, and another account has already used this one.</P>
        </>
      );
    case "offerExpired":
      return (
        <>
          <div className="mx-auto mb-1 -mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-200">
            <Clock size={11} /> Offer ended
          </div>
          <H>This free offer has ended</H>
          <P>The contributor Pro Plus offer closed on {fmtDate(PROMO_OFFER_END)}. You can still use EXdeck on the free plan.</P>
        </>
      );
    case "error":
    default:
      return (
        <>
          <H>Couldn&rsquo;t activate</H>
          <P>{errorMsg || "Something went wrong. Please try again."}</P>
        </>
      );
  }
}

function H({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[24px] font-semibold tracking-tight text-white sm:text-[27px]">{children}</h1>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-white/60">{children}</p>;
}
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
      <Check size={11} /> {children}
    </div>
  );
}
