"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2, FileDown, Plus, Trash2, X, UploadCloud, ArrowLeft, GripVertical, Sparkles, ArrowUp, ArrowDown,
} from "lucide-react";
import Logo from "@/components/Logo";
import ResumeCanvas from "@/components/ResumeCanvas";
import { onAuthStateChange, getIdToken, type AppUser } from "@/lib/auth";
import {
  DEFAULT_RESUME, DEFAULT_SECTION_ORDER, SECTION_LABELS, SUGGESTED_SECTIONS, emptyExperience, emptyEducation, emptyLanguage, emptyCertification,
  emptyProject, emptyCustom, customWithTitle, type ResumeData,
} from "@/lib/resumeTypes";
import { RESUME_TEMPLATES, getResumeTemplate } from "@/lib/resumeTemplates";
import { DOC_FONTS, loadDocFonts } from "@/lib/docFonts";
import { createResume, saveResume, loadResume } from "@/lib/resumeStore";
import { renderPagesToPdf } from "@/lib/docPdf";

export default function ResumeStudio() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"template" | "edit">("template");
  const [r, setR] = useState<ResumeData>({ ...DEFAULT_RESUME });
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const tpl = getResumeTemplate(r.templateId);
  const singleCol = tpl.layout === "compact" || tpl.layout === "classic" || tpl.layout === "minimal";
  const order = r.sectionOrder && r.sectionOrder.length ? r.sectionOrder : DEFAULT_SECTION_ORDER;

  useEffect(() => { const u = onAuthStateChange((x) => { setUser(x); setReady(true); }); return () => u(); }, []);
  useEffect(() => { loadDocFonts(DOC_FONTS.map((f) => f.id)); }, []);

  // Open existing via /resume?id=
  useEffect(() => {
    if (!user) return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    (async () => {
      const stored = await loadResume(user.uid, id).catch(() => null);
      if (stored?.resume) { setR({ ...DEFAULT_RESUME, ...stored.resume }); setResumeId(stored.id); setStep("edit"); }
    })();
  }, [user]);

  // Debounced autosave.
  useEffect(() => {
    if (!user || !resumeId || step !== "edit") return;
    const t = setTimeout(() => { saveResume(user.uid, resumeId, r).catch(() => {}); }, 900);
    return () => clearTimeout(t);
  }, [user, resumeId, step, r]);

  const up = (patch: Partial<ResumeData>) => setR((prev) => ({ ...prev, ...patch }));

  const moveSection = (key: string, dir: -1 | 1) => {
    const arr = (r.sectionOrder && r.sectionOrder.length ? r.sectionOrder : DEFAULT_SECTION_ORDER).slice();
    const i = arr.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    up({ sectionOrder: arr });
  };

  const addSection = (title: string) => {
    up({ custom: [...r.custom, title ? customWithTitle(title) : emptyCustom()] });
  };
  const moveCustom = (i: number, dir: -1 | 1) => {
    const arr = r.custom.slice();
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    up({ custom: arr });
  };

  const refine = async () => {
    if (refining) return;
    setRefining(true); setErr(null);
    try {
      const token = await getIdToken().catch(() => null);
      const res = await fetch("/api/refine-resume", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ resume: r }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d?.code === "plan_feature_locked" ? "Refine with AI is a Pro feature — upgrade to use it." : (d?.error || "Refine failed."));
        return;
      }
      if (d.resume) setR((prev) => ({ ...prev, ...d.resume }));
    } catch (e: any) { setErr(e?.message || "Refine failed."); } finally { setRefining(false); }
  };

  const chooseTemplate = async (id: string) => {
    const t = getResumeTemplate(id);
    const next: ResumeData = {
      ...r, templateId: t.id, accent: t.accent, fontId: t.fontId, headingFontId: t.headingFontId,
      photoUrl: t.hasPhoto ? r.photoUrl : undefined,
    };
    setR(next);
    setStep("edit");
    if (user && !resumeId) {
      try { const id = await createResume(user.uid, next); setResumeId(id); } catch { /* autosave retries */ }
    }
  };

  const exportPdf = async () => {
    if (!printRef.current || exporting) return;
    setExporting(true); setErr(null);
    try {
      await new Promise((res) => setTimeout(res, 120)); // let auto-fit settle
      const node = printRef.current.firstElementChild as HTMLElement;
      await renderPagesToPdf([node], `${(r.name || "resume").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
    } catch (e: any) { setErr(e?.message || "Export failed."); } finally { setExporting(false); }
  };

  if (!ready) return <div className="grid min-h-screen place-items-center" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg-muted)" }}>Loading…</div>;

  /* ----------------------------- template step ----------------------------- */
  if (step === "template") {
    return (
      <main style={{ minHeight: "100vh", background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
        <TopBar />
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ezd-fg-strong)" }}>Free Resume Maker</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--ezd-fg-strong)" }}>Choose a template</h1>
          <p style={{ marginTop: 6, color: "var(--ezd-fg-muted)", fontSize: 14 }}>Pick a layout — then just answer the questions. Everything stays editable, and it exports to a clean one-page PDF.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 16, marginTop: 24 }}>
            {RESUME_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => chooseTemplate(t.id)}
                style={{ textAlign: "left", border: "1px solid var(--ezd-divider)", borderRadius: 14, overflow: "hidden", background: "var(--ezd-bg-card)", cursor: "pointer", padding: 0 }}>
                <div style={{ height: 150, background: "#fff", position: "relative", overflow: "hidden", borderBottom: "1px solid var(--ezd-divider)" }}>
                  <TemplateThumb layout={t.layout} accent={t.accent} hasPhoto={t.hasPhoto} />
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: "var(--ezd-fg-strong)" }}>
                    {t.name}
                    {t.hasPhoto && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 99, background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-quiet)" }}>PHOTO</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ezd-fg-quiet)" }}>{t.blurb}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------------ edit step ------------------------------ */
  const accentInput = (
    <input type="color" value={r.accent} onChange={(e) => up({ accent: e.target.value })} title="Accent color"
      style={{ width: 30, height: 30, border: "1px solid var(--ezd-divider)", borderRadius: 7, background: "none", cursor: "pointer" }} />
  );

  return (
    <main style={{ minHeight: "100vh", background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      {/* toolbar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid var(--ezd-divider)", background: "var(--ezd-nav-bg)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Logo size="sm" href="/" />
          <button onClick={() => setStep("template")} style={chip()}><ArrowLeft size={13} /> Templates</button>
          <span style={{ width: 1, height: 22, background: "var(--ezd-divider)" }} />
          <select value={r.fontId} onChange={(e) => up({ fontId: e.target.value })} title="Body font" style={sel()}>
            {DOC_FONTS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {accentInput}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ezd-fg-muted)" }}>
            Density
            <input type="range" min={0.8} max={1.25} step={0.05} value={r.density} onChange={(e) => up({ density: Number(e.target.value) })} style={{ accentColor: r.accent }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--ezd-fg-muted)" }}>
            <input type="checkbox" checked={r.autoFit} onChange={(e) => up({ autoFit: e.target.checked })} /> Auto-fit 1 page
          </label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link href="/app/resumes" style={{ ...chip(), textDecoration: "none" }}>My resumes</Link>
            <button onClick={exportPdf} disabled={exporting} style={btn()}>{exporting ? <><Loader2 size={15} className="animate-spin" /> PDF…</> : <><FileDown size={15} /> Export PDF</>}</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 18, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 22, alignItems: "start" }}>
        {/* form */}
        <div style={{ display: "grid", gap: 14, maxWidth: 620 }}>
          <Card title="Basics">
            <Row><Field label="Full name"><In value={r.name} onChange={(v) => up({ name: v })} placeholder="Jane Doe" /></Field>
              <Field label="Headline / role"><In value={r.headline} onChange={(v) => up({ headline: v })} placeholder="Marketing Manager" /></Field></Row>
            {tpl.hasPhoto && <PhotoField url={r.photoUrl} onSet={(u) => up({ photoUrl: u })} />}
          </Card>

          <Card title="Contact">
            <Row><Field label="Email"><In value={r.contact.email || ""} onChange={(v) => up({ contact: { ...r.contact, email: v } })} placeholder="jane@email.com" /></Field>
              <Field label="Phone"><In value={r.contact.phone || ""} onChange={(v) => up({ contact: { ...r.contact, phone: v } })} placeholder="+1 555 0100" /></Field></Row>
            <Row><Field label="Location"><In value={r.contact.location || ""} onChange={(v) => up({ contact: { ...r.contact, location: v } })} placeholder="City, Country" /></Field>
              <Field label="Website"><In value={r.contact.website || ""} onChange={(v) => up({ contact: { ...r.contact, website: v } })} placeholder="jane.dev" /></Field></Row>
            <Row><Field label="LinkedIn"><In value={r.contact.linkedin || ""} onChange={(v) => up({ contact: { ...r.contact, linkedin: v } })} placeholder="linkedin.com/in/jane" /></Field>
              <Field label="GitHub"><In value={r.contact.github || ""} onChange={(v) => up({ contact: { ...r.contact, github: v } })} placeholder="github.com/jane" /></Field></Row>
          </Card>

          <Card title="Professional summary">
            <TA value={r.summary || ""} onChange={(v) => up({ summary: v })} placeholder="2–3 sentences about who you are and what you do best." rows={3} />
          </Card>

          {/* Experience */}
          <Card title="Work experience" onAdd={() => up({ experience: [...r.experience, emptyExperience()] })}>
            {r.experience.length === 0 && <Empty>Add your roles, newest first.</Empty>}
            {r.experience.map((e, i) => (
              <Entry key={e.id} onRemove={() => up({ experience: r.experience.filter((x) => x.id !== e.id) })}>
                <Row><Field label="Role"><In value={e.role} onChange={(v) => up({ experience: patch(r.experience, i, { role: v }) })} placeholder="Senior Designer" /></Field>
                  <Field label="Company"><In value={e.company} onChange={(v) => up({ experience: patch(r.experience, i, { company: v }) })} placeholder="Acme Inc." /></Field></Row>
                <Row><Field label="Location"><In value={e.location || ""} onChange={(v) => up({ experience: patch(r.experience, i, { location: v }) })} placeholder="Remote" /></Field>
                  <Field label="Start"><In value={e.start || ""} onChange={(v) => up({ experience: patch(r.experience, i, { start: v }) })} placeholder="2021" /></Field>
                  <Field label="End"><In value={e.end || ""} onChange={(v) => up({ experience: patch(r.experience, i, { end: v }) })} placeholder="2023" disabled={e.current} /></Field></Row>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ezd-fg-muted)" }}>
                  <input type="checkbox" checked={!!e.current} onChange={(ev) => up({ experience: patch(r.experience, i, { current: ev.target.checked }) })} /> I currently work here
                </label>
                <BulletList bullets={e.bullets} onChange={(b) => up({ experience: patch(r.experience, i, { bullets: b }) })} />
              </Entry>
            ))}
          </Card>

          {/* Education */}
          <Card title="Education" onAdd={() => up({ education: [...r.education, emptyEducation()] })}>
            {r.education.length === 0 && <Empty>Add your degrees.</Empty>}
            {r.education.map((e, i) => (
              <Entry key={e.id} onRemove={() => up({ education: r.education.filter((x) => x.id !== e.id) })}>
                <Row><Field label="Degree"><In value={e.degree} onChange={(v) => up({ education: patch(r.education, i, { degree: v }) })} placeholder="B.Sc. Computer Science" /></Field>
                  <Field label="School"><In value={e.school} onChange={(v) => up({ education: patch(r.education, i, { school: v }) })} placeholder="State University" /></Field></Row>
                <Row><Field label="Location"><In value={e.location || ""} onChange={(v) => up({ education: patch(r.education, i, { location: v }) })} placeholder="City" /></Field>
                  <Field label="Start"><In value={e.start || ""} onChange={(v) => up({ education: patch(r.education, i, { start: v }) })} placeholder="2017" /></Field>
                  <Field label="End"><In value={e.end || ""} onChange={(v) => up({ education: patch(r.education, i, { end: v }) })} placeholder="2021" /></Field></Row>
                <Field label="Details (optional)"><In value={e.details || ""} onChange={(v) => up({ education: patch(r.education, i, { details: v }) })} placeholder="GPA, honors, relevant coursework" /></Field>
              </Entry>
            ))}
          </Card>

          <Card title="Skills"><TagInput items={r.skills} onChange={(s) => up({ skills: s })} placeholder="Add a skill and press Enter" /></Card>

          {/* Languages */}
          <Card title="Languages" onAdd={() => up({ languages: [...r.languages, emptyLanguage()] })}>
            {r.languages.map((l, i) => (
              <Entry key={l.id} onRemove={() => up({ languages: r.languages.filter((x) => x.id !== l.id) })} compact>
                <Row><Field label="Language"><In value={l.name} onChange={(v) => up({ languages: patch(r.languages, i, { name: v }) })} placeholder="English" /></Field>
                  <Field label="Level"><In value={l.level || ""} onChange={(v) => up({ languages: patch(r.languages, i, { level: v }) })} placeholder="Native / Fluent" /></Field></Row>
              </Entry>
            ))}
          </Card>

          {/* Certifications */}
          <Card title="Certifications" onAdd={() => up({ certifications: [...r.certifications, emptyCertification()] })}>
            {r.certifications.map((c, i) => (
              <Entry key={c.id} onRemove={() => up({ certifications: r.certifications.filter((x) => x.id !== c.id) })} compact>
                <Row><Field label="Name"><In value={c.name} onChange={(v) => up({ certifications: patch(r.certifications, i, { name: v }) })} placeholder="AWS Certified…" /></Field>
                  <Field label="Issuer"><In value={c.issuer || ""} onChange={(v) => up({ certifications: patch(r.certifications, i, { issuer: v }) })} placeholder="Amazon" /></Field>
                  <Field label="Year"><In value={c.year || ""} onChange={(v) => up({ certifications: patch(r.certifications, i, { year: v }) })} placeholder="2024" /></Field></Row>
              </Entry>
            ))}
          </Card>

          {/* Projects */}
          <Card title="Projects" onAdd={() => up({ projects: [...r.projects, emptyProject()] })}>
            {r.projects.map((p, i) => (
              <Entry key={p.id} onRemove={() => up({ projects: r.projects.filter((x) => x.id !== p.id) })}>
                <Row><Field label="Name"><In value={p.name} onChange={(v) => up({ projects: patch(r.projects, i, { name: v }) })} placeholder="Project name" /></Field>
                  <Field label="Link"><In value={p.link || ""} onChange={(v) => up({ projects: patch(r.projects, i, { link: v }) })} placeholder="github.com/…" /></Field></Row>
                <Field label="Description"><In value={p.description || ""} onChange={(v) => up({ projects: patch(r.projects, i, { description: v }) })} placeholder="What it does / your role" /></Field>
              </Entry>
            ))}
          </Card>

          <Card title="Interests"><TagInput items={r.interests} onChange={(s) => up({ interests: s })} placeholder="Add an interest and press Enter" /></Card>

          {/* Additional / suggested sections */}
          <Card title="Add more sections">
            <p style={{ fontSize: 12, color: "var(--ezd-fg-quiet)", margin: "0 0 2px" }}>Add any extra section — pick a suggestion or write your own. Each is a titled, bulleted block.</p>
            <SectionAdder onAdd={addSection} />
            {r.custom.length > 0 && (
              <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
                {r.custom.map((c, i) => (
                  <Entry key={c.id} onRemove={() => up({ custom: r.custom.filter((x) => x.id !== c.id) })}
                    onUp={i > 0 ? () => moveCustom(i, -1) : undefined} onDown={i < r.custom.length - 1 ? () => moveCustom(i, 1) : undefined}>
                    <Field label="Section title"><In value={c.title} onChange={(v) => up({ custom: patch(r.custom, i, { title: v }) })} placeholder="Section title" /></Field>
                    <BulletList bullets={c.items} onChange={(b) => up({ custom: patch(r.custom, i, { items: b }) })} />
                  </Entry>
                ))}
              </div>
            )}
          </Card>

          {singleCol && (
            <Card title="Section order">
              <p style={{ fontSize: 12, color: "var(--ezd-fg-quiet)", margin: "0 0 4px" }}>Reorder how sections appear on the resume.</p>
              <div style={{ display: "grid", gap: 6 }}>
                {order.map((key, idx) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--ezd-divider)", borderRadius: 8, padding: "6px 10px", background: "var(--ezd-bg-hover)" }}>
                    <span style={{ fontSize: 13, color: "var(--ezd-fg)" }}>{SECTION_LABELS[key] || key}</span>
                    <span style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => moveSection(key, -1)} disabled={idx === 0} title="Move up" style={iconBtn(idx === 0)}><ArrowUp size={14} /></button>
                      <button onClick={() => moveSection(key, 1)} disabled={idx === order.length - 1} title="Move down" style={iconBtn(idx === order.length - 1)}><ArrowDown size={14} /></button>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Refine with AI — premium */}
          <button onClick={refine} disabled={refining}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", borderRadius: 12, border: "none", background: "#7C5CFF", color: "#fff", padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: refining ? "wait" : "pointer", opacity: refining ? 0.7 : 1 }}>
            {refining ? <><Loader2 size={16} className="animate-spin" /> Refining your resume…</> : <><Sparkles size={16} /> Refine with AI
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", padding: "2px 6px", borderRadius: 99, background: "rgba(255,255,255,0.22)" }}>PRO</span></>}
          </button>
          <p style={{ fontSize: 11.5, color: "var(--ezd-fg-quiet)", margin: "-4px 0 0", textAlign: "center" }}>Polishes your wording to stand out — keeps your facts, never invents anything.</p>

          {err && <p style={{ color: "#ef4444", fontSize: 13 }}>{err}</p>}
        </div>

        {/* live preview */}
        <div style={{ position: "sticky", top: 70 }}>
          <div style={{ width: 794 * 0.6, height: 1123 * 0.6, overflow: "hidden" }}>
            <ResumeCanvas data={r} scale={0.6} />
          </div>
        </div>
      </div>

      {/* hidden full-size render for PDF */}
      <div style={{ position: "fixed", left: -99999, top: 0 }} aria-hidden>
        <div ref={printRef}><ResumeCanvas data={r} print /></div>
      </div>
    </main>
  );
}

/* ------------------------------- helpers -------------------------------- */

function patch<T>(arr: T[], i: number, p: Partial<T>): T[] {
  return arr.map((x, idx) => (idx === i ? { ...x, ...p } : x));
}

function TopBar() {
  return (
    <div style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size="sm" href="/" />
        <Link href="/app" style={{ fontSize: 13, color: "var(--ezd-fg-muted)" }}>Back to app</Link>
      </div>
    </div>
  );
}

function Card({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <section style={{ border: "1px solid var(--ezd-divider)", borderRadius: 12, background: "var(--ezd-bg-card)", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ezd-fg-strong)" }}>{title}</h3>
        {onAdd && <button onClick={onAdd} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--ezd-fg-strong)", background: "var(--ezd-bg-hover)", border: "1px solid var(--ezd-divider)", borderRadius: 8, padding: "4px 9px", cursor: "pointer" }}><Plus size={13} /> Add</button>}
      </div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </section>
  );
}

function Entry({ children, onRemove, compact, onUp, onDown }: { children: React.ReactNode; onRemove: () => void; compact?: boolean; onUp?: () => void; onDown?: () => void }) {
  const movable = onUp !== undefined || onDown !== undefined;
  return (
    <div style={{ position: "relative", border: "1px solid var(--ezd-divider)", borderRadius: 10, padding: compact ? "10px 38px 10px 10px" : "12px 38px 12px 12px", display: "grid", gap: 8 }}>
      {children}
      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {movable && <button onClick={onUp} disabled={!onUp} title="Move up" style={entryIcon(!onUp)}><ArrowUp size={13} /></button>}
        {movable && <button onClick={onDown} disabled={!onDown} title="Move down" style={entryIcon(!onDown)}><ArrowDown size={13} /></button>}
        <button onClick={onRemove} title="Remove" style={{ display: "grid", placeItems: "center", width: 24, height: 22, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function SectionAdder({ onAdd }: { onAdd: (title: string) => void }) {
  const [sel, setSel] = useState("");
  const add = () => { if (!sel) return; onAdd(sel === "__custom__" ? "" : sel); setSel(""); };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select value={sel} onChange={(e) => setSel(e.target.value)}
        style={{ flex: 1, borderRadius: 8, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-hover)", padding: "7px 9px", color: "var(--ezd-fg)", outline: "none", fontSize: 13 }}>
        <option value="">Choose a section to add…</option>
        <option value="__custom__">✏️  Custom — write your own title</option>
        <optgroup label="Suggested sections">
          {SUGGESTED_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </optgroup>
      </select>
      <button onClick={add} disabled={!sel}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--ezd-bg-page)", background: "var(--ezd-fg-strong)", border: "none", borderRadius: 8, padding: "0 12px", cursor: sel ? "pointer" : "not-allowed", opacity: sel ? 1 : 0.5 }}>
        <Plus size={14} /> Add
      </button>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ flex: 1, minWidth: 120, display: "block" }}>
      <span style={{ display: "block", fontSize: 11, color: "var(--ezd-fg-quiet)", marginBottom: 3 }}>{label}</span>
      {children}
    </label>
  );
}

function In({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-hover)", padding: "7px 9px", color: "var(--ezd-fg)", outline: "none", fontSize: 13, opacity: disabled ? 0.5 : 1 }} />;
}

function TA({ value, onChange, placeholder, rows }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows || 3}
    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-hover)", padding: "8px 10px", color: "var(--ezd-fg)", outline: "none", fontSize: 13, resize: "vertical" }} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12.5, color: "var(--ezd-fg-quiet)", fontStyle: "italic", margin: 0 }}>{children}</p>;
}

function BulletList({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {bullets.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <GripVertical size={13} style={{ color: "var(--ezd-fg-quiet)", flexShrink: 0 }} />
          <input value={b} onChange={(e) => onChange(bullets.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder="Achievement or responsibility"
            style={{ flex: 1, borderRadius: 7, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-hover)", padding: "6px 8px", color: "var(--ezd-fg)", outline: "none", fontSize: 12.5 }} />
          <button onClick={() => onChange(bullets.filter((_, idx) => idx !== i))} style={{ color: "var(--ezd-fg-quiet)", background: "none", border: "none", cursor: "pointer" }}><X size={13} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...bullets, ""])} style={{ justifySelf: "start", fontSize: 12, color: "var(--ezd-fg-strong)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ bullet</button>
    </div>
  );
}

function TagInput({ items, onChange, placeholder }: { items: string[]; onChange: (s: string[]) => void; placeholder?: string }) {
  const [val, setVal] = useState("");
  const add = () => { const v = val.trim(); if (v && !items.includes(v)) onChange([...items, v]); setVal(""); };
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: items.length ? 8 : 0 }}>
        {items.map((s, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, padding: "3px 8px", borderRadius: 99, background: "var(--ezd-bg-hover)", border: "1px solid var(--ezd-divider)", color: "var(--ezd-fg)" }}>
            {s}<button onClick={() => onChange(items.filter((_, idx) => idx !== i))} style={{ color: "var(--ezd-fg-quiet)", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}><X size={12} /></button>
          </span>
        ))}
      </div>
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} onBlur={add}
        style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-hover)", padding: "7px 9px", color: "var(--ezd-fg)", outline: "none", fontSize: 13 }} />
    </div>
  );
}

function PhotoField({ url, onSet }: { url?: string; onSet: (u: string | undefined) => void }) {
  const pick = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onSet(String(reader.result));
    reader.readAsDataURL(file);
  };
  return (
    <Field label="Photo">
      {url ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `#eee center/cover no-repeat url(${url})`, border: "1px solid var(--ezd-divider)" }} />
          <label style={{ fontSize: 12.5, color: "var(--ezd-fg-strong)", cursor: "pointer" }}>Replace<input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} style={{ display: "none" }} /></label>
          <button onClick={() => onSet(undefined)} style={{ fontSize: 12.5, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
        </div>
      ) : (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px dashed var(--ezd-divider)", borderRadius: 9, cursor: "pointer", fontSize: 12.5, color: "var(--ezd-fg-muted)" }}>
          <UploadCloud size={14} /> Upload a photo
          <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} style={{ display: "none" }} />
        </label>
      )}
    </Field>
  );
}

function TemplateThumb({ layout, accent, hasPhoto }: { layout: string; accent: string; hasPhoto: boolean }) {
  const bar = (w: string, o = 0.18, mt = 4) => <div style={{ height: 3, width: w, background: "#111", opacity: o, borderRadius: 2, marginTop: mt }} />;
  if (layout === "sidebar") {
    return (
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ width: 64, background: accent, padding: 10 }}>
          {hasPhoto && <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.6)", margin: "0 auto 8px" }} />}
          <div style={{ height: 3, background: "rgba(255,255,255,0.8)", borderRadius: 2 }} />
          {[60, 80, 70].map((w, i) => <div key={i} style={{ height: 2.5, width: `${w}%`, background: "rgba(255,255,255,0.5)", borderRadius: 2, marginTop: 5 }} />)}
        </div>
        <div style={{ flex: 1, padding: 12 }}>
          <div style={{ height: 7, width: "60%", background: "#111", borderRadius: 2 }} />
          <div style={{ height: 3, width: "40%", background: accent, borderRadius: 2, marginTop: 4 }} />
          {bar("90%", 0.15, 10)}{bar("85%")}{bar("88%")}{bar("70%")}
        </div>
      </div>
    );
  }
  if (layout === "modern") {
    return (
      <div style={{ height: "100%" }}>
        <div style={{ background: accent, padding: "12px 12px 10px" }}>
          <div style={{ height: 7, width: "55%", background: "#fff", borderRadius: 2 }} />
          <div style={{ height: 3, width: "35%", background: "rgba(255,255,255,0.8)", borderRadius: 2, marginTop: 4 }} />
        </div>
        <div style={{ display: "flex", gap: 10, padding: 12 }}>
          <div style={{ flex: 2 }}>{bar("95%", 0.16, 0)}{bar("90%")}{bar("92%")}{bar("80%")}</div>
          <div style={{ flex: 1 }}>{bar("100%", 0.16, 0)}{bar("90%")}{bar("85%")}</div>
        </div>
      </div>
    );
  }
  if (layout === "professional") {
    return (
      <div style={{ padding: 12, height: "100%" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: `2px solid ${accent}`, paddingBottom: 8 }}>
          {hasPhoto && <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#ddd" }} />}
          <div style={{ flex: 1 }}><div style={{ height: 6, width: "55%", background: "#111", borderRadius: 2 }} /><div style={{ height: 3, width: "35%", background: accent, borderRadius: 2, marginTop: 3 }} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <div style={{ flex: 2 }}>{bar("95%", 0.16, 0)}{bar("90%")}{bar("88%")}</div>
          <div style={{ flex: 1 }}>{bar("100%", 0.16, 0)}{bar("80%")}</div>
        </div>
      </div>
    );
  }
  // classic / minimal / compact
  const centered = layout === "classic";
  return (
    <div style={{ padding: 14, height: "100%" }}>
      <div style={{ textAlign: centered ? "center" : "left", borderBottom: layout === "compact" ? `2px solid ${accent}` : "1px solid #ddd", paddingBottom: 8 }}>
        <div style={{ height: 8, width: centered ? "60%" : "50%", margin: centered ? "0 auto" : 0, background: "#111", borderRadius: 2 }} />
        <div style={{ height: 3, width: centered ? "40%" : "30%", margin: centered ? "4px auto 0" : "4px 0 0", background: accent, borderRadius: 2 }} />
      </div>
      {bar("95%", 0.15, 10)}{bar("90%")}{bar("92%")}{bar("85%")}{bar("70%")}
    </div>
  );
}

const chip = (): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--ezd-fg-muted)", background: "var(--ezd-bg-card)", border: "1px solid var(--ezd-divider)", borderRadius: 8, padding: "6px 10px", cursor: "pointer" });
const sel = (): React.CSSProperties => ({ fontSize: 12.5, color: "var(--ezd-fg)", background: "var(--ezd-bg-card)", border: "1px solid var(--ezd-divider)", borderRadius: 8, padding: "6px 8px", outline: "none", cursor: "pointer" });
const btn = (): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" });
const iconBtn = (disabled: boolean): React.CSSProperties => ({ display: "grid", placeItems: "center", width: 26, height: 24, borderRadius: 6, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 });
const entryIcon = (disabled: boolean): React.CSSProperties => ({ display: "grid", placeItems: "center", width: 24, height: 22, borderRadius: 6, border: "1px solid var(--ezd-divider)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.35 : 1 });
