"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Building2, Loader2, Plus, Trash2, Check, Crown } from "lucide-react";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";
import { watchUserPlan } from "@/lib/plan";
import { watchOwnSeat, watchMembership, type SeatView, type MemberPlan } from "@/lib/seats";
import { PRODUCTS, type PlanId } from "@/lib/plans";
import Logo from "@/components/Logo";

const ACCENT = "var(--ezd-fg-strong)";
const BTN: React.CSSProperties = { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" };

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<PlanId>("free");
  const [seat, setSeat] = useState<SeatView | null>(null);
  const [membership, setMembership] = useState<MemberPlan | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      if (!u) { router.replace("/auth?redirect=/app/settings"); return; }
      setUser(u); setReady(true);
      // Materialize any team/org seat the user's email holds.
      getIdToken().then((t) => fetch("/api/seats/sync", { method: "POST", headers: { Authorization: `Bearer ${t}` } })).catch(() => {});
    });
    return () => unsub();
  }, [router]);

  useEffect(() => { if (!user) return; const a = watchUserPlan(user.uid, setPlan); const b = watchOwnSeat(user.uid, setSeat); const c = watchMembership(user.uid, setMembership); return () => { a(); b(); c(); }; }, [user]);

  if (!ready) return <div className="grid min-h-screen place-items-center" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)" }}>Loading…</div>;

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <header className="mx-auto mb-8 flex max-w-3xl items-center justify-between">
        <Logo size="md" />
        <Link href="/app" className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ezd-fg-muted)" }}><ArrowLeft size={12} /> Back to dashboard</Link>
      </header>

      <div className="mx-auto max-w-3xl">
        <h1 className="text-[28px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Settings</h1>

        {/* Current plan */}
        <section className="mt-6 rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
          <div className="flex items-center gap-2">
            <Crown size={16} style={{ color: ACCENT }} />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Your plan</h2>
          </div>
          <p className="mt-2 text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>
            You&rsquo;re on <strong style={{ color: "var(--ezd-fg-strong)" }}>{plan === "pro" ? "Pro" : "Free"}</strong>
            {plan === "pro" ? " — unlimited presentations, documents & resumes, every feature, no watermark." : " — upgrade to Pro for unlimited everything."}
          </p>
          {membership && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px]" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}>
              <Users size={14} style={{ color: ACCENT }} />
              Pro granted by <strong style={{ color: "var(--ezd-fg-strong)" }}>{membership.ownerName || "your team"}</strong>
              {membership.kind ? ` (${membership.kind === "org" ? "Organisation" : "Team"})` : ""}
            </p>
          )}
          {plan === "free" && (
            <Link href="/checkout?product=pro" className="mt-3 inline-flex rounded-full px-4 py-2 text-[13px] font-semibold" style={BTN}>Upgrade to Pro</Link>
          )}
        </section>

        {/* Team */}
        <SeatSection
          kind="team" icon={<Users size={16} />}
          title="Team" seat={seat && seat.kind === "team" ? seat : null}
        />

        {/* Organisation */}
        <SeatSection
          kind="org" icon={<Building2 size={16} />}
          title="Organisation" seat={seat && seat.kind === "org" ? seat : null}
        />
      </div>
    </main>
  );
}

function SeatSection({ kind, icon, title, seat }: { kind: "team" | "org"; icon: React.ReactNode; title: string; seat: SeatView | null }) {
  const prod = PRODUCTS[kind];
  const [members, setMembers] = useState<string[]>(seat?.members || []);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(seat?.name || "");

  useEffect(() => { setMembers(seat?.members || []); }, [seat]);
  useEffect(() => { setName(seat?.name || ""); }, [seat]);

  const post = async (payload: any) => {
    setBusy(true); setErr(null);
    try {
      const t = await getIdToken().catch(() => null);
      const res = await fetch("/api/seats", {
        method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d?.error || "Failed."); return false; }
      if (d.seat) setMembers(Array.isArray(d.seat.members) ? d.seat.members : Object.values(d.seat.members || {}));
      return true;
    } catch (e: any) { setErr(e?.message || "Failed."); return false; } finally { setBusy(false); }
  };

  const act = async (action: "add" | "remove", value?: string) => {
    const ok = await post({ action, email: value });
    if (ok && action === "add") setEmail("");
  };
  const saveName = () => { if ((name || "").trim() !== (seat?.name || "")) post({ action: "name", name: name.trim() }); };

  return (
    <section className="mt-5 rounded-2xl border p-5" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: ACCENT }}>{icon}</span>
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</h2>
        </div>
        <span className="text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>${prod.usd} / ₹{prod.inr} · up to {prod.seats} members</span>
      </div>

      {!seat ? (
        <>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--ezd-fg-muted)" }}>{prod.tagline} Members are auto-upgraded to Pro when they sign in.</p>
          <Link href={`/checkout?product=${kind}`} className="mt-3 inline-flex rounded-full px-4 py-2 text-[13px] font-semibold" style={BTN}>
            Get {title}
          </Link>
        </>
      ) : (
        <>
          <div className="mt-3">
            <label className="mb-1 block text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>{title} name (members see this)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder={kind === "org" ? "e.g. Acme Inc." : "e.g. Design Team"} maxLength={80}
              className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg)" }} />
          </div>
          <p className="mt-3 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
            {members.length} / {seat.max} seats used. {seat.expiresAt ? `Renews/expires ${new Date(seat.expiresAt).toLocaleDateString()}.` : ""} Members get Pro automatically on sign-in.
          </p>
          <div className="mt-3 grid gap-2">
            {members.map((m) => (
              <div key={m} className="flex items-center justify-between rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)" }}>
                <span className="flex items-center gap-2" style={{ color: "var(--ezd-fg)" }}><Check size={14} style={{ color: "var(--ezd-fg-strong)" }} /> {m}</span>
                <button onClick={() => act("remove", m)} disabled={busy} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          {members.length < seat.max && (
            <div className="mt-3 flex gap-2">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@email.com" type="email"
                onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) act("add", email.trim()); }}
                className="flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg)" }} />
              <button onClick={() => email.trim() && act("add", email.trim())} disabled={busy || !email.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold" style={{ ...BTN, opacity: busy || !email.trim() ? 0.6 : 1 }}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
              </button>
            </div>
          )}
        </>
      )}
      {err && <p className="mt-2 text-[12.5px]" style={{ color: "#ef4444" }}>{err}</p>}
    </section>
  );
}
