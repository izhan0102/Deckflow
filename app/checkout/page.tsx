"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check, Loader2, ArrowRight, ShieldCheck, X, PartyPopper,
  Globe, QrCode, AlertTriangle, RotateCw, RefreshCw,
} from "lucide-react";
import Logo from "@/components/Logo";
import { PRODUCTS, getProduct, normalizeProduct, type ProductId } from "@/lib/plans";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";
import { startSubscription, startTrial, razorpayConfigured, type BillingPeriod } from "@/lib/razorpay";

type Currency = "USD" | "INR";
const ACCENT = "var(--ezd-fg-strong)";
const ON_ACCENT = "var(--ezd-bg-page)"; // readable text on an accent (fg-strong) background
const sym = (c: Currency) => (c === "INR" ? "₹" : "$");
const fmt = (n: number, c: Currency) => {
  const s = sym(c);
  return Number.isInteger(n) ? `${s}${n}` : `${s}${(Math.round(n * 100) / 100).toFixed(2)}`;
};
const monthlyOf = (product: ProductId, c: Currency) => (c === "INR" ? PRODUCTS[product].inr : PRODUCTS[product].usd);

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const product = normalizeProduct(params.get("product") || params.get("plan"));
  const planDef = getProduct(product);
  const isPro = product === "pro";

  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [status, setStatus] = useState<{ trialUsed: boolean; alreadyPro: boolean } | null>(null);

  const [working, setWorking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const price = monthlyOf(product, currency);

  useEffect(() => {
    const unsub = onAuthStateChange((u) => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, []);

  // Look up whether the user already used their trial / is already Pro.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await getIdToken().catch(() => null);
        const res = await fetch("/api/manage-subscription", {
          method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
          body: JSON.stringify({ action: "status" }),
        });
        const d = await res.json().catch(() => ({}));
        if (!cancelled) setStatus(res.ok ? { trialUsed: !!d.trialUsed, alreadyPro: d.tier === "pro" } : { trialUsed: false, alreadyPro: false });
      } catch { if (!cancelled) setStatus({ trialUsed: false, alreadyPro: false }); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const go = async () => {
    if (!user) { router.push(`/auth?redirect=${encodeURIComponent(`/checkout?product=${product}`)}`); return; }
    if (!razorpayConfigured()) { setFailure("Payments aren't configured yet."); return; }
    setWorking(true);
    // Pro = autopay subscription with a 7-day trial for first-timers.
    // Team/Org = autopay subscription, pay now then recurs monthly (no trial).
    const r = isPro
      ? await startTrial({ currency, email: user.email })
      : await startSubscription({ product, currency, email: user.email });
    setWorking(false);
    if (r.ok) { setSuccess(true); return; }
    if (r.reason && r.reason !== "dismissed") setFailure(r.reason === "not_configured" ? "Payments aren't configured yet." : humanError(r.reason));
  };

  if (!authReady) return <Centered>Loading…</Centered>;
  if (!user) {
    return (
      <Centered>
        <div className="text-center">
          <p style={{ color: "var(--ezd-fg-muted)" }}>Sign in to continue to checkout.</p>
          <Link href={`/auth?redirect=${encodeURIComponent(`/checkout?product=${product}`)}`}
            className="mt-4 inline-flex rounded-full px-5 py-2 text-sm font-semibold"
            style={{ background: ACCENT, color: ON_ACCENT }}>Sign in</Link>
        </div>
      </Centered>
    );
  }

  const card = { background: "var(--ezd-bg-card)", borderColor: "var(--ezd-divider)" };
  const trialEligible = isPro && status !== null && !status.trialUsed;
  const alreadyPro = isPro && status?.alreadyPro;
  const loadingStatus = isPro && status === null;

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {success && <SuccessOverlay name={planDef.name} period="monthly" onClose={() => router.push("/app")} />}
      {failure && <FailureOverlay reason={failure} onRetry={() => setFailure(null)} onClose={() => router.push("/app")} />}

      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/app" className="text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>Back to app</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: plan + options */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>Checkout</p>
          <h1 className="mt-2 text-[30px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>
            {isPro ? "Go Pro" : `Get ${planDef.name}`}
          </h1>
          <p className="mt-2 text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>{planDef.tagline}</p>

          {/* Region / currency switch */}
          <div className="mt-6 rounded-2xl border p-1.5" style={card}>
            <div className="grid grid-cols-2 gap-1.5">
              <RegionTab active={currency === "USD"} onClick={() => setCurrency("USD")} icon={<Globe size={15} />} title="International" sub="Pay in USD" />
              <RegionTab active={currency === "INR"} onClick={() => setCurrency("INR")} icon={<QrCode size={15} />} title="I'm in India" sub="Pay in ₹ · UPI / QR" />
            </div>
          </div>
          {currency === "INR" && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ezd-fg-muted)" }}>
              <QrCode size={13} style={{ color: ACCENT }} /> Pay instantly with UPI AutoPay, cards, or net banking.
            </p>
          )}

          {/* What's included */}
          <ul className="mt-6 space-y-2.5">
            {planDef.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
                <Check size={16} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: summary */}
        <div className="lg:sticky lg:top-10 h-fit rounded-2xl border p-6" style={card}>
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Summary</h2>

          <div className="mt-4 flex items-end justify-between">
            <span className="text-[13.5px]" style={{ color: "var(--ezd-fg-muted)" }}>{planDef.name}</span>
            <span className="text-[26px] font-bold tabular-nums" style={{ color: "var(--ezd-fg-strong)" }}>
              {fmt(price, currency)}<span className="text-[13px] font-normal" style={{ color: "var(--ezd-fg-quiet)" }}> / month</span>
            </span>
          </div>

          {isPro ? (
            <div className="mt-3 rounded-lg border px-3 py-2 text-[12.5px]" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}>
              {trialEligible
                ? <>First <strong style={{ color: "var(--ezd-fg-strong)" }}>7 days free</strong>, then {fmt(price, currency)}/month on <strong style={{ color: "var(--ezd-fg-strong)" }}>autopay</strong>. Cancel anytime — here or from your UPI app.</>
                : <>Billed {fmt(price, currency)}/month on <strong style={{ color: "var(--ezd-fg-strong)" }}>autopay</strong> until you cancel. Cancel anytime — here or from your UPI app.</>}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border px-3 py-2 text-[12.5px]" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}>
              Billed {fmt(price, currency)}/month on <strong style={{ color: "var(--ezd-fg-strong)" }}>autopay</strong> from today (no free trial), up to {PRODUCTS[product].seats} members. Cancel anytime.
            </div>
          )}

          <div className="my-4 h-px" style={{ background: "var(--ezd-divider)" }} />

          {alreadyPro ? (
            <div className="text-center">
              <p className="text-[13.5px]" style={{ color: "var(--ezd-fg-strong)" }}>You&rsquo;re already on Pro.</p>
              <Link href="/app/billing" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold" style={{ background: ACCENT, color: ON_ACCENT }}>Manage plan</Link>
            </div>
          ) : (
            <button
              onClick={go}
              disabled={working || loadingStatus}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition hover:opacity-90 disabled:opacity-60"
              style={{ background: ACCENT, color: ON_ACCENT }}
            >
              {working ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                : loadingStatus ? <><Loader2 size={16} className="animate-spin" /> Loading…</>
                : isPro ? (trialEligible ? <>Start 7-day free trial <ArrowRight size={16} /></> : <>Subscribe — {fmt(price, currency)}/mo <ArrowRight size={16} /></>)
                : <>Get {planDef.name} — {fmt(price, currency)}/mo <ArrowRight size={16} /></>}
            </button>
          )}

          {!alreadyPro && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
              <RefreshCw size={11} /> Auto-renews monthly · cancel anytime
            </p>
          )}
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
            <ShieldCheck size={12} /> Secure payment via Razorpay
          </p>
        </div>
      </div>
    </main>
  );
}

function humanError(reason: string): string {
  if (reason === "not_configured") return "Payments aren't configured yet.";
  if (reason === "order_failed") return "Couldn't start the payment. Please try again.";
  if (reason === "verify_failed") return "We couldn't verify the payment. If you were charged, contact support and we'll sort it out.";
  return "The payment didn't go through. Please try again.";
}

function RegionTab({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition"
      style={active ? { background: ACCENT, color: ON_ACCENT } : { color: "var(--ezd-fg-muted)" }}>
      <span style={{ color: active ? ON_ACCENT : ACCENT }}>{icon}</span>
      <span>
        <span className="block text-[13px] font-semibold" style={{ color: active ? ON_ACCENT : "var(--ezd-fg-strong)" }}>{title}</span>
        <span className="block text-[11px]" style={{ color: active ? ON_ACCENT : "var(--ezd-fg-quiet)", opacity: active ? 0.8 : 1 }}>{sub}</span>
      </span>
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center text-sm" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)" }}>{children}</main>;
}

/* ----------------------------- success screen ----------------------------- */

function SuccessOverlay({ name, period, onClose }: { name: string; period: BillingPeriod; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center px-6" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <style>{overlayCss}</style>
      <div className="ov-glow" style={{ ["--g" as any]: "rgba(127,127,127,0.18)" }} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (<span key={i} className="ov-confetti" style={{ left: `${c.x}%`, background: c.col, animationDelay: `${c.d}s`, animationDuration: `${c.dur}s` }} />))}
      </div>
      <div className="ov-pop relative w-full max-w-md rounded-3xl border p-8 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <span className="ov-ring" style={{ borderColor: ACCENT }} />
          <span className="ov-ring ov-ring2" style={{ borderColor: ACCENT }} />
          <span className="ov-badge grid h-[68px] w-[68px] place-items-center rounded-full" style={{ background: ACCENT, ["--sh" as any]: ACCENT }}>
            <Check size={38} strokeWidth={3} color="var(--ezd-bg-page)" className="ov-icon" />
          </span>
        </div>
        <div className="ov-l1 mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
          <PartyPopper size={14} /> Payment successful
        </div>
        <h2 className="ov-l2 mt-2 text-[27px] font-extrabold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>You&rsquo;re on {name}!</h2>
        <p className="ov-l3 mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Welcome to EXdeck {name}. Your {period === "annual" ? "annual" : "monthly"} plan is active and everything&rsquo;s unlocked. Go build something great.
        </p>
        <button onClick={onClose} className="ov-l4 mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition hover:opacity-90" style={{ background: ACCENT, color: ON_ACCENT }}>
          Start creating <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- failure screen ----------------------------- */

const RED = "#ef4444";
function FailureOverlay({ reason, onRetry, onClose }: { reason: string; onRetry: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center px-6" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <style>{overlayCss}</style>
      <div className="ov-glow" style={{ ["--g" as any]: "rgba(239,68,68,0.28)" }} />
      <div className="ov-pop relative w-full max-w-md rounded-3xl border p-8 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <span className="ov-ring" style={{ borderColor: RED }} />
          <span className="ov-badge ov-shake grid h-[68px] w-[68px] place-items-center rounded-full" style={{ background: RED, ["--sh" as any]: RED }}>
            <X size={40} strokeWidth={3} color="#ffffff" className="ov-icon" />
          </span>
        </div>
        <div className="ov-l1 mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: RED }}>
          <AlertTriangle size={14} /> Payment failed
        </div>
        <h2 className="ov-l2 mt-2 text-[24px] font-extrabold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>That didn&rsquo;t go through</h2>
        <p className="ov-l3 mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{reason}</p>
        <div className="ov-l4 mt-6 flex gap-2.5">
          <button onClick={onClose} className="flex-1 rounded-xl border px-5 py-3 text-[14px] font-semibold" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}>Cancel</button>
          <button onClick={onRetry} className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition hover:opacity-90" style={{ background: ACCENT, color: ON_ACCENT }}>
            <RotateCw size={15} /> Try again
          </button>
        </div>
      </div>
    </div>
  );
}

const CONFETTI = Array.from({ length: 44 }, (_, i) => ({
  x: (i * 0.0773 * 100) % 100,
  d: (i % 11) * 0.06,
  dur: 1.6 + (i % 5) * 0.25,
  col: ["#7C5CFF", "#22D3EE", "#F472B6", "#34D399", "#FBBF24", "#FB7185"][i % 6],
}));

const overlayCss = `
.ov-glow{position:absolute;inset:0;background:radial-gradient(45% 40% at 50% 32%, var(--g), transparent 70%);animation:ov-glow 2.6s ease-in-out infinite}
.ov-pop{animation:ov-pop .55s cubic-bezier(.18,.89,.32,1.28) both}
.ov-badge{position:relative;z-index:2;animation:ov-badge .6s .05s cubic-bezier(.18,.89,.32,1.28) both;box-shadow:0 14px 44px -10px var(--sh)}
.ov-shake{animation:ov-badge .6s .05s cubic-bezier(.18,.89,.32,1.28) both, ov-shake .5s .65s both}
.ov-icon{animation:ov-icon .4s .42s both}
.ov-ring{position:absolute;inset:0;border-radius:9999px;border:2px solid;opacity:0;animation:ov-ring 1.5s .2s ease-out infinite}
.ov-ring2{animation-delay:.9s}
.ov-l1{opacity:0;animation:ov-up .5s .35s both}
.ov-l2{opacity:0;animation:ov-up .5s .45s both}
.ov-l3{opacity:0;animation:ov-up .5s .55s both}
.ov-l4{opacity:0;animation:ov-up .5s .65s both}
.ov-confetti{position:absolute;top:-16px;width:9px;height:15px;border-radius:2px;opacity:0;animation-name:ov-fall;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
@keyframes ov-pop{0%{opacity:0;transform:scale(.9) translateY(14px)}100%{opacity:1;transform:none}}
@keyframes ov-badge{0%{transform:scale(0) rotate(-45deg)}60%{transform:scale(1.12) rotate(6deg)}100%{transform:scale(1) rotate(0)}}
@keyframes ov-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes ov-icon{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes ov-ring{0%{opacity:.7;transform:scale(.7)}100%{opacity:0;transform:scale(1.7)}}
@keyframes ov-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ov-glow{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes ov-fall{0%{opacity:0;transform:translateY(0) rotateZ(0)}8%{opacity:1}100%{opacity:0;transform:translateY(105vh) rotateZ(720deg)}}
@media (prefers-reduced-motion: reduce){.ov-pop,.ov-badge,.ov-shake,.ov-icon,.ov-ring,.ov-l1,.ov-l2,.ov-l3,.ov-l4,.ov-confetti,.ov-glow{animation:none!important;opacity:1!important}}
`;

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <CheckoutInner />
    </Suspense>
  );
}
