"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wand2, FileText, Contact, ArrowRight, Loader2, Lock, Sparkles, Check } from "lucide-react";
import Logo from "@/components/Logo";
import { onAuthStateChange, loginWithGoogle, type AppUser } from "@/lib/auth";
import { stashGuestWork, readGuestWork, markVisited, KIND_PATH, type GuestKind } from "@/lib/guestWork";

const DENSITIES = ["concise", "balanced", "detailed", "comprehensive"] as const;
const LABEL: Record<GuestKind, string> = { deck: "presentation", doc: "document", resume: "resume" };

export default function StartPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"choose" | "brief" | "reveal">("choose");
  const [kind, setKind] = useState<GuestKind>("deck");
  const [topic, setTopic] = useState("");
  const [pages, setPages] = useState(4);
  const [densityIdx, setDensityIdx] = useState(1);
  const [slides, setSlides] = useState(8);
  const [authBusy, setAuthBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { markVisited(); const u = onAuthStateChange((x) => { setUser(x); setReady(true); }); return () => u(); }, []);
  // Guests only — if already signed in (and not mid-guest-flow), go to the dashboard.
  useEffect(() => { if (ready && user && !readGuestWork()) router.replace("/app"); }, [ready, user, router]);

  const choose = (k: GuestKind) => {
    setKind(k);
    if (k === "resume") { stashGuestWork({ kind: "resume" }); setStep("reveal"); }
    else setStep("brief");
  };

  const reveal = () => {
    stashGuestWork({ kind, topic: topic.trim(), settings: kind === "doc" ? { pages, densityIdx } : { slides } });
    setStep("reveal");
  };

  const continueGoogle = async () => {
    setAuthBusy(true); setErr(null);
    try { await loginWithGoogle(); router.push(KIND_PATH[kind]); }
    catch { setErr("Couldn't sign in. Please try again."); setAuthBusy(false); }
  };
  const continueEmail = () => router.push(`/auth?redirect=${encodeURIComponent(KIND_PATH[kind])}`);

  if (!ready) return <div className="grid min-h-screen place-items-center" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)" }}>Loading…</div>;

  return (
    <main className="min-h-screen" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <header className="border-b" style={{ borderColor: "var(--ezd-divider)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo size="sm" href="/" />
          <Link href="/auth" className="text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>Sign in</Link>
        </div>
      </header>

      {step === "choose" && (
        <div className="mx-auto max-w-4xl px-5 py-14">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-strong)" }}><Sparkles size={12} /> Try it free</div>
            <h1 className="mt-3 text-[34px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>What do you want to create?</h1>
            <p className="mt-2 text-[14.5px]" style={{ color: "var(--ezd-fg-muted)" }}>No account needed to start. See it built in seconds.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <ChooseCard icon={<Wand2 size={22} />} title="Presentation" desc="A full slide deck from one line." onClick={() => choose("deck")} />
            <ChooseCard icon={<FileText size={22} />} title="Document" desc="A structured, Word-style doc." onClick={() => choose("doc")} />
            <ChooseCard icon={<Contact size={22} />} title="Resume" desc="A polished, ATS-friendly resume." onClick={() => choose("resume")} />
          </div>
        </div>
      )}

      {step === "brief" && (
        <div className="mx-auto max-w-2xl px-5 py-14">
          <button onClick={() => setStep("choose")} className="text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>← Back</button>
          <h1 className="mt-4 text-[28px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Describe your {LABEL[kind]}</h1>
          <p className="mt-2 text-[14px]" style={{ color: "var(--ezd-fg-muted)" }}>A sentence or two is enough — we&rsquo;ll build it.</p>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4}
            placeholder={kind === "doc" ? "e.g. A market analysis of EV adoption in India with a pricing table and growth chart" : "e.g. A Series A pitch for a campus food-delivery startup"}
            className="mt-5 w-full rounded-xl border p-4 text-[15px] outline-none" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg)" }} />
          <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3">
            {kind === "doc" ? (
              <>
                <label className="text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>Pages
                  <input type="number" min={1} max={20} value={pages} onChange={(e) => setPages(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="ml-2 w-16 rounded-lg border px-2 py-1" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg)" }} />
                </label>
                <label className="text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>Density
                  <select value={densityIdx} onChange={(e) => setDensityIdx(Number(e.target.value))} className="ml-2 rounded-lg border px-2 py-1 capitalize" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg)" }}>
                    {DENSITIES.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </label>
              </>
            ) : (
              <label className="text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>Slides
                <input type="number" min={3} max={20} value={slides} onChange={(e) => setSlides(Math.min(20, Math.max(3, Number(e.target.value) || 8)))} className="ml-2 w-16 rounded-lg border px-2 py-1" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg)" }} />
              </label>
            )}
          </div>
          <button onClick={reveal} disabled={topic.trim().length < 5}
            className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold disabled:opacity-50"
            style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
            <Wand2 size={16} /> Generate my {LABEL[kind]}
          </button>
        </div>
      )}

      {step === "reveal" && (
        <div className="relative min-h-[calc(100vh-57px)] overflow-hidden">
          {/* blurred fake result behind */}
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center p-8" style={{ filter: "blur(5px)", opacity: 0.9 }}>
            {kind === "deck" && <FakeSlide />}
            {kind === "doc" && <FakeDoc />}
            {kind === "resume" && <FakeResume />}
          </div>
          <div aria-hidden className="absolute inset-0" style={{ background: "var(--ezd-bg-page)", opacity: 0.55 }} />

          {/* login popup */}
          <div className="relative z-10 grid min-h-[calc(100vh-57px)] place-items-center px-5">
            <div className="w-full max-w-md rounded-3xl border p-7 text-center shadow-2xl" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}><Check size={22} /></div>
              <h2 className="mt-4 text-[22px] font-bold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>Your {LABEL[kind]} is ready</h2>
              <p className="mt-2 text-[13.5px]" style={{ color: "var(--ezd-fg-muted)" }}>Sign in to view it, edit everything, and download — it&rsquo;s waiting for you.</p>

              <button onClick={continueGoogle} disabled={authBusy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold disabled:opacity-60"
                style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}>
                {authBusy ? <Loader2 size={16} className="animate-spin" /> : <GoogleMark />} Continue with Google
              </button>
              <button onClick={continueEmail} disabled={authBusy}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-[14px] font-semibold"
                style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-strong)", background: "transparent" }}>
                Sign up with email <ArrowRight size={15} />
              </button>
              {err && <p className="mt-2 text-[12.5px]" style={{ color: "#ef4444" }}>{err}</p>}

              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
                <Lock size={11} /> We&rsquo;ll generate it the moment you sign in.
              </p>
              <button onClick={() => setStep(kind === "resume" ? "choose" : "brief")} className="mt-3 text-[12px]" style={{ color: "var(--ezd-fg-muted)", background: "none", border: "none", cursor: "pointer" }}>← Edit my brief</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ChooseCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex flex-col items-start rounded-2xl border p-6 text-left transition hover:shadow-lg" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>{icon}</div>
      <h3 className="mt-4 text-[16px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</h3>
      <p className="mt-1 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>{desc}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Start <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></span>
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 34.7 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.2 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.4 43.5 30.7 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

/* ----------------------------- fake previews ---------------------------- */

function FakeSlide() {
  const A = "#7C5CFF";
  return (
    <div style={{ width: 760, maxWidth: "92vw", aspectRatio: "16/9", background: "#0B1220", borderRadius: 14, padding: 40, color: "#fff", boxShadow: "0 30px 80px -20px rgba(0,0,0,.5)" }}>
      <div style={{ height: 7, width: 70, background: A, borderRadius: 99 }} />
      <div style={{ marginTop: 18, height: 26, width: "62%", background: "#fff", opacity: 0.92, borderRadius: 5 }} />
      <div style={{ marginTop: 10, height: 12, width: "40%", background: "#fff", opacity: 0.4, borderRadius: 4 }} />
      <div style={{ display: "flex", gap: 30, marginTop: 34 }}>
        <div style={{ flex: 1 }}>
          {[92, 86, 90, 70].map((w, i) => <div key={i} style={{ height: 11, width: `${w}%`, background: "#fff", opacity: 0.25, borderRadius: 3, marginTop: 12 }} />)}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 12, height: 150 }}>
          {[50, 78, 60, 100, 72].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: A, opacity: 0.85, borderRadius: "4px 4px 0 0" }} />)}
        </div>
      </div>
    </div>
  );
}

function FakeDoc() {
  const A = "#2563eb";
  return (
    <div style={{ width: 600, maxWidth: "92vw", aspectRatio: "1/1.414", background: "#fff", borderRadius: 8, padding: 48, boxShadow: "0 30px 80px -20px rgba(0,0,0,.4)" }}>
      <div style={{ height: 22, width: "55%", background: "#111", borderRadius: 4 }} />
      <div style={{ height: 9, width: "30%", background: A, borderRadius: 3, marginTop: 8 }} />
      {[96, 92, 94, 88].map((w, i) => <div key={i} style={{ height: 8, width: `${w}%`, background: "#111", opacity: 0.16, borderRadius: 3, marginTop: 10 }} />)}
      <div style={{ height: 11, width: "34%", background: A, opacity: 0.8, borderRadius: 3, margin: "22px 0 10px" }} />
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
        {[0, 1, 2].map((r) => (
          <div key={r} style={{ display: "flex", borderTop: r ? "1px solid #eee" : "none", background: r === 0 ? A : "transparent" }}>
            {[1, 1, 1].map((_, c) => <div key={c} style={{ flex: 1, padding: 9 }}><div style={{ height: 7, background: r === 0 ? "#fff" : "#111", opacity: r === 0 ? 0.9 : 0.18, borderRadius: 2 }} /></div>)}
          </div>
        ))}
      </div>
      {[90, 84].map((w, i) => <div key={i} style={{ height: 8, width: `${w}%`, background: "#111", opacity: 0.16, borderRadius: 3, marginTop: 12 }} />)}
    </div>
  );
}

function FakeResume() {
  const A = "#1f6f63";
  return (
    <div style={{ width: 600, maxWidth: "92vw", aspectRatio: "1/1.414", background: "#fff", borderRadius: 8, display: "flex", overflow: "hidden", boxShadow: "0 30px 80px -20px rgba(0,0,0,.4)" }}>
      <div style={{ width: "34%", background: A, padding: 24, color: "#fff" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.55)", margin: "0 auto 16px" }} />
        {[60, 80, 70, 90, 55].map((w, i) => <div key={i} style={{ height: 7, width: `${w}%`, background: "rgba(255,255,255,.6)", borderRadius: 3, marginTop: 10 }} />)}
      </div>
      <div style={{ flex: 1, padding: 28 }}>
        <div style={{ height: 22, width: "60%", background: "#111", borderRadius: 4 }} />
        <div style={{ height: 9, width: "40%", background: A, borderRadius: 3, marginTop: 7 }} />
        {[0, 1, 2].map((s) => (
          <div key={s} style={{ marginTop: 18 }}>
            <div style={{ height: 9, width: "35%", background: A, opacity: 0.8, borderRadius: 3 }} />
            {[92, 86, 80].map((w, i) => <div key={i} style={{ height: 7, width: `${w}%`, background: "#111", opacity: 0.16, borderRadius: 2, marginTop: 8 }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
