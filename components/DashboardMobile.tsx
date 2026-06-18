"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Clock, FileText, LayoutGrid, Loader2, LogOut, Monitor, Search,
  Trash2, Wand2, X, Zap, Copy,
} from "lucide-react";
import { type AppUser } from "@/lib/auth";
import { deleteDeck, duplicateDeck, watchDeckList, type DeckListItem } from "@/lib/decks";
import DeckThumbnail from "./DeckThumbnail";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import UpgradeDialog from "./UpgradeDialog";
import { watchMonthlyGenerations, formatMonthlyResetIn } from "@/lib/usage";
import { watchUserPlan, getUserPlan } from "@/lib/plan";
import { type PlanId, planDeckLimit, getPlan, FREE_FOR_ALL } from "@/lib/plans";

/**
 * Mobile-first dashboard. Same data + actions as the desktop Dashboard, but
 * a single-column, touch-friendly layout: a top app bar, a quota chip, a
 * prominent "New deck" action, search, and a stacked deck list.
 *
 * `onSwitchToDesktop` lets the user flip back to the full desktop UI.
 */
type Props = {
  user: AppUser;
  onStartFromScratch: () => void;
  onStartFromTemplate?: () => void;
  onSignOut: () => void | Promise<void>;
  onSwitchToDesktop: () => void;
};

export default function DashboardMobile({
  user, onStartFromScratch, onStartFromTemplate, onSignOut, onSwitchToDesktop,
}: Props) {
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [monthGenerations, setMonthGenerations] = useState(0);
  const [plan, setPlan] = useState<PlanId>("free");
  const [menuOpen, setMenuOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (FREE_FOR_ALL) return; // paywall dropped: never auto-open the plan popup
    let cancelled = false;
    getUserPlan(user.uid).then((p) => {
      if (!cancelled && p === "free") setUpgradeOpen(true);
    });
    return () => { cancelled = true; };
  }, [user.uid]);

  useEffect(() => {
    const unsub = watchUserPlan(user.uid, setPlan);
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    const unsub = watchDeckList(user.uid, (items) => { setDecks(items); setLoading(false); });
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    const unsub = watchMonthlyGenerations(user.uid, setMonthGenerations);
    return () => unsub();
  }, [user.uid]);

  const recentDeck = useMemo(() => {
    const top = decks[0];
    if (!top) return null;
    const ageHours = (Date.now() - (top.updatedAt || 0)) / 36e5;
    return ageHours > 24 * 7 ? null : top;
  }, [decks]);

  const visibleDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decks.filter((d) =>
      !q || `${d.title} ${d.subtitle ?? ""}`.toLowerCase().includes(q),
    );
  }, [decks, query]);

  const deckLimit = planDeckLimit(plan);
  const unlimited = deckLimit === Infinity;
  const remaining = unlimited ? Infinity : Math.max(0, deckLimit - monthGenerations);
  const quotaExhausted = !unlimited && remaining === 0;

  const openUpgrade = (reason?: string) => { setUpgradeReason(reason); setUpgradeOpen(true); };
  const onNewDeck = () => {
    if (quotaExhausted) {
      openUpgrade(`You've used all ${deckLimit} decks on the ${getPlan(plan).name} plan this month.`);
      return;
    }
    onStartFromScratch();
  };

  const onNewDoc = () => {
    if (!FREE_FOR_ALL && plan === "free") {
      openUpgrade("AI Documents are a Pro feature. Upgrade to Pro to create documents.");
      return;
    }
    window.location.assign("/docs");
  };

  const onNewResume = () => { window.location.assign("/resume"); };

  const [duplicating, setDuplicating] = useState(false);
  const onDuplicate = async (id: string) => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      await duplicateDeck(user.uid, id);
    } catch (err) {
      alert("Failed to duplicate deck");
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--ezd-bg-page)" }}>
      {/* ---------- Top app bar ---------- */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 backdrop-blur"
        style={{ background: "var(--ezd-nav-bg)" }}
      >
        <Logo size="sm" />
        <div className="flex items-center gap-1.5">
          <ThemeToggle variant="compact" />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/5 text-sm font-semibold text-white"
          >
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      {/* ---------- Slide-down account menu ---------- */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute right-3 top-14 w-60 overflow-hidden rounded-2xl border border-white/12 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2">
              <div className="truncate text-sm font-medium text-white">{user.name || user.email?.split("@")[0]}</div>
              <div className="truncate text-[11px] text-white/50">{user.email}</div>
            </div>
            <Link href="/app/decks" className="block rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10">My decks</Link>
            <Link href="/about" className="block rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10">About / Dev&rsquo;s note</Link>
            {!FREE_FOR_ALL && (
            <button
              onClick={() => { setMenuOpen(false); openUpgrade(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
            >
              <Zap size={14} /> Upgrade plan
            </button>
            )}
            <button
              onClick={() => { setMenuOpen(false); onSwitchToDesktop(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
            >
              <Monitor size={14} /> Switch to desktop mode
            </button>
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/10"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      )}

      <main className="px-4 pb-24 pt-5">
        {/* ---------- Greeting + quota ---------- */}
        <h1
          className="text-[24px] font-semibold tracking-tight text-white"
          style={{ fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', letterSpacing: "-0.018em" }}
        >
          {firstName(user)}&rsquo;s decks
        </h1>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[12px] text-white/70">
          <Zap size={12} className={quotaExhausted ? "text-red-300" : "text-cyan-300"} />
          {unlimited
            ? `${getPlan(plan).name} · unlimited decks`
            : quotaExhausted
              ? `Limit used · resets in ${formatMonthlyResetIn()}`
              : `${remaining} of ${deckLimit} decks left this month`}
        </div>

        {/* ---------- Primary actions ---------- */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            onClick={onNewDeck}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-3.5 text-[14px] font-semibold text-[#03070F] transition active:scale-[0.98]"
          >
            <Wand2 size={15} /> New deck
          </button>
          <button
            onClick={onStartFromTemplate ?? onStartFromScratch}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-[14px] text-white/85 transition active:scale-[0.98]"
          >
            <LayoutGrid size={14} /> Templates
          </button>
        </div>

        <button
          onClick={onNewDoc}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-[14px] font-semibold text-white/85 transition active:scale-[0.98]"
        >
          <FileText size={15} /> New document
        </button>

        <button
          onClick={onNewResume}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-[14px] font-semibold text-white/85 transition active:scale-[0.98]"
        >
          <FileText size={15} /> New resume
        </button>

        {/* ---------- Continue working ---------- */}
        {recentDeck && (
          <Link
            href={`/app?id=${recentDeck.id}`}
            className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/[0.02] to-transparent p-3 active:scale-[0.99]"
          >
            <div className="w-[96px] shrink-0">
              <DeckThumbnail item={recentDeck} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                <Clock size={10} /> Continue
              </div>
              <h3 className="mt-1 line-clamp-1 text-[14px] font-semibold text-white">{recentDeck.title}</h3>
              <div className="mt-0.5 text-[11px] text-white/55">
                {recentDeck.slides} slide{recentDeck.slides === 1 ? "" : "s"} · {formatRelative(recentDeck.updatedAt)}
              </div>
            </div>
            <ArrowRight size={16} className="text-white/45" />
          </Link>
        )}

        {/* ---------- Search ---------- */}
        {decks.length > 0 && (
          <div className="mt-6">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search decks…"
                className="w-full rounded-full border border-white/10 bg-black/40 py-2.5 pl-9 pr-9 text-[13px] text-white outline-none transition focus:border-white/30"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full text-white/40"
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              )}
            </label>
          </div>
        )}

        {/* ---------- Deck list ---------- */}
        <div className="mt-4">
          {loading ? (
            <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] p-12">
              <Loader2 size={20} className="animate-spin text-white/45" />
            </div>
          ) : decks.length === 0 ? (
            <MobileEmpty onCreate={onStartFromScratch} />
          ) : visibleDecks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <Search size={20} className="mx-auto mb-3 text-white/30" />
              <p className="text-sm text-white/65">No decks match that search.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleDecks.map((d) => (
                <MobileDeckCard key={d.id} deck={d} onAskDelete={() => setConfirmId(d.id)} onDuplicate={() => onDuplicate(d.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Pricing / upgrade modal — shown on every visit and on limits */}
      {upgradeOpen && (
        <UpgradeDialog
          currentPlan={plan}
          reason={upgradeReason}
          onClose={() => setUpgradeOpen(false)}
          email={user.email}
        />
      )}

      {/* Delete confirm */}
      {confirmId && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={() => setConfirmId(null)}>
          <div className="m-3 w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white">Delete this deck?</h3>
            <p className="mt-2 text-sm text-white/65">This can&rsquo;t be undone. Any public share link will also stop working.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/85">Cancel</button>
              <button
                onClick={async () => {
                  if (confirmId) { try { await deleteDeck(user.uid, confirmId); } catch { /* ignore */ } }
                  setConfirmId(null);
                }}
                className="rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicating && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader2 size={32} className="animate-spin text-white" />
          <p className="mt-2 text-sm font-medium text-white">Duplicating deck...</p>
        </div>
      )}
    </div>
  );
}

function MobileDeckCard({ deck, onDuplicate, onAskDelete }: { deck: DeckListItem; onDuplicate: () => void; onAskDelete: () => void }) {
  return (
    <article className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="w-[110px] shrink-0">
        <DeckThumbnail item={deck} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 text-[14px] font-semibold text-white">{deck.title}</h3>
        <div className="mt-1 text-[11px] text-white/50">
          {deck.slides} slide{deck.slides === 1 ? "" : "s"} · {formatRelative(deck.updatedAt)}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Link href={`/app?id=${deck.id}`} className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-xs font-medium text-black">Open</Link>
          {deck.shareId && (
            <Link href={`/share/${deck.shareId}`} target="_blank" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">Share</Link>
          )}
          <button
            onClick={onDuplicate}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-white/75"
            aria-label="Duplicate deck"
          >
            <Copy size={13} />
          </button>
          <button
            onClick={onAskDelete}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-red-200"
            aria-label="Delete deck"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}

function MobileEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-10 text-center">
      <h3
        className="text-[20px] font-semibold tracking-tight text-white"
        style={{ fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', letterSpacing: "-0.02em" }}
      >
        Make your first deck
      </h3>
      <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-white/55">
        Type a one-line brief and EXdeck builds a full, editable deck in about ten seconds.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-6 py-3 text-[13px] font-semibold text-[#03070F]"
      >
        <Wand2 size={14} /> Create a deck
      </button>
    </div>
  );
}

function firstName(u: AppUser): string {
  if (u.name) return u.name.split(/\s+/)[0];
  if (u.email) return u.email.split("@")[0];
  return "there";
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
