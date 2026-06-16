"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Clock, Copy, FileText, Home, Info, LayoutGrid,
  LogOut, MoreVertical, Pencil, Plus, Search, Share2, Sparkles, Trash2, Wand2, X, Zap,
} from "lucide-react";
import { type AppUser } from "@/lib/auth";
import {
  deleteDeck, duplicateDeck, renameDeck, watchDeckList, type DeckListItem,
} from "@/lib/decks";
import DeckThumbnail from "./DeckThumbnail";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import UpgradeDialog from "./UpgradeDialog";
import ReportDialog from "./ReportDialog";
import { watchMonthlyGenerations, formatMonthlyResetIn } from "@/lib/usage";
import { watchUserPlan, getUserPlan } from "@/lib/plan";
import { type PlanId, planDeckLimit, getPlan, FREE_FOR_ALL } from "@/lib/plans";

/**
 * Dashboard shown on /app (desktop).
 *
 * Token-driven (var(--ezd-*)) so it adapts cleanly to light/dark, matching
 * the landing. Sidebar carries the brand, nav, ONE combined plan-and-usage
 * card, and the user/account block. The main area is a header, an optional
 * "continue working" card (deduped from the grid), and the decks grid with
 * working search, skeleton loading, and per-card actions (open, share,
 * rename, duplicate, delete).
 */

type Props = {
  user: AppUser;
  onStartFromScratch: () => void;
  onStartFromTemplate?: () => void;
  onSignOut: () => void | Promise<void>;
};

const RED = "rgba(239,68,68,1)";
const RED_SOFT = "rgba(239,68,68,0.12)";
const RED_BORDER = "rgba(239,68,68,0.40)";

export default function Dashboard({
  user, onStartFromScratch, onStartFromTemplate, onSignOut,
}: Props) {
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [query, setQuery] = useState("");
  const [monthGenerations, setMonthGenerations] = useState(0);
  const [plan, setPlan] = useState<PlanId>("free");

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  const [reportOpen, setReportOpen] = useState(false);

  // Pricing modal once per dashboard mount — only for free users.
  useEffect(() => {
    if (FREE_FOR_ALL) return; // paywall dropped: never auto-open the plan popup
    let cancelled = false;
    getUserPlan(user.uid).then((p) => {
      if (!cancelled && p === "free") {
        setUpgradeReason(undefined);
        setUpgradeOpen(true);
      }
    });
    return () => { cancelled = true; };
  }, [user.uid]);

  useEffect(() => {
    const unsub = watchUserPlan(user.uid, setPlan);
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    const unsub = watchDeckList(user.uid, (items) => {
      setDecks(items);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    const unsub = watchMonthlyGenerations(user.uid, setMonthGenerations);
    return () => unsub();
  }, [user.uid]);

  /* ----------------------------- derived ----------------------------- */

  const deckLimit = planDeckLimit(plan);
  const limitReached = monthGenerations >= deckLimit;

  const openUpgrade = (reason?: string) => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  };

  const onNewDeck = () => {
    if (limitReached) {
      openUpgrade(`You've used all ${deckLimit} decks on the ${getPlan(plan).name} plan this month.`);
      return;
    }
    onStartFromScratch();
  };

  const recentDeck = useMemo(() => {
    const top = decks[0];
    if (!top) return null;
    const ageHours = (Date.now() - (top.updatedAt || 0)) / 36e5;
    if (ageHours > 24 * 7) return null;
    return top;
  }, [decks]);

  const visibleDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((d) =>
      `${d.title} ${d.subtitle ?? ""}`.toLowerCase().includes(q),
    );
  }, [decks, query]);

  const hasQuery = query.trim().length > 0;
  // Continue card only shows when not searching; the grid then excludes that
  // deck so it never appears twice (#6).
  const showContinue = !!recentDeck && !hasQuery;
  const gridSource = showContinue
    ? visibleDecks.filter((d) => d.id !== recentDeck!.id)
    : visibleDecks;
  // When searching, show ALL matches; otherwise a recent preview of 9 (#3).
  const gridDecks = hasQuery ? gridSource : gridSource.slice(0, 9);

  const onDuplicate = async (id: string) => {
    try { await duplicateDeck(user.uid, id); } catch { /* live watcher will reflect */ }
  };

  return (
    <div className="min-h-screen lg:pl-[264px]">
      {/* ============== Sidebar ============== */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r p-5 backdrop-blur lg:flex"
        style={{ background: "var(--ezd-nav-bg)", borderColor: "var(--ezd-divider)" }}
      >
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <ThemeToggle variant="compact" />
        </div>

        <nav className="mt-8 space-y-1 text-sm">
          <NavItem icon={<Home size={15} />} label="Dashboard" active />
          <NavItem icon={<FileText size={15} />} label="My decks" href="/app/decks" count={decks.length || undefined} />
          <NavItem icon={<LayoutGrid size={15} />} label="Templates" onClick={onStartFromTemplate} />
          <NavItem icon={<Info size={15} />} label="About / Dev's note" href="/about" />
        </nav>

        {/* Combined plan + usage (#2) */}
        <div className="mt-6">
          <PlanUsageCard used={monthGenerations} plan={plan} onUpgrade={() => openUpgrade()} />
        </div>

        {/* Bottom-anchored account block */}
        <div className="mt-auto space-y-2.5">
          <div
            className="rounded-2xl border p-3"
            style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold"
                style={{ background: "var(--ezd-fg-strong)", color: "var(--ezd-bg-page)" }}
              >
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium" style={{ color: "var(--ezd-fg-strong)" }}>
                  {user.name || user.email?.split("@")[0]}
                </div>
                <div className="truncate text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>{user.email}</div>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] transition hover:opacity-80"
              style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>

          <button
            onClick={() => setReportOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition hover:brightness-110"
            style={{ borderColor: RED_BORDER, background: RED_SOFT, color: RED }}
          >
            <AlertTriangle size={13} /> Report an issue
          </button>
        </div>
      </aside>

      {/* ============== Main ============== */}
      <main className="px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        {upgradeOpen && (
          <UpgradeDialog
            currentPlan={plan}
            reason={upgradeReason}
            onClose={() => setUpgradeOpen(false)}
            email={user.email}
          />
        )}

        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          username={user.name || user.email?.split("@")[0] || "Anonymous"}
        />

        {/* Mobile header */}
        <div className="mb-6 flex items-center justify-between lg:hidden">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <ThemeToggle variant="compact" />
            <button
              onClick={onSignOut}
              className="rounded-full border px-3 py-1 text-xs transition hover:opacity-80"
              style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}
            >
              <LogOut size={11} className="mr-1 inline" /> Sign out
            </button>
          </div>
        </div>

        {/* ---------- Header ---------- */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-[26px] font-semibold tracking-tight md:text-[32px]"
              style={{
                fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
                letterSpacing: "-0.022em",
                color: "var(--ezd-fg-strong)",
              }}
            >
              {firstName(user)}&rsquo;s decks
            </h1>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>
              {decks.length === 0
                ? "Nothing here yet — create your first deck."
                : `${decks.length} deck${decks.length === 1 ? "" : "s"} · auto-saved as you edit.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onNewDeck}
              data-tour="start-from-scratch"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
              style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
              title={limitReached ? `Monthly limit reached. Resets in ${formatMonthlyResetIn()}.` : "Start from a one-line brief"}
            >
              <Wand2 size={13} /> New deck
            </button>
            <button
              onClick={onStartFromTemplate ?? onStartFromScratch}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] transition hover:opacity-80"
              style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}
            >
              <LayoutGrid size={12} /> Templates
            </button>
          </div>
        </div>

        {/* ---------- Continue working (#6: excluded from grid) ---------- */}
        {showContinue && recentDeck && <ContinueCard deck={recentDeck} />}

        {/* ---------- Decks header + search ---------- */}
        {decks.length > 0 && (hasQuery || gridDecks.length > 0) && (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t pt-6"
            style={{ borderColor: "var(--ezd-divider)" }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.26em]" style={{ color: "var(--ezd-fg-quiet)" }}>
              {hasQuery ? `${gridDecks.length} result${gridDecks.length === 1 ? "" : "s"}` : "All decks"}
            </div>
            <div className="flex items-center gap-2">
              <SearchInput value={query} onChange={setQuery} />
              {!hasQuery && (
                <Link
                  href="/app/decks"
                  className="hidden text-[12px] transition hover:opacity-80 sm:inline"
                  style={{ color: "var(--ezd-fg-muted)" }}
                >
                  See all →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ---------- Decks grid ----------
            NoMatch only renders while searching. With no query we always show
            decks (the continue card covers the most-recent one). */}
        {loading ? (
          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : decks.length === 0 ? (
          <EmptyState onCreate={onStartFromScratch} onTemplates={onStartFromTemplate} />
        ) : hasQuery && gridDecks.length === 0 ? (
          <NoMatchState onClear={() => setQuery("")} />
        ) : gridDecks.length > 0 ? (
          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gridDecks.map((d) => (
              <DeckCard
                key={d.id}
                deck={d}
                onRename={() => setRenameTarget({ id: d.id, title: d.title })}
                onDuplicate={() => onDuplicate(d.id)}
                onAskDelete={() => setConfirmId(d.id)}
              />
            ))}
          </div>
        ) : null}
      </main>

      {/* Delete confirm (#7: Esc + backdrop close) */}
      {confirmId && (
        <Modal onClose={() => setConfirmId(null)}>
          <h3 className="text-base font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Delete this deck?</h3>
          <p className="mt-2 text-sm" style={{ color: "var(--ezd-fg-muted)" }}>
            This can&rsquo;t be undone. Any public share link will also stop working.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmId(null)}
              className="rounded-xl border px-4 py-2 text-sm transition hover:opacity-80"
              style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const id = confirmId;
                setConfirmId(null);
                if (id) { try { await deleteDeck(user.uid, id); } catch { /* ignore */ } }
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: RED }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* Rename (#9) */}
      {renameTarget && (
        <RenameModal
          initial={renameTarget.title}
          onClose={() => setRenameTarget(null)}
          onSave={async (name) => {
            const target = renameTarget;
            setRenameTarget(null);
            if (target) { try { await renameDeck(user.uid, target.id, name); } catch { /* ignore */ } }
          }}
        />
      )}
    </div>
  );
}

/* =====================================================================
 *                            Subcomponents
 * ===================================================================== */

function NavItem({
  icon, label, href, onClick, active, count,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  count?: number;
}) {
  const className = "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition";
  const style: React.CSSProperties = active
    ? { background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }
    : { color: "var(--ezd-fg-muted)" };
  const inner = (
    <>
      <span className="flex items-center gap-2.5">{icon}{label}</span>
      {typeof count === "number" && (
        <span
          className="rounded-full border px-1.5 text-[10px] tabular-nums"
          style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-muted)" }}
        >
          {count}
        </span>
      )}
    </>
  );
  if (href) return <Link href={href} className={`${className} hover:opacity-80`} style={style}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${className} hover:opacity-80`} style={style}>{inner}</button>;
  return <div className={className} style={style}>{inner}</div>;
}

/* ----------------------- Combined plan + usage card ----------------------- */

function PlanUsageCard({ used, plan, onUpgrade }: { used: number; plan: PlanId; onUpgrade: () => void }) {
  const limit = planDeckLimit(plan);
  const unlimited = limit === Infinity;
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  const exhausted = !unlimited && remaining === 0;
  const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100);

  const [resetIn, setResetIn] = useState(formatMonthlyResetIn());
  useEffect(() => {
    const id = window.setInterval(() => setResetIn(formatMonthlyResetIn()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const planName = getPlan(plan).name;
  const ctaLabel = plan === "free" ? "Upgrade" : plan === "pro" ? "Go Pro Plus" : "View plans";

  return (
    <div
      className="rounded-2xl border p-3.5"
      style={{ borderColor: exhausted ? RED_BORDER : "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ezd-fg-quiet)" }}>
          <Zap size={11} style={{ color: exhausted ? RED : "var(--ezd-fg-muted)" }} />
          {planName} plan
        </span>
        <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: exhausted ? RED : "var(--ezd-fg-strong)" }}>
          {unlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>

      <div className="mt-2 text-[11px] leading-snug" style={{ color: "var(--ezd-fg-muted)" }}>
        {unlimited
          ? "Unlimited decks — everything unlocked."
          : exhausted
            ? "All decks used this month."
            : `${remaining} deck${remaining === 1 ? "" : "s"} left this month.`}
      </div>

      {!unlimited ? (
        <>
          <div className="mt-2.5 h-[4px] w-full overflow-hidden rounded-full" style={{ background: "var(--ezd-bg-hover)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: exhausted ? RED : "var(--ezd-fg-strong)" }}
            />
          </div>
          <div className="mt-1 text-[10px]" style={{ color: "var(--ezd-fg-quiet)" }}>Resets in {resetIn}</div>
        </>
      ) : (
        <div className="mt-2.5 inline-flex items-center gap-1.5 text-[10.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>
          <Sparkles size={11} /> No monthly limit
        </div>
      )}

      <button
        onClick={onUpgrade}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-90"
        style={
          exhausted
            ? { background: RED, color: "#fff" }
            : { background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }
        }
        hidden={FREE_FOR_ALL}
      >
        <Sparkles size={12} /> {exhausted ? "Upgrade for more" : ctaLabel}
      </button>
    </div>
  );
}

/* ----------------------------- Continue card ----------------------------- */

function ContinueCard({ deck }: { deck: DeckListItem }) {
  return (
    <Link
      href={`/app?id=${deck.id}`}
      className="group mb-6 flex items-center gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5"
      style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
    >
      <div className="hidden w-[150px] shrink-0 sm:block">
        <DeckThumbnail item={deck} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--ezd-fg-muted)" }}>
          <Clock size={11} /> Continue working
        </div>
        <h3 className="mt-1.5 line-clamp-1 text-base font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
          {deck.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: "var(--ezd-fg-quiet)" }}>
          <span>{deck.slides} slide{deck.slides === 1 ? "" : "s"}</span>
          <Sep />
          <span>{formatRelative(deck.updatedAt)}</span>
        </div>
      </div>
      <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" style={{ color: "var(--ezd-fg-muted)" }} />
    </Link>
  );
}

/* ----------------------------- Search ----------------------------- */

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative">
      <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ezd-fg-quiet)" }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search decks…"
        className="w-44 rounded-full border py-1.5 pl-8 pr-7 text-[12px] outline-none transition focus:border-white/30 sm:w-60"
        style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full transition hover:opacity-70"
          style={{ color: "var(--ezd-fg-quiet)" }}
          aria-label="Clear search"
        >
          <X size={10} />
        </button>
      )}
    </label>
  );
}

/* ----------------------------- Deck card ----------------------------- */

function DeckCard({
  deck, onRename, onDuplicate, onAskDelete,
}: {
  deck: DeckListItem;
  onRename: () => void;
  onDuplicate: () => void;
  onAskDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);

  return (
    <article
      className="group relative flex h-full flex-col rounded-2xl border p-4 transition hover:-translate-y-0.5"
      style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
    >
      <div className="mb-3">
        <DeckThumbnail item={deck} />
      </div>

      <div className="min-h-[58px]">
        <h3 className="line-clamp-2 text-sm font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>{deck.title}</h3>
        {deck.subtitle && (
          <p className="mt-1 line-clamp-1 text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>{deck.subtitle}</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
        <span>{deck.slides} slide{deck.slides === 1 ? "" : "s"}</span>
        <span>{formatRelative(deck.updatedAt)}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/app?id=${deck.id}`}
          className="flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition hover:opacity-90"
          style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
        >
          Open
        </Link>
        <button
          onClick={() => setMenu((m) => !m)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition hover:opacity-80"
          style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}
          aria-label="Deck actions"
          aria-haspopup="menu"
          aria-expanded={menu}
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Action menu */}
      {menu && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setMenu(false)} aria-hidden />
          <div
            role="menu"
            className="absolute bottom-14 right-3 z-[50] w-44 overflow-hidden rounded-xl border py-1 shadow-2xl"
            style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-elev)" }}
          >
            {deck.shareId && (
              <a
                href={`/share/${deck.shareId}`}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                onClick={() => setMenu(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-[12.5px] transition hover:opacity-80"
                style={{ color: "var(--ezd-fg-strong)" }}
              >
                <Share2 size={13} /> Open share link
              </a>
            )}
            <button
              role="menuitem"
              onClick={() => { setMenu(false); onRename(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition hover:opacity-80"
              style={{ color: "var(--ezd-fg-strong)" }}
            >
              <Pencil size={13} /> Rename
            </button>
            <button
              role="menuitem"
              onClick={() => { setMenu(false); onDuplicate(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition hover:opacity-80"
              style={{ color: "var(--ezd-fg-strong)" }}
            >
              <Copy size={13} /> Duplicate
            </button>
            <div className="my-1 h-px" style={{ background: "var(--ezd-divider)" }} />
            <button
              role="menuitem"
              onClick={() => { setMenu(false); onAskDelete(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition hover:brightness-110"
              style={{ color: RED }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </>
      )}
    </article>
  );
}

/* ----------------------------- Skeleton card ----------------------------- */

function SkeletonCard() {
  return (
    <div
      className="flex h-full flex-col rounded-2xl border p-4"
      style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}
    >
      <div className="ezd-shimmer mb-3 w-full rounded-xl" style={{ aspectRatio: "16 / 9", background: "var(--ezd-bg-hover)" }} />
      <div className="ezd-shimmer h-3.5 w-3/4 rounded" style={{ background: "var(--ezd-bg-hover)" }} />
      <div className="ezd-shimmer mt-2 h-3 w-1/2 rounded" style={{ background: "var(--ezd-bg-hover)" }} />
      <div className="mt-auto flex gap-2 pt-4">
        <div className="ezd-shimmer h-7 flex-1 rounded-lg" style={{ background: "var(--ezd-bg-hover)" }} />
        <div className="ezd-shimmer h-7 w-8 rounded-lg" style={{ background: "var(--ezd-bg-hover)" }} />
      </div>
      <style jsx>{`
        .ezd-shimmer { position: relative; overflow: hidden; }
        .ezd-shimmer::after {
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(100deg, transparent 30%, rgba(128,128,128,0.18) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: ezd-shimmer 1.4s infinite linear;
        }
        @keyframes ezd-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}

/* ----------------------------- Empty / no-match ----------------------------- */

function EmptyState({ onCreate, onTemplates }: { onCreate: () => void; onTemplates?: () => void }) {
  const examples = [
    "Series A pitch for a logistics platform",
    "Intro lecture on transformer architectures",
    "Q1 investor update for an early-stage SaaS",
  ];
  return (
    <div className="rounded-3xl border px-6 py-10 sm:px-10 sm:py-12" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <h3
          className="text-[22px] font-semibold tracking-tight sm:text-[26px]"
          style={{ fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', letterSpacing: "-0.02em", color: "var(--ezd-fg-strong)" }}
        >
          Make your first presentation
        </h3>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
          Type a one-line brief and EXdeck assembles a full, editable deck in about ten seconds. Specific beats long. Try one of these:
        </p>

        <div className="mt-6 flex w-full max-w-md flex-col gap-2">
          {examples.map((e) => (
            <button
              key={e}
              onClick={onCreate}
              className="group flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-[12.5px] transition hover:-translate-y-0.5"
              style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-muted)" }}
            >
              <span className="flex items-center gap-2.5">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--ezd-fg-strong)", opacity: 0.55 }} />
                {e}
              </span>
              <ArrowRight size={13} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--ezd-fg-quiet)" }} />
            </button>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[12.5px] font-semibold transition hover:opacity-90"
            style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
          >
            <Plus size={13} /> Create your first deck
          </button>
          {onTemplates && (
            <button
              onClick={onTemplates}
              className="inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-[12.5px] transition hover:opacity-80"
              style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}
            >
              <LayoutGrid size={12} /> Browse templates
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NoMatchState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--ezd-divider)", background: "var(--ezd-bg-card)" }}>
      <Search size={20} className="mx-auto mb-3" style={{ color: "var(--ezd-fg-quiet)" }} />
      <h3 className="text-sm font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>No matches</h3>
      <p className="mt-1 text-xs" style={{ color: "var(--ezd-fg-muted)" }}>Nothing in your library matches that search.</p>
      <button
        onClick={onClear}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[12px] transition hover:opacity-80"
        style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
      >
        Clear search
      </button>
    </div>
  );
}

/* ----------------------------- Modals ----------------------------- */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="m-4 w-full max-w-sm rounded-2xl border p-6 shadow-2xl"
        style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-elev)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function RenameModal({
  initial, onClose, onSave,
}: { initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const save = () => { if (name.trim()) onSave(name.trim()); };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-base font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>Rename deck</h3>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        maxLength={200}
        className="mt-4 w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-white/30"
        style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-card)", color: "var(--ezd-fg-strong)" }}
        placeholder="Deck title"
      />
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-xl border px-4 py-2 text-sm transition hover:opacity-80"
          style={{ borderColor: "var(--ezd-hairline)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)" }}
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!name.trim()}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

/* ----------------------------- helpers ----------------------------- */

function Sep() {
  return <span aria-hidden style={{ color: "var(--ezd-fg-quiet)", opacity: 0.6 }}>·</span>;
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
