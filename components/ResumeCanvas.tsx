"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { A4, DEFAULT_SECTION_ORDER, type ResumeData } from "@/lib/resumeTypes";
import { getResumeTemplate } from "@/lib/resumeTemplates";
import { getDocFont } from "@/lib/docFonts";

const MIN_FIT = 0.55;

function range(start?: string, end?: string, current?: boolean): string {
  const s = (start || "").trim();
  const e = current ? "Present" : (end || "").trim();
  if (s && e) return `${s} — ${e}`;
  return s || e || "";
}

export default function ResumeCanvas({
  data, scale = 1, print = false, innerRef,
}: {
  data: ResumeData;
  scale?: number;
  print?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const tpl = getResumeTemplate(data.templateId);
  const body = getDocFont(data.fontId).family;
  const heading = getDocFont(data.headingFontId || data.fontId).family;
  const accent = data.accent || tpl.accent;

  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  // Padding is applied INSIDE each layout (so full-bleed sidebars/headers can
  // still reach the page edge). These are the page margins.
  const pad = tpl.layout === "minimal" ? 58 : tpl.layout === "compact" ? 36 : 46;
  // Readable base size for an A4 page (~13px ≈ 10.5pt). Density is the user's
  // manual control; auto-fit only ever SHRINKS to fit one page.
  const baseRaw = (tpl.layout === "compact" ? 12.8 : 13.6) * (data.density || 1);
  const fs = baseRaw * fit;

  // Reset to natural size whenever content/density changes, so we re-measure.
  useLayoutEffect(() => { setFit(1); }, [JSON.stringify(data), data.density, data.autoFit]); // eslint-disable-line react-hooks/exhaustive-deps
  // Measure natural content height; shrink only if it overflows the page.
  useLayoutEffect(() => {
    if (!data.autoFit || fit !== 1) return;
    const el = contentRef.current;
    if (!el) return;
    const h = el.scrollHeight;
    if (h > A4.hPx + 2) setFit(Math.max(MIN_FIT, (A4.hPx / h) * 0.99));
  }, [data.autoFit, fit]);

  const page: React.CSSProperties = {
    position: "relative", width: A4.wPx, height: A4.hPx,
    margin: "0 auto", background: "#ffffff", color: "#1a1a1a",
    fontFamily: body, fontSize: fs, lineHeight: 1.45, overflow: "hidden",
    boxShadow: print ? "none" : "0 10px 40px rgba(0,0,0,0.18)",
    transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top left",
  };

  const ctx = { data, accent, fs, heading, range, pad };
  let inner: React.ReactNode;
  switch (tpl.layout) {
    case "sidebar": inner = <SidebarLayout {...ctx} />; break;
    case "professional": inner = <ProfessionalLayout {...ctx} />; break;
    case "modern": inner = <ModernLayout {...ctx} />; break;
    case "classic": inner = <ClassicLayout {...ctx} />; break;
    case "minimal": inner = <MinimalLayout {...ctx} />; break;
    default: inner = <CompactLayout {...ctx} />; break;
  }

  return (
    <div ref={innerRef} data-resume-page style={page}>
      {/* contentRef wraps the natural-height layout so we can measure overflow */}
      <div ref={contentRef}>{inner}</div>
    </div>
  );
}

/* =========================== shared section bits =========================== */

type Ctx = { data: ResumeData; accent: string; fs: number; heading: string; range: typeof range; pad: number };

function SectionTitle({ children, accent, heading, fs, bar, color }: { children: React.ReactNode; accent: string; heading: string; fs: number; bar?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: fs * 0.6, margin: `${fs * 1.05}px 0 ${fs * 0.5}px` }}>
      <span style={{ fontFamily: heading, fontSize: fs * 1.0, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: color || accent, whiteSpace: "nowrap" }}>{children}</span>
      {bar && <span style={{ flex: 1, height: 1.5, background: accent, opacity: 0.3 }} />}
    </div>
  );
}

function hasExp(d: ResumeData) { return d.experience.some((e) => e.role || e.company); }
function hasEdu(d: ResumeData) { return d.education.some((e) => e.degree || e.school); }
function hasProj(d: ResumeData) { return d.projects.some((p) => p.name); }
function hasCerts(d: ResumeData) { return d.certifications.some((c) => c.name); }
function hasLangs(d: ResumeData) { return d.languages.some((l) => l.name); }

function ExperienceBlock({ data, accent, fs, range }: Ctx) {
  return (
    <div>
      {data.experience.filter((e) => e.role || e.company).map((e) => (
        <div key={e.id} style={{ marginBottom: fs * 0.7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontWeight: 700, color: "#111", fontSize: fs * 1.02 }}>{e.role}{e.company ? <span style={{ fontWeight: 600, color: accent }}> · {e.company}</span> : null}</span>
            <span style={{ color: "#666", fontSize: fs * 0.9, whiteSpace: "nowrap", flexShrink: 0 }}>{range(e.start, e.end, e.current)}</span>
          </div>
          {e.location && <div style={{ color: "#777", fontSize: fs * 0.88 }}>{e.location}</div>}
          {e.bullets.filter(Boolean).length > 0 && (
            <ul style={{ margin: `${fs * 0.25}px 0 0`, paddingLeft: fs * 1.2 }}>
              {e.bullets.filter(Boolean).map((b, i) => <li key={i} style={{ marginBottom: fs * 0.12, color: "#333" }}>{b}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function EducationBlock({ data, accent, fs, range }: Ctx) {
  return (
    <div>
      {data.education.filter((e) => e.degree || e.school).map((e) => (
        <div key={e.id} style={{ marginBottom: fs * 0.55 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontWeight: 700, color: "#111" }}>{e.degree}</span>
            <span style={{ color: "#666", fontSize: fs * 0.9, whiteSpace: "nowrap", flexShrink: 0 }}>{range(e.start, e.end)}</span>
          </div>
          <div style={{ color: accent, fontSize: fs * 0.95 }}>{e.school}{e.location ? <span style={{ color: "#777" }}> · {e.location}</span> : null}</div>
          {e.details && <div style={{ color: "#444", fontSize: fs * 0.92, marginTop: 2 }}>{e.details}</div>}
        </div>
      ))}
    </div>
  );
}

function ProjectsBlock({ data, accent, fs }: Ctx) {
  return (
    <div>
      {data.projects.filter((p) => p.name).map((p) => (
        <div key={p.id} style={{ marginBottom: fs * 0.45 }}>
          <span style={{ fontWeight: 700, color: "#111" }}>{p.name}</span>
          {p.link && <span style={{ color: accent, fontSize: fs * 0.88 }}> · {p.link}</span>}
          {p.description && <div style={{ color: "#444", fontSize: fs * 0.95 }}>{p.description}</div>}
        </div>
      ))}
    </div>
  );
}

function chips(items: string[], accent: string, fs: number) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <div style={{ color: "#333", fontSize: fs * 0.98, lineHeight: 1.6 }}>
      {list.map((s, i) => (
        <span key={i}>{i > 0 && <span style={{ color: accent, opacity: 0.55, margin: "0 7px" }}>·</span>}{s}</span>
      ))}
    </div>
  );
}

/** Render one ordered section (title + body) for single-column layouts. */
function renderSection(key: string, ctx: Ctx, bar: boolean) {
  const { data, accent, fs, heading } = ctx;
  const T = (l: string) => <SectionTitle accent={accent} heading={heading} fs={fs} bar={bar}>{l}</SectionTitle>;
  switch (key) {
    case "summary": return data.summary ? <p style={{ margin: `${fs * 0.6}px 0 0`, color: "#333" }}>{data.summary}</p> : null;
    case "experience": return hasExp(data) ? <div>{T("Experience")}<ExperienceBlock {...ctx} /></div> : null;
    case "projects": return hasProj(data) ? <div>{T("Projects")}<ProjectsBlock {...ctx} /></div> : null;
    case "education": return hasEdu(data) ? <div>{T("Education")}<EducationBlock {...ctx} /></div> : null;
    case "skills": return data.skills.filter(Boolean).length ? <div>{T("Skills")}{chips(data.skills, accent, fs)}</div> : null;
    case "certifications": return hasCerts(data) ? <div>{T("Certifications")}<CertsBlock {...ctx} /></div> : null;
    case "languages": return hasLangs(data) ? <div>{T("Languages")}<LanguagesBlock {...ctx} /></div> : null;
    case "interests": return data.interests.filter(Boolean).length ? <div>{T("Interests")}{chips(data.interests, accent, fs)}</div> : null;
    default: return null;
  }
}

function orderOf(data: ResumeData): string[] {
  return data.sectionOrder && data.sectionOrder.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;
}

function CertsBlock({ data, fs }: Ctx) {
  return (
    <div>
      {data.certifications.filter((c) => c.name).map((c) => (
        <div key={c.id} style={{ marginBottom: fs * 0.3 }}>
          <span style={{ fontWeight: 600, color: "#111" }}>{c.name}</span>
          {(c.issuer || c.year) && <span style={{ color: "#666", fontSize: fs * 0.9 }}> — {[c.issuer, c.year].filter(Boolean).join(", ")}</span>}
        </div>
      ))}
    </div>
  );
}

function LanguagesBlock({ data, fs }: Ctx) {
  return (
    <div>
      {data.languages.filter((l) => l.name).map((l) => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: fs * 0.22 }}>
          <span style={{ color: "#222" }}>{l.name}</span>
          {l.level && <span style={{ color: "#777", fontSize: fs * 0.9 }}>{l.level}</span>}
        </div>
      ))}
    </div>
  );
}

function contactItems(data: ResumeData): string[] {
  const c = data.contact || {};
  return [c.email, c.phone, c.location, c.website, c.linkedin, c.github].filter(Boolean) as string[];
}

function CustomBlocks({ data, accent, fs, heading, bar }: Ctx & { bar?: boolean }) {
  if (!data.custom.length) return null;
  return (
    <>
      {data.custom.filter((c) => c.title || c.items.some(Boolean)).map((c) => (
        <div key={c.id}>
          <SectionTitle accent={accent} heading={heading} fs={fs} bar={bar}>{c.title || "Section"}</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: fs * 1.2 }}>
            {c.items.filter(Boolean).map((it, i) => <li key={i} style={{ marginBottom: fs * 0.12, color: "#333" }}>{it}</li>)}
          </ul>
        </div>
      ))}
    </>
  );
}

/* ================================ layouts ================================ */

function CompactLayout(ctx: Ctx) {
  const { data, accent, fs, heading, pad } = ctx;
  return (
    <div style={{ padding: pad }}>
      <div style={{ borderBottom: `2px solid ${accent}`, paddingBottom: fs * 0.55 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
          <span style={{ fontFamily: heading, fontSize: fs * 2.0, fontWeight: 800, color: "#111", lineHeight: 1.05 }}>{data.name || "Your Name"}</span>
          <span style={{ color: "#555", fontSize: fs * 0.85, textAlign: "right", lineHeight: 1.45, maxWidth: "48%" }}>{contactItems(data).join("  •  ")}</span>
        </div>
        {data.headline && <div style={{ color: accent, fontWeight: 600, fontSize: fs * 1.05, marginTop: 3 }}>{data.headline}</div>}
      </div>
      {orderOf(data).map((key) => <div key={key}>{renderSection(key, ctx, true)}</div>)}
      <CustomBlocks {...ctx} bar />
    </div>
  );
}

function ClassicLayout(ctx: Ctx) {
  const { data, accent, fs, heading, pad } = ctx;
  return (
    <div style={{ padding: pad }}>
      <div style={{ textAlign: "center", borderBottom: "1px solid #ddd", paddingBottom: fs }}>
        <div style={{ fontFamily: heading, fontSize: fs * 2.4, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#111" }}>{data.name || "Your Name"}</div>
        {data.headline && <div style={{ color: accent, fontSize: fs * 1.05, marginTop: 4, letterSpacing: "0.05em" }}>{data.headline}</div>}
        <div style={{ color: "#666", fontSize: fs * 0.88, marginTop: 6 }}>{contactItems(data).join("   |   ")}</div>
      </div>
      {orderOf(data).map((key) => <div key={key}>{renderSection(key, ctx, true)}</div>)}
      <CustomBlocks {...ctx} bar />
    </div>
  );
}

function MinimalLayout(ctx: Ctx) {
  const { data, fs, heading, pad } = ctx;
  const ink = "#111";
  const c2 = { ...ctx, accent: ink };
  return (
    <div style={{ padding: pad }}>
      <div style={{ fontFamily: heading, fontSize: fs * 2.2, fontWeight: 700, color: "#111" }}>{data.name || "Your Name"}</div>
      {data.headline && <div style={{ color: "#555", fontSize: fs * 1.05, marginTop: 2 }}>{data.headline}</div>}
      <div style={{ color: "#777", fontSize: fs * 0.88, marginTop: 6 }}>{contactItems(data).join("   ·   ")}</div>
      {orderOf(data).map((key) => <div key={key}>{renderSection(key, c2, false)}</div>)}
      <CustomBlocks {...c2} />
    </div>
  );
}

function ModernLayout(ctx: Ctx) {
  const { data, accent, fs, heading, pad } = ctx;
  return (
    <div>
      <div style={{ background: accent, color: "#fff", padding: `${pad * 0.7}px ${pad}px` }}>
        <div style={{ fontFamily: heading, fontSize: fs * 2.3, fontWeight: 800 }}>{data.name || "Your Name"}</div>
        {data.headline && <div style={{ fontSize: fs * 1.1, opacity: 0.95 }}>{data.headline}</div>}
        <div style={{ fontSize: fs * 0.86, opacity: 0.92, marginTop: 5 }}>{contactItems(data).join("   •   ")}</div>
      </div>
      <div style={{ display: "flex", gap: fs * 1.6, padding: pad, paddingTop: fs }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          {data.summary && <p style={{ margin: 0, color: "#333" }}>{data.summary}</p>}
          {hasExp(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs}>Experience</SectionTitle><ExperienceBlock {...ctx} /></>)}
          {hasProj(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs}>Projects</SectionTitle><ProjectsBlock {...ctx} /></>)}
          <CustomBlocks {...ctx} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasEdu(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs}>Education</SectionTitle><EducationBlock {...ctx} /></>)}
          {data.skills.filter(Boolean).length > 0 && (<><SectionTitle accent={accent} heading={heading} fs={fs}>Skills</SectionTitle>{chips(data.skills, accent, fs)}</>)}
          {hasCerts(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs}>Certifications</SectionTitle><CertsBlock {...ctx} /></>)}
          {hasLangs(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs}>Languages</SectionTitle><LanguagesBlock {...ctx} /></>)}
          {data.interests.filter(Boolean).length > 0 && (<><SectionTitle accent={accent} heading={heading} fs={fs}>Interests</SectionTitle>{chips(data.interests, accent, fs)}</>)}
        </div>
      </div>
    </div>
  );
}

function SidebarLayout(ctx: Ctx) {
  const { data, accent, fs, heading } = ctx;
  const sideW = 232;
  const sp = 24;
  return (
    <div style={{ display: "flex", minHeight: A4.hPx }}>
      <div style={{ width: sideW, flexShrink: 0, background: accent, color: "#fff", padding: sp }}>
        {data.photoUrl && <div style={{ width: 116, height: 116, borderRadius: "50%", margin: "0 auto 14px", background: `#fff center/cover no-repeat url(${data.photoUrl})`, border: "3px solid rgba(255,255,255,0.5)" }} />}
        <SideTitle fs={fs} heading={heading}>Contact</SideTitle>
        <div style={{ fontSize: fs * 0.9, lineHeight: 1.6, wordBreak: "break-word" }}>
          {contactItems(data).map((c, i) => <div key={i} style={{ marginBottom: 3 }}>{c}</div>)}
        </div>
        {data.skills.filter(Boolean).length > 0 && (<><SideTitle fs={fs} heading={heading}>Skills</SideTitle><div style={{ fontSize: fs * 0.9, lineHeight: 1.7 }}>{data.skills.filter(Boolean).map((s, i) => <div key={i}>• {s}</div>)}</div></>)}
        {hasLangs(data) && (<><SideTitle fs={fs} heading={heading}>Languages</SideTitle><div style={{ fontSize: fs * 0.9, lineHeight: 1.6 }}>{data.languages.filter((l) => l.name).map((l) => <div key={l.id}>{l.name}{l.level ? ` — ${l.level}` : ""}</div>)}</div></>)}
        {data.interests.filter(Boolean).length > 0 && (<><SideTitle fs={fs} heading={heading}>Interests</SideTitle><div style={{ fontSize: fs * 0.9, lineHeight: 1.6 }}>{data.interests.filter(Boolean).map((s, i) => <div key={i}>{s}</div>)}</div></>)}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: 30 }}>
        <div style={{ fontFamily: heading, fontSize: fs * 2.2, fontWeight: 800, color: "#111", lineHeight: 1.05 }}>{data.name || "Your Name"}</div>
        {data.headline && <div style={{ color: accent, fontWeight: 600, fontSize: fs * 1.1, marginTop: 3 }}>{data.headline}</div>}
        {data.summary && <p style={{ margin: `${fs * 0.8}px 0 0`, color: "#333" }}>{data.summary}</p>}
        {hasExp(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Experience</SectionTitle><ExperienceBlock {...ctx} /></>)}
        {hasEdu(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Education</SectionTitle><EducationBlock {...ctx} /></>)}
        {hasProj(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Projects</SectionTitle><ProjectsBlock {...ctx} /></>)}
        {hasCerts(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Certifications</SectionTitle><CertsBlock {...ctx} /></>)}
        <CustomBlocks {...ctx} bar />
      </div>
    </div>
  );
}

function ProfessionalLayout(ctx: Ctx) {
  const { data, accent, fs, heading, pad } = ctx;
  return (
    <div style={{ padding: pad }}>
      <div style={{ display: "flex", alignItems: "center", gap: fs * 1.4, borderBottom: `2px solid ${accent}`, paddingBottom: fs }}>
        {data.photoUrl && <div style={{ width: 80, height: 80, borderRadius: "50%", flexShrink: 0, background: `#eee center/cover no-repeat url(${data.photoUrl})` }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: heading, fontSize: fs * 2.1, fontWeight: 800, color: "#111" }}>{data.name || "Your Name"}</div>
          {data.headline && <div style={{ color: accent, fontWeight: 600, fontSize: fs * 1.1 }}>{data.headline}</div>}
          <div style={{ color: "#666", fontSize: fs * 0.86, marginTop: 4 }}>{contactItems(data).join("   •   ")}</div>
        </div>
      </div>
      {data.summary && <p style={{ margin: `${fs * 0.8}px 0 0`, color: "#333" }}>{data.summary}</p>}
      <div style={{ display: "flex", gap: fs * 1.8 }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          {hasExp(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Experience</SectionTitle><ExperienceBlock {...ctx} /></>)}
          {hasProj(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Projects</SectionTitle><ProjectsBlock {...ctx} /></>)}
          <CustomBlocks {...ctx} bar />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {data.skills.filter(Boolean).length > 0 && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Skills</SectionTitle>{chips(data.skills, accent, fs)}</>)}
          {hasEdu(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Education</SectionTitle><EducationBlock {...ctx} /></>)}
          {hasCerts(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Certifications</SectionTitle><CertsBlock {...ctx} /></>)}
          {hasLangs(data) && (<><SectionTitle accent={accent} heading={heading} fs={fs} bar>Languages</SectionTitle><LanguagesBlock {...ctx} /></>)}
        </div>
      </div>
    </div>
  );
}

function SideTitle({ children, fs, heading }: { children: React.ReactNode; fs: number; heading: string }) {
  return <div style={{ fontFamily: heading, fontSize: fs * 0.98, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", margin: `${fs}px 0 ${fs * 0.4}px`, borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: 3 }}>{children}</div>;
}
