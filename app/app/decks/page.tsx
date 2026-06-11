"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { onAuthStateChange, type AppUser } from "@/lib/auth";
import { watchDeckList, deleteDeck, type DeckListItem } from "@/lib/decks";
import DeckThumbnail from "@/components/DeckThumbnail";
import Logo from "@/components/Logo";

export default function MyDecksPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
const modalRef = useRef<HTMLDivElement | null>(null);

const openConfirm = useCallback((id: string, btn: HTMLButtonElement) => {
  triggerRef.current = btn;
  setConfirmId(id);
}, []);

const closeConfirm = useCallback(() => {
  setConfirmId(null);
  triggerRef.current?.focus();
}, []);

useEffect(() => {
  if (!confirmId) return;
  const modal = modalRef.current;
  if (!modal) return;
  const focusable = modal.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first?.focus();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { closeConfirm(); return; }
    if (e.key !== "Tab") return;
    if (focusable.length === 0) { e.preventDefault(); return; }
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [confirmId, closeConfirm]);



  useEffect(() => {
    const unsub = onAuthStateChange((u) => {
      if (!u) { router.replace("/auth?redirect=/app/decks"); return; }
      if (!u.emailVerified) {
        router.replace(`/verify-email?redirect=${encodeURIComponent("/app/decks")}`);
        return;
      }
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchDeckList(user.uid, setDecks);
    return () => unsub();
  }, [user]);

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white/60 text-sm">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "var(--ezd-bg-page)" }}>
      <header className="mx-auto mb-10 flex max-w-5xl items-center justify-between">
        <Logo size="md" />
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
        >
          <Plus size={14} /> New deck
        </Link>
      </header>

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My decks</h1>
            <p className="mt-1 text-sm text-white/55">
              Everything you've created stays here. Auto-saved as you edit.
            </p>
          </div>
          <Link href="/app" className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white/80">
            <ArrowLeft size={12} /> Back
          </Link>
        </div>

        {decks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <article
                key={d.id}
                className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/30 hover:bg-white/[0.05]"
              >
                <div className="mb-3">
                  <DeckThumbnail item={d} />
                </div>
                <div className="min-h-[64px]">
                  <h3 className="line-clamp-2 text-sm font-semibold text-white">{d.title}</h3>
                  {d.subtitle && (
                    <p className="mt-1 line-clamp-1 text-xs text-white/55">{d.subtitle}</p>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
                  <span>{d.slides} slide{d.slides === 1 ? "" : "s"}</span>
                  <span>{formatRelative(d.updatedAt)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    href={`/app?id=${d.id}`}
                    className="flex-1 rounded-lg bg-white px-3 py-1.5 text-center text-xs font-medium text-black hover:bg-white/90"
                  >
                    Open
                  </Link>
                  {d.shareId && (
                    <Link
                      href={`/share/${d.shareId}`}
                      target="_blank"
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/75 hover:bg-white/10"
                      title="View public share link"
                    >
                      Link
                    </Link>
                  )}
                  <button
                    onClick={(e) => openConfirm(d.id, e.currentTarget)}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
                    aria-label="Delete this deck"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {confirmId && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={closeConfirm}
        >
          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-desc"
            className="m-4 w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
          >
            <h3 id="delete-modal-title" className="text-lg font-semibold text-white">
              Delete this deck?
            </h3>
            <p id="delete-modal-desc" className="mt-2 text-sm text-white/65">
              This can't be undone. Any public share link will also stop working.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeConfirm}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (user && confirmId) {
                    try { await deleteDeck(user.uid, confirmId); } catch { /* ignore */ }
                  }
                  closeConfirm();
                }}
                className="rounded-xl bg-red-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
      <FileText size={28} className="mx-auto mb-3 text-white/30" />
      <h2 className="text-base font-semibold text-white">No decks yet</h2>
      <p className="mt-1 text-sm text-white/55">
        Create your first deck and it'll show up here automatically.
      </p>
      <Link
        href="/app"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
      >
        <Plus size={14} /> Create a deck
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
