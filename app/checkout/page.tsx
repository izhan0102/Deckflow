"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check, Sparkles, Tag, Loader2, ArrowRight, ShieldCheck, X, PartyPopper,
} from "lucide-react";
import Logo from "@/components/Logo";
import { PLANS, normalizePlan, type PlanId } from "@/lib/plans";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";
import { startCheckout, razorpayConfigured, type BillingPeriod } from "@/lib/razorpay";

const ANNUAL_DISCOUNT = 0.10;
const ACCENT = "#7C5CFF";
const fmt = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = (normalizePlan(params.get("plan")) === "proplus" ? "proplus" : "pro") as PlanId;
  const planDef = PLANS[plan];

  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const [quote, setQuote] = useState<{ base: number; final: number; discountPct: number; free: boolean }>({
    base: planDef.price, final: planDef.price, discountPct: 0, free: false,
  });

  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auth gate (allow anonymous to view, require sign-in to pay).
  useEffect(() => {
    const unsub = onAuthStateChange((u) => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, []);

  // Authoritative quote from the server whenever plan/period/coupon change.
  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const token = await getIdToken().catch(() => null);
        const res = await fetch("/api/coupon-check", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ plan, period, coupon: appliedCoupon || "" }),
        });
        const d = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setQuote({ base: d.baseAmount, final: d.finalAmount, discountPct: d.discountPct, free: !!d.free });
          if (appliedCoupon) {
            if (d.couponError === "limit") setCouponMsg({ kind: "err", text: "This code has reached its limit." });
            else if (d.couponError === "invalid") setCouponMsg({ kind: "err", text: "Invalid or expired code." });
            else if (d.free) setCouponMsg({ kind: "ok", text: "Free access applied!" });
            else if (d.couponValid) setCouponMsg({ kind: "ok", text: `${d.discountPct}% off applied!` });
          }
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, user, plan, period, appliedCoupon]);

  const monthlyEquivalent = useMemo(
    () => (period === "annual" ? quote.final / 12 : quote.final),
    [period, quote.final],
  );

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponMsg(null);
    setAppliedCoupon(code);
  };
  const clearCoupon = () => { setAppliedCoupon(""); setCouponInput(""); setCouponMsg(null); };

  const pay = async () => {
    if (!user) { router.push(`/auth?redirect=${encodeURIComponent(`/checkout?plan=${plan}`)}`); return; }
    if (!razorpayConfigured()) { setError("Payments aren't configured yet."); return; }
    setPaying(true); setError(null);
    const r = await startCheckout({ plan, period, coupon: appliedCoupon || undefined, email: user.email });
    setPaying(false);
    if (r.ok) { setSuccess(true); return; }
    if (r.reason && r.reason !== "dismissed") setError(humanError(r.reason));
  };

  if (!authReady) {
    return <Centered>Loading…</Centered>;
  }
  if (!user) {
    return (
      <Centered>
        <div className="text-center">
          <p className="text-white/70">Sign in to continue to checkout.</p>
          <Link href={`/auth?redirect=${encodeURIComponent(`/checkout?plan=${plan}`)}`}
            className="mt-4 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
            Sign in
          </Link>
        </div>
      </Centered>
    );
  }

  return (
    <main className="min-h-screen text-white" style={{ background: "var(--ezd-bg-page)" }}>
      {success && <SuccessOverlay plan={plan} period={period} onClose={() => router.push("/app")} />}

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/app" className="text-[13px] text-white/55 hover:text-white">Back to app</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: plan + options */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>Checkout</p>
          <h1 className="mt-2 text-[30px] font-bold tracking-tight">Upgrade to {planDef.name}</h1>
          <p className="mt-2 text-[14px] text-white/60">{planDef.tagline}</p>

          {/* Period toggle */}
          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
            <PeriodTab active={period === "monthly"} onClick={() => setPeriod("monthly")} title="Monthly" sub="Billed monthly" />
            <PeriodTab active={period === "annual"} onClick={() => setPeriod("annual")} title="Annual" sub="Save 10%" badge />
          </div>

          {/* What's included */}
          <ul className="mt-6 space-y-2.5">
            {planDef.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-white/75">
                <Check size={16} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          {/* Coupon */}
          <div className="mt-7">
            <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-white/55">
              <Tag size={12} /> Have a coupon?
            </label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                <span className="font-mono text-[13px] text-white">{appliedCoupon}</span>
                <button onClick={clearCoupon} className="text-white/45 hover:text-white" aria-label="Remove coupon"><X size={15} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                  placeholder="ENTER CODE"
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 font-mono text-[13px] tracking-wide text-white outline-none placeholder:text-white/30"
                />
                <button onClick={applyCoupon}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 text-[13px] font-semibold text-white transition hover:bg-white/10">
                  Apply
                </button>
              </div>
            )}
            {couponMsg && (
              <p className={`mt-1.5 text-[12px] ${couponMsg.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
                {couponMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* Right: summary */}
        <div className="lg:sticky lg:top-10 h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-[15px] font-semibold">Order summary</h2>
          <div className="mt-4 space-y-2.5 text-[13.5px]">
            <Row label={`${planDef.name} · ${period === "annual" ? "Annual" : "Monthly"}`} value={fmt(quote.base)} />
            {period === "annual" && (
              <Row label="Annual discount (10%)" value="included" muted />
            )}
            {quote.discountPct > 0 && (
              <Row label={`Coupon (${quote.discountPct}% off)`} value={`− ${fmt(quote.base - quote.final)}`} accent />
            )}
            {quote.free && <Row label="Coupon" value="FREE" accent />}
          </div>
          <div className="my-4 h-px bg-white/10" />
          <div className="flex items-end justify-between">
            <span className="text-[13px] text-white/55">Total {period === "annual" ? "/ year" : "/ month"}</span>
            <span className="text-[26px] font-bold tabular-nums">
              {checking ? <Loader2 size={20} className="animate-spin" /> : quote.free ? "Free" : fmt(quote.final)}
            </span>
          </div>
          {period === "annual" && !quote.free && (
            <p className="mt-1 text-right text-[11.5px] text-white/45">≈ {fmt(monthlyEquivalent)} / month</p>
          )}

          {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">{error}</p>}

          <button
            onClick={pay}
            disabled={paying || checking}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition hover:opacity-90 disabled:opacity-60"
            style={{ background: ACCENT, color: "#ffffff" }}
          >
            {paying ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
              : quote.free ? <>Activate free <ArrowRight size={16} /></>
              : <>Pay {fmt(quote.final)} <ArrowRight size={16} /></>}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/40">
            <ShieldCheck size={12} /> Secure payment via Razorpay
          </p>
        </div>
      </div>
    </main>
  );
}

function humanError(reason: string): string {
  if (reason === "not_configured") return "Payments aren't configured yet.";
  if (reason === "order_failed") return "Couldn't start the payment. Try again.";
  if (reason === "verify_failed") return "Payment couldn't be verified. If you were charged, contact support.";
  return "Something went wrong. Please try again.";
}

function PeriodTab({ active, onClick, title, sub, badge }: { active: boolean; onClick: () => void; title: string; sub: string; badge?: boolean }) {
  return (
    <button onClick={onClick}
      className={`relative rounded-xl px-4 py-3 text-left transition ${active ? "bg-white text-black" : "text-white/70 hover:bg-white/5"}`}>
      <div className="text-[14px] font-semibold">{title}</div>
      <div className={`text-[11.5px] ${active ? "text-black/55" : "text-white/45"}`}>{sub}</div>
      {badge && (
        <span className="absolute right-2 top-2 rounded-full bg-emerald-400/90 px-1.5 py-0.5 text-[9px] font-bold text-black">−10%</span>
      )}
    </button>
  );
}

function Row({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-white/40" : "text-white/65"}>{label}</span>
      <span className={`tabular-nums ${accent ? "text-emerald-300" : "text-white/85"}`}>{value}</span>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center text-sm text-white/70" style={{ background: "var(--ezd-bg-page)" }}>
      {children}
    </main>
  );
}

/* ----------------------------- success screen ----------------------------- */

function SuccessOverlay({ plan, period, onClose }: { plan: PlanId; period: BillingPeriod; onClose: () => void }) {
  const name = PLANS[plan].name;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center px-6"
      style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <style>{successCss}</style>

      {/* soft accent glow */}
      <div className="ck-glow" />

      {/* full-screen confetti burst */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <span key={i} className="ck-confetti" style={{ left: `${c.x}%`, background: c.col, animationDelay: `${c.d}s`, animationDuration: `${c.dur}s` }} />
        ))}
      </div>

      <div className="ck-pop relative w-full max-w-md rounded-3xl border p-8 text-center"
        style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
        {/* check badge with expanding rings */}
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <span className="ck-ring" />
          <span className="ck-ring ck-ring2" />
          <span className="ck-badge grid h-[68px] w-[68px] place-items-center rounded-full" style={{ background: ACCENT }}>
            <Check size={38} strokeWidth={3} color="#ffffff" className="ck-check" />
          </span>
        </div>

        <div className="ck-l1 mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
          <PartyPopper size={14} /> Payment successful
        </div>
        <h2 className="ck-l2 mt-2 text-[27px] font-extrabold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>
          You&rsquo;re on {name}!
        </h2>
        <p className="ck-l3 mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Welcome to EXdeck {name}. Your {period === "annual" ? "annual" : "monthly"} plan is active and everything&rsquo;s unlocked. Go build something great.
        </p>
        <button onClick={onClose}
          className="ck-l4 mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition hover:opacity-90"
          style={{ background: ACCENT, color: "#ffffff" }}>
          Start creating <ArrowRight size={16} />
        </button>
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

const successCss = `
.ck-glow{position:absolute;inset:0;background:radial-gradient(45% 40% at 50% 32%, rgba(124,92,255,0.30), transparent 70%);animation:ck-glow 2.6s ease-in-out infinite}
.ck-pop{animation:ck-pop .55s cubic-bezier(.18,.89,.32,1.28) both}
.ck-badge{position:relative;z-index:2;animation:ck-badge .6s .05s cubic-bezier(.18,.89,.32,1.28) both;box-shadow:0 14px 44px -10px ${ACCENT}}
.ck-check{animation:ck-check .4s .42s both}
.ck-ring{position:absolute;inset:0;border-radius:9999px;border:2px solid ${ACCENT};opacity:0;animation:ck-ring 1.5s .2s ease-out infinite}
.ck-ring2{animation-delay:.9s}
.ck-l1{opacity:0;animation:ck-up .5s .35s both}
.ck-l2{opacity:0;animation:ck-up .5s .45s both}
.ck-l3{opacity:0;animation:ck-up .5s .55s both}
.ck-l4{opacity:0;animation:ck-up .5s .65s both}
.ck-confetti{position:absolute;top:-16px;width:9px;height:15px;border-radius:2px;opacity:0;animation-name:ck-fall;animation-timing-function:cubic-bezier(.3,.6,.5,1);animation-fill-mode:forwards}
@keyframes ck-pop{0%{opacity:0;transform:scale(.9) translateY(14px)}100%{opacity:1;transform:none}}
@keyframes ck-badge{0%{transform:scale(0) rotate(-45deg)}60%{transform:scale(1.12) rotate(6deg)}100%{transform:scale(1) rotate(0)}}
@keyframes ck-check{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes ck-ring{0%{opacity:.7;transform:scale(.7)}100%{opacity:0;transform:scale(1.7)}}
@keyframes ck-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ck-glow{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes ck-fall{0%{opacity:0;transform:translateY(0) rotateZ(0)}8%{opacity:1}100%{opacity:0;transform:translateY(105vh) rotateZ(720deg)}}
@media (prefers-reduced-motion: reduce){.ck-pop,.ck-badge,.ck-check,.ck-ring,.ck-l1,.ck-l2,.ck-l3,.ck-l4,.ck-confetti,.ck-glow{animation:none!important;opacity:1!important}}
`;

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <CheckoutInner />
    </Suspense>
  );
}
