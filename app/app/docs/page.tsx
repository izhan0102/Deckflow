"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { onAuthStateChange, type AppUser } from "@/lib/auth";
import { watchDocList, deleteDoc, type DocListItem } from "@/lib/docStore";
import { getDocFont } from "@/lib/docFonts";
import Logo from "@/components/Logo";

export default function MyDocsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      if (!u) { router.replace("/auth?redirect=/app/docs"); return; }
      if (!u.emailVerified) { router.replace(`/verify-email?redirect=${encodeURIComponent("/app/docs")}`); return; }
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchDocList(user.uid, setDocs);
    return () => unsub();
  }, [user]);

  if (!authReady) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "var(--ezd-bg-page)" }}>
        <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between">
          <Logo size="md" />
        </header>
        <div className="mx-auto grid max-w-5xl auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "var(--ezd-bg-page)", color: "var(--ezd-fg)" }}>
      <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between">
        <Logo size="md" />
        <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>
          <Plus size={14} /> New document
        </Link>
      </header>

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--ezd-fg-strong)" }}>My docs</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>Every document you create with AI is auto-saved here.</p>
          </div>
          <Link href="/app" className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--ezd-fg-muted)" }}>
            <ArrowLeft size={12} /> Back
          </Link>
        </div>

        {docs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((d) => (
              <article key={d.id} className="group flex h-full flex-col rounded-2xl border p-4 transition hover:shadow-lg"
                style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
                <DocThumb item={d} />
                <div className="mt-3 min-h-[52px]">
                  <h3 className="line-clamp-2 text-sm font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{d.title}</h3>
                  {d.subtitle && <p className="mt-1 line-clamp-1 text-xs" style={{ color: "var(--ezd-fg-muted)" }}>{d.subtitle}</p>}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
                  <span>{d.blocks} block{d.blocks === 1 ? "" : "s"}</span>
                  <span>{formatRelative(d.updatedAt)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link href={`/docs?id=${d.id}`} className="flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>Open</Link>
                  <button onClick={() => setConfirmId(d.id)} className="rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444" }} aria-label="Delete document">
                    <Trash2 size={12} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border p-6" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}>
            <h3 className="text-base font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Delete this document?</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>This can&rsquo;t be undone.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}>Cancel</button>
              <button onClick={async () => { if (user && confirmId) { try { await deleteDoc(user.uid, confirmId); } catch { /* ignore */ } } setConfirmId(null); }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "#ef4444" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DocThumb({ item }: { item: DocListItem }) {
  const t = item.theme;
  const accent = t?.accent || "#7C5CFF";
  const bg = t?.bg || "#ffffff";
  const fg = t?.fg || "#111111";
  const headingFamily = t ? getDocFont(t.headingFontId || t.fontId).family : undefined;
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--ezd-divider)", background: bg, height: 120, padding: 14 }}>
      <div style={{ height: 5, width: 38, background: accent, borderRadius: 99 }} />
      <div style={{ marginTop: 10, fontFamily: headingFamily, color: fg, fontWeight: 800, fontSize: 15, lineHeight: 1.15, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{item.title}</div>
      <div style={{ marginTop: 8 }}>
        {[88, 96, 70].map((w, i) => <div key={i} style={{ height: 4, width: `${w}%`, background: fg, opacity: 0.18, borderRadius: 2, marginTop: 5 }} />)}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div aria-hidden className="flex h-full flex-col rounded-2xl border p-4" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      <div className="h-28 rounded-xl" style={{ background: "var(--ezd-bg-hover)" }} />
      <div className="mt-3 h-4 w-3/4 rounded" style={{ background: "var(--ezd-bg-hover)" }} />
      <div className="mt-2 h-3 w-1/2 rounded" style={{ background: "var(--ezd-bg-hover)" }} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      <FileText size={28} className="mx-auto mb-3" style={{ color: "var(--ezd-fg-quiet)" }} />
      <h2 className="text-base font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>No documents yet</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>Create your first document and it&rsquo;ll show up here automatically.</p>
      <Link href="/docs" className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}>
        <Plus size={14} /> Create a document
      </Link>
    </div>
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
