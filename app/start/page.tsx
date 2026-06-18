"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wand2, FileText, Contact, ArrowRight, Loader2, Lock, Sparkles, Check, Presentation, Languages, Download, Star } from "lucide-react";
import Logo from "@/components/Logo";
import DocCanvas from "@/components/DocCanvas";
import ResumeCanvas from "@/components/ResumeCanvas";
import { onAuthStateChange, loginWithGoogle, type AppUser } from "@/lib/auth";
import { markVisited, type GuestKind } from "@/lib/guestWork";
import { DEFAULT_DOC_THEME, blockId, type ExDoc } from "@/lib/docTypes";
import { DEFAULT_RESUME, rid, type ResumeData } from "@/lib/resumeTypes";

const DENSITIES = ["concise", "balanced", "detailed", "comprehensive"] as const;
const LABEL: Record<GuestKind, string> = { deck: "presentation", doc: "document", resume: "resume" };
const GEN_STAGES = ["Understanding your brief", "Researching the topic", "Writing the content", "Designing the layout", "Adding finishing touches"];

/* sample output rendered (blurred) so the "result" looks real, not a mock */
const SAMPLE_DOC: ExDoc = {
  title: "Market Analysis: EV Adoption in India",
  subtitle: "Trends, drivers, and a 3-year outlook",
  theme: { ...DEFAULT_DOC_THEME, accent: "#2563eb" },
  blocks: [
    { id: blockId(), type: "heading", level: 2, text: "Executive Summary" },
    { id: blockId(), type: "paragraph", text: "India's electric-vehicle market is accelerating, driven by falling battery costs, supportive policy (FAME-II), and rising fuel prices. Two-wheelers lead adoption while four-wheelers scale steadily across metros." },
    { id: blockId(), type: "heading", level: 2, text: "Adoption by Segment" },
    { id: blockId(), type: "table", headers: ["Segment", "2023", "2026 (est.)"], rows: [["Two-wheelers", "5.4%", "18%"], ["Cars", "2.1%", "9%"], ["Buses", "3.0%", "12%"]] },
    { id: blockId(), type: "heading", level: 2, text: "Key Drivers" },
    { id: blockId(), type: "bullets", items: ["Battery pack prices down ~40% since 2020", "State subsidies and road-tax waivers", "Expanding fast-charging corridors"] },
    { id: blockId(), type: "callout", tone: "info", text: "By 2030, EVs could make up 30% of new vehicle sales in India under the base-case scenario." },
  ],
};

const SAMPLE_RESUME: ResumeData = {
  ...DEFAULT_RESUME,
  templateId: "sidebar", accent: "#1f6f63", headingFontId: "poppins",
  name: "Jordan Lee", headline: "Senior Product Designer",
  contact: { email: "jordan.lee@email.com", phone: "+1 555 0142", location: "San Francisco, CA", linkedin: "linkedin.com/in/jordanlee" },
  summary: "Product designer with 7+ years shipping consumer and B2B products end to end, from research to polished UI. Led design for two 0→1 launches.",
  experience: [
    { id: rid(), role: "Senior Product Designer", company: "Northwind", location: "Remote", start: "2021", end: "Present", current: true, bullets: ["Led the redesign that lifted activation 34%", "Built and scaled the design system across 6 squads"] },
    { id: rid(), role: "Product Designer", company: "Brightlabs", start: "2018", end: "2021", bullets: ["Owned onboarding flows used by 2M+ users", "Ran weekly usability tests"] },
  ],
  education: [{ id: rid(), degree: "B.Des, Interaction Design", school: "RISD", start: "2014", end: "2018" }],
  skills: ["Figma", "Prototyping", "Design systems", "User research", "HTML/CSS"],
  languages: [{ id: rid(), name: "English", level: "Native" }, { id: rid(), name: "Spanish", level: "Fluent" }],
};

export default function StartPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"choose" | "brief" | "generating" | "reveal">("choose");
  const [kind, setKind] = useState<GuestKind>("deck");
  const [topic, setTopic] = useState("");
  const [pages, setPages] = useState(4);
  const [densityIdx, setDensityIdx] = useState(1);
  const [slides, setSlides] = useState(8);
  const [authBusy, setAuthBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { markVisited(); const u = onAuthStateChange((x) => { setUser(x); setReady(true); }); return () => u(); }, []);
  // Guests only — if already signed in, go to the dashboard.
  useEffect(() => { if (ready && user) router.replace("/app"); }, [ready, user, router]);

  const choose = (k: GuestKind) => {
    setKind(k);
    if (k === "resume") setStep("generating");
    else setStep("brief");
  };

  const reveal = () => { setStep("generating"); };

  // ~5s "generating" so the result feels really built, then reveal it (blurred).
  const [genStage, setGenStage] = useState(0);
  useEffect(() => {
    if (step !== "generating") return;
    setGenStage(0);
    const stageT = window.setInterval(() => setGenStage((s) => Math.min(s + 1, GEN_STAGES.length - 1)), 1000);
    const doneT = window.setTimeout(() => setStep("reveal"), 5200);
    return () => { window.clearInterval(stageT); window.clearTimeout(doneT); };
  }, [step]);

  const continueGoogle = async () => {
    setAuthBusy(true); setErr(null);
    try { await loginWithGoogle(); router.push("/app"); }
    catch { setErr("Couldn't sign in. Please try again."); setAuthBusy(false); }
  };
  const continueEmail = () => router.push(`/auth?redirect=${encodeURIComponent("/app")}`);

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

          {/* what you get */}
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <Feature icon={<Sparkles size={16} />} title="AI does the work" body="Type a brief — get real content, charts, and layout in seconds." />
            <Feature icon={<Presentation size={16} />} title="Edit everything" body="Drag, recolor, rewrite. Switch themes, fonts, and templates instantly." />
            <Feature icon={<Download size={16} />} title="Export, no lock-in" body="Real .pptx and .pdf you own — plus translation and speaker notes." />
          </div>

          {/* social proof */}
          <div className="mt-12 rounded-2xl border p-6 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
            <div className="inline-flex items-center gap-1" style={{ color: "var(--ezd-fg-strong)" }}>
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} fill="currentColor" strokeWidth={0} />)}
            </div>
            <p className="mt-3 text-[14px]" style={{ color: "var(--ezd-fg-strong)" }}>&ldquo;Made a full pitch deck in under a minute. The editor is the best part.&rdquo;</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>— loved by students, founders & teams</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--ezd-fg-quiet)" }}>
              <span className="inline-flex items-center gap-1"><Check size={12} /> Free to start</span>
              <span className="inline-flex items-center gap-1"><Check size={12} /> No credit card</span>
              <span className="inline-flex items-center gap-1"><Languages size={12} /> Export to PPTX &amp; PDF</span>
            </div>
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

      {step === "generating" && (
        <div className="relative grid min-h-[calc(100vh-57px)] place-items-center overflow-hidden px-5" style={{ background: "var(--ezd-bg-page)" }}>
            <div className="flex flex-col items-center gap-5">
              <div className="relative grid h-16 w-16 place-items-center">
                <span className="absolute inset-0 rounded-full border-2" style={{ borderColor: "var(--ezd-divider)" }} />
                <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: "var(--ezd-fg-strong)" }} />
                <Wand2 size={22} style={{ color: "var(--ezd-fg-strong)" }} />
              </div>
              <div className="text-center">
                <div className="text-[17px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Building your {LABEL[kind]}…</div>
                <div className="mt-1 text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>{GEN_STAGES[genStage]}…</div>
              </div>
              <div className="h-1 w-56 overflow-hidden rounded-full" style={{ background: "var(--ezd-bg-hover)" }}>
                <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${((genStage + 1) / GEN_STAGES.length) * 100}%`, background: "var(--ezd-fg-strong)" }} />
              </div>
            </div>
        </div>
      )}

      {step === "reveal" && (
        <div className="relative min-h-[calc(100vh-57px)] overflow-hidden">
          {/* blurred fake result behind */}
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center p-8" style={{ filter: "blur(8px)", opacity: 0.5 }}>
            {kind === "deck" && <FakeSlide />}
            {kind === "doc" && <DocCanvas doc={SAMPLE_DOC} editable={false} scale={0.62} />}
            {kind === "resume" && <ResumeCanvas data={SAMPLE_RESUME} scale={0.6} />}
          </div>
          <div aria-hidden className="absolute inset-0" style={{ background: "var(--ezd-bg-page)", opacity: 0.62 }} />

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

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border p-4 text-left" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}>{icon}</span>
      <span>
        <span className="block text-[13.5px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>{body}</span>
      </span>
    </div>
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
