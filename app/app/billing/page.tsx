"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Loader2, Check, AlertTriangle, Users, RotateCw } from "lucide-react";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";
import Logo from "@/components/Logo";

type Billing = {
  tier: "pro" | "free";
  source: string;
  product: string;
  subStatus: string | null;
  isTrial: boolean;
  razorpayStatus: string | null;
  amount: number;
  currency: "USD" | "INR";
  nextChargeAt: number | null;
  currentEnd: number | null;
  expiresAt: number | null;
  ownerName: string | null;
  seatKind: string | null;
  canCancel: boolean;
  cancelled: boolean;
};

const fmtMoney = (n: number, c: string) => (c === "INR" ? `₹${n}` : `$${n}`);
const fmtDate = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "—");

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    const u = onAuthStateChange((x) => {
      if (!x) { router.replace("/auth?redirect=/app/billing"); return; }
      setUser(x); setReady(true);
    });
    return () => u();
  }, [router]);

  const load = async (action: "status" | "cancel" = "status") => {
    setErr(null);
    if (action === "cancel") setBusy(true); else setLoading(true);
    try {
      const t = await getIdToken().catch(() => null);
      const res = await fetch("/api/manage-subscription", {
        method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d?.error || "Failed to load billing."); return; }
      setData(d);
    } catch (e: any) { setErr(e?.message || "Failed."); } finally { setLoading(false); setBusy(false); }
  };

  useEffect(() => { if (user) load("status"); /* eslint-disable-next-line */ }, [user]);

  if (!ready || loading) return <div className="grid min-h-screen place-items-center" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)" }}><Loader2 className="animate-spin" /></div>;

  const isPro = data?.tier === "pro";
  const statusLabel = !isPro ? "Free"
    : data?.isTrial ? "Pro — Free trial"
    : data?.cancelled ? "Pro — Cancelling"
    : data?.source === "seat" ? "Pro — via your organisation"
    : data?.source === "razorpay-sub" ? "Pro — Active (autopay)"
    : "Pro";

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <header className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <Logo size="md" />
        <Link href="/app" className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ezd-fg-muted)" }}><ArrowLeft size={12} /> Back to dashboard</Link>
      </header>

      <div className="mx-auto max-w-2xl">
        <h1 className="text-[28px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Manage plan</h1>

        {/* status card */}
        <section className="mt-6 rounded-2xl border p-6" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <div className="flex items-center gap-2">
            <Crown size={18} style={{ color: "var(--ezd-fg-strong)" }} />
            <span className="text-[16px] font-bold" style={{ color: "var(--ezd-fg-strong)" }}>{statusLabel}</span>
          </div>

          {!isPro ? (
            <>
              <p className="mt-2 text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>You&rsquo;re on the Free plan. Start a 7-day free trial or upgrade to unlock everything.</p>
              <Link href="/checkout?product=pro" className="mt-4 inline-flex rounded-full px-5 py-2.5 text-[13.5px] font-semibold" style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>Start free trial</Link>
            </>
          ) : data?.source === "seat" ? (
            <p className="mt-2 inline-flex items-center gap-2 text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>
              <Users size={15} /> Your Pro is provided by <strong style={{ color: "var(--ezd-fg-strong)" }}>{data.ownerName || "your team"}</strong>
              {data.seatKind ? ` (${data.seatKind === "org" ? "Organisation" : "Team"})` : ""}. Managed by them.
            </p>
          ) : (
            <>
              <dl className="mt-4 grid gap-3 text-[14px]">
                <Detail k="Status" v={data?.isTrial ? "Free trial (active)" : data?.cancelled ? "Active until period end (won't renew)" : "Active"} />
                {data?.isTrial && <Detail k="Trial ends" v={fmtDate(data?.expiresAt)} />}
                <Detail
                  k={data?.cancelled ? "Access until" : data?.isTrial ? "First charge" : "Next charge"}
                  v={data?.cancelled ? fmtDate(data?.expiresAt) : `${fmtMoney(data!.amount, data!.currency)} on ${fmtDate(data?.nextChargeAt)}`}
                />
                <Detail k="Billing" v={`${fmtMoney(data!.amount, data!.currency)} / month · autopay`} />
              </dl>

              {data?.isTrial && (
                <p className="mt-3 rounded-lg border px-3 py-2 text-[12.5px]" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}>
                  You won&rsquo;t be charged until <strong style={{ color: "var(--ezd-fg-strong)" }}>{fmtDate(data?.expiresAt)}</strong>. Cancel before then and you pay nothing.
                </p>
              )}

              {data?.cancelled ? (
                <p className="mt-4 inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
                  <Check size={15} style={{ color: "var(--ezd-fg-strong)" }} /> Subscription cancelled — you keep Pro until {fmtDate(data?.expiresAt)}.
                </p>
              ) : data?.canCancel ? (
                !confirmCancel ? (
                  <button onClick={() => setConfirmCancel(true)} className="mt-5 rounded-full border px-5 py-2.5 text-[13px] font-semibold" style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444", background: "rgba(239,68,68,0.06)" }}>
                    {data?.isTrial ? "Cancel free trial" : "Cancel subscription"}
                  </button>
                ) : (
                  <div className="mt-5 rounded-xl border p-4" style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.06)" }}>
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}><AlertTriangle size={15} style={{ color: "#ef4444" }} /> Cancel {data?.isTrial ? "your free trial" : "autopay"}?</p>
                    <p className="mt-1 text-[12.5px]" style={{ color: "var(--ezd-fg-muted)" }}>
                      You&rsquo;ll keep Pro until <strong style={{ color: "var(--ezd-fg-strong)" }}>{fmtDate(data?.expiresAt)}</strong>, then move to Free. No further charges.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setConfirmCancel(false)} className="rounded-lg border px-4 py-2 text-[13px]" style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)", background: "var(--ezd-bg-hover)" }}>Keep my plan</button>
                      <button onClick={async () => { await load("cancel"); setConfirmCancel(false); }} disabled={busy} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: "#ef4444", opacity: busy ? 0.6 : 1 }}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Yes, cancel
                      </button>
                    </div>
                  </div>
                )
              ) : data?.source === "razorpay" ? (
                <p className="mt-4 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>One-time purchase — active until {fmtDate(data?.expiresAt)} (no autopay).</p>
              ) : null}
            </>
          )}
          {err && <p className="mt-3 text-[13px]" style={{ color: "#ef4444" }}>{err}</p>}
        </section>

        <div className="mt-4 flex items-center justify-between text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>
          <Link href="/app/settings" style={{ color: "var(--ezd-fg-muted)" }}>Team &amp; Organisation settings →</Link>
          <button onClick={() => load("status")} className="inline-flex items-center gap-1.5" style={{ color: "var(--ezd-fg-muted)", background: "none", border: "none", cursor: "pointer" }}><RotateCw size={12} /> Refresh</button>
        </div>
      </div>
    </main>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--ezd-divider)" }}>
      <dt style={{ color: "var(--ezd-fg-quiet)" }}>{k}</dt>
      <dd className="font-medium" style={{ color: "var(--ezd-fg-strong)" }}>{v}</dd>
    </div>
  );
}
