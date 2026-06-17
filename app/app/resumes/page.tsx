"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { onAuthStateChange, type AppUser } from "@/lib/auth";
import { watchResumeList, deleteResume, type ResumeListItem } from "@/lib/resumeStore";
import { getResumeTemplate } from "@/lib/resumeTemplates";
import Logo from "@/components/Logo";

export default function MyResumesPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      if (!u) { router.replace("/auth?redirect=/app/resumes"); return; }
      if (!u.emailVerified) { router.replace(`/verify-email?redirect=${encodeURIComponent("/app/resumes")}`); return; }
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchResumeList(user.uid, setResumes);
    return () => unsub();
  }, [user]);

  if (!authReady) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "var(--ezd-bg-page)" }}>
        <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between"><Logo size="md" /></header>
        <div className="mx-auto grid max-w-5xl auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl border" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }} />)}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between">
        <Logo size="md" />
        <Link href="/resume" className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>
          <Plus size={14} /> New resume
        </Link>
      </header>

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>My resumes</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>Every resume you build is auto-saved here.</p>
          </div>
          <Link href="/app" className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ezd-fg-muted)" }}><ArrowLeft size={12} /> Back</Link>
        </div>

        {resumes.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
            <FileText size={28} className="mx-auto mb-3" style={{ color: "var(--ezd-fg-quiet)" }} />
            <h2 className="text-base font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>No resumes yet</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>Build your first resume and it&rsquo;ll show up here.</p>
            <Link href="/resume" className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>
              <Plus size={14} /> Create a resume
            </Link>
          </div>
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((d) => {
              const tpl = d.templateId ? getResumeTemplate(d.templateId) : null;
              return (
                <article key={d.id} className="group flex h-full flex-col rounded-2xl border p-4 transition hover:shadow-lg" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-lg" style={{ background: d.accent || "#2563eb" }} />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{d.name || "Untitled resume"}</h3>
                      {d.headline && <p className="truncate text-xs" style={{ color: "var(--ezd-fg-muted)" }}>{d.headline}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
                    <span>{tpl?.name || "Resume"}</span>
                    <span>{formatRelative(d.updatedAt)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Link href={`/resume?id=${d.id}`} className="flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>Open</Link>
                    <button onClick={() => setConfirmId(d.id)} className="rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444" }} aria-label="Delete resume"><Trash2 size={12} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border p-6" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
            <h3 className="text-base font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Delete this resume?</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>This can&rsquo;t be undone.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}>Cancel</button>
              <button onClick={async () => { if (user && confirmId) { try { await deleteResume(user.uid, confirmId); } catch { /* ignore */ } } setConfirmId(null); }} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "#ef4444" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function formatRelative(ts: number): string {
  if (!ts) return "just now";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}
