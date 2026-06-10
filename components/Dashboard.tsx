"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Clock, FileText, Gift, Home, Info, LayoutGrid,
  Loader2, LogOut, Plus, Search, Sparkles, Trash2, Wand2, X, Zap,
} from "lucide-react";
import { type AppUser } from "@/lib/auth";
import { deleteDeck, watchDeckList, type DeckListItem } from "@/lib/decks";
import DeckThumbnail from "./DeckThumbnail";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import UpgradeDialog from "./UpgradeDialog";
import { watchMonthlyGenerations, formatMonthlyResetIn } from "@/lib/usage";
import { watchUserPlan, getUserPlan } from "@/lib/plan";
import { type PlanId, planDeckLimit, getPlan } from "@/lib/plans";

/**
 * Dashboard shown on /app.
 *
 * Layout:
 *   - Sidebar: brand + nav (Dashboard / My decks / Templates / About) +
 *     daily quota meter + user profile + sign out.
 *   - Main: minimal — a header with the user's name, two compact action
 *     buttons (New deck / Templates), an optional "continue working"
 *     card, then the decks grid with search.
 *
 * The shape of the "decks" list comes from watchDeckList(). Everything
 * is free, so there is no unlock/paid state to track.
 */

type Props = {
  user: AppUser;
  /** Drop into the prompt step. */
  onStartFromScratch: () => void;
  /** Drop into the prompt step AND open the template gallery. */
  onStartFromTemplate?: () => void;
  onSignOut: () => void | Promise<void>;
};


export default function Dashboard({
  user, onStartFromScratch, onStartFromTemplate, onSignOut,
}: Props) {
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [monthGenerations, setMonthGenerations] = useState(0);
  const [plan, setPlan] = useState<PlanId>("free");

  // Upgrade/pricing modal. Shown on every dashboard visit (per the product
  // decision) and whenever the user hits a plan limit or a locked feature.
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);

  // Show the pricing modal once per dashboard mount — only for free users.
  // Resolve the real plan first so paid users never see the auto-popup (the
  // live watcher emits "free" before the real tier loads).
  useEffect(() => {
    let cancelled = false;
    getUserPlan(user.uid).then((p) => {
      if (!cancelled && p === "free") {
        setUpgradeReason(undefined);
        setUpgradeOpen(true);
      }
    });
    return () => { cancelled = true; };
  }, [user.uid]);

  // Live plan.
  useEffect(() => {
    const unsub = watchUserPlan(user.uid, setPlan);
    return () => unsub();
  }, [user.uid]);

  // Live deck list.
  useEffect(() => {
    const unsub = watchDeckList(user.uid, (items) => {
      setDecks(items);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  // Live monthly generation count.
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
    // "Continue working" rule: most-recent deck if updated within 7 days.
    const top = decks[0];
    if (!top) return null;
    const ageHours = (Date.now() - (top.updatedAt || 0)) / 36e5;
    if (ageHours > 24 * 7) return null;
    return top;
  }, [decks]);

  const visibleDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decks.filter((d) => {
      if (q) {
        const hay = `${d.title} ${d.subtitle ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [decks, query]);

  return (
    <div className="min-h-screen lg:pl-[260px]">
      {/* ============== Sidebar ============== */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-white/10 p-5 backdrop-blur lg:flex"
             style={{ background: "var(--ezd-nav-bg)" }}>
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <ThemeToggle variant="compact" />
        </div>

        <nav className="mt-7 space-y-0.5 text-sm">
          <NavItem icon={<Home size={14} />} label="Dashboard" active />
          <NavItem
            icon={<FileText size={14} />}
            label="My decks"
            href="/app/decks"
            count={decks.length || undefined}
          />
          <NavItem
            icon={<LayoutGrid size={14} />}
            label="Templates"
            onClick={onStartFromTemplate}
          />
          <NavItem
            icon={<Info size={14} />}
            label="About / Dev's note"
            href="/about"
          />
        </nav>

        {/* Plan card */}
        <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-[11px] text-white/55">
          <div className="font-semibold uppercase tracking-[0.22em] text-white/40">
            {getPlan(plan).name} plan
          </div>
          <p className="mt-1.5 leading-relaxed">
            {plan === "free"
              ? "Upgrade to unlock speaker notes, Q&A prep, icons, and more decks."
              : plan === "pro"
                ? "You've unlocked Pro features. Go Pro Plus for unlimited decks and translation."
                : "You're on Pro Plus — everything unlocked."}
          </p>
          <button
            onClick={() => openUpgrade()}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 transition hover:bg-white/10"
          >
            <Sparkles size={12} /> {plan === "proplus" ? "View plans" : "Upgrade"}
          </button>
        </div>

        {/* Bottom-anchored stack: monthly quota meter + user card. */}
        <div className="mt-auto space-y-2.5">
          <SidebarQuota used={monthGenerations} plan={plan} onUpgrade={() => openUpgrade()} />

          {/* User card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-700 text-sm font-semibold text-white">
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">
                {user.name || user.email?.split("@")[0]}
              </div>
              <div className="truncate text-[11px] text-white/50">{user.email}</div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 transition hover:bg-white/10"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
        </div>
      </aside>

      {/* ============== Main ============== */}
      <main className="px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        {/* Pricing / upgrade modal — shown on every visit and on limits */}
        {upgradeOpen && (
          <UpgradeDialog
            currentPlan={plan}
            reason={upgradeReason}
            onClose={() => setUpgradeOpen(false)}
          />
        )}

        {/* Mobile header: brand + sign out */}
        <div className="mb-6 flex items-center justify-between lg:hidden">
          <Logo size="sm" />
          <button
            onClick={onSignOut}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 hover:bg-white/10"
          >
            <LogOut size={11} className="mr-1 inline" /> Sign out
          </button>
        </div>

        {/* ---------- Header row ---------- */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-[26px] font-semibold tracking-tight text-white md:text-[30px]"
              style={{
                fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
                letterSpacing: "-0.018em",
              }}
            >
              {firstName(user)}&rsquo;s decks
            </h1>
            <p className="mt-1 text-[12.5px] text-white/45">
              {decks.length === 0
                ? "Nothing here yet."
                : `${decks.length} deck${decks.length === 1 ? "" : "s"} · auto-saved as you edit.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onNewDeck}
              data-tour="start-from-scratch"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-[#03070F] transition hover:bg-white/90"
              title={
                limitReached
                  ? `Monthly limit reached. Resets in ${formatMonthlyResetIn()}.`
                  : "Start from a one-line brief"
              }
            >
              <Wand2 size={13} /> New deck
            </button>
            <button
              onClick={onStartFromTemplate ?? onStartFromScratch}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[12.5px] text-white/85 transition hover:bg-white/10"
            >
              <LayoutGrid size={12} /> Templates
            </button>
          </div>
        </div>

        {/* ---------- Continue working ---------- */}
        {recentDeck && (
          <ContinueCard deck={recentDeck} />
        )}

        {/* ---------- Decks header (search) ---------- */}
        {decks.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/40">
              All decks
            </div>
            <div className="flex items-center gap-2">
              <SearchInput value={query} onChange={setQuery} />
              <Link
                href="/app/decks"
                className="hidden text-[12px] text-white/55 transition hover:text-white/85 sm:inline"
              >
                See all →
              </Link>
            </div>
          </div>
        )}

        {/* ---------- Decks grid ---------- */}
        {loading ? (
          <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] p-12">
            <Loader2 size={20} className="animate-spin text-white/45" />
          </div>
        ) : decks.length === 0 ? (
          <EmptyState onCreate={onStartFromScratch} onTemplates={onStartFromTemplate} />
        ) : visibleDecks.length === 0 ? (
          <NoMatchState onClear={() => { setQuery(""); }} />
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDecks.slice(0, 9).map((d) => (
              <DeckCard
                key={d.id}
                deck={d}
                onAskDelete={() => setConfirmId(d.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Delete confirm */}
      {confirmId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="m-4 w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Delete this deck?</h3>
            <p className="mt-2 text-sm text-white/65">
              This can&rsquo;t be undone. Any public share link will also stop working.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmId) {
                    try { await deleteDeck(user.uid, confirmId); } catch { /* ignore */ }
                  }
                  setConfirmId(null);
                }}
                className="rounded-xl bg-red-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
  const className = `flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
    active
      ? "bg-white/10 text-white"
      : "text-white/65 hover:bg-white/5 hover:text-white"
  }`;
  const inner = (
    <>
      <span className="flex items-center gap-2.5">
        {icon}
        {label}
      </span>
      {typeof count === "number" && (
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 text-[10px] tabular-nums text-white/65">
          {count}
        </span>
      )}
    </>
  );
  if (href) return <Link href={href} className={className}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={className}>{inner}</button>;
  return <div className={className}>{inner}</div>;
}

/* --------------------------- Free popup --------------------------- */

/**
 * Eye-catching "EZdeck is now free" announcement shown as a centered modal
 * popup over the dashboard. Close dismisses for the session (it returns on
 * next load); the "Don't show again" checkbox persists the opt-out to
 * localStorage. Intentionally not finalised yet, so the default is to keep
 * reminding people.
 */
function FreeBanner({
  onClose, onNeverShow,
}: { onClose: () => void; onNeverShow: () => void }) {
  const [never, setNever] = useState(false);
  const dismiss = () => (never ? onNeverShow() : onClose());

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [never]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="EZdeck is now free"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div className="fade-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-300/25 p-[1px] shadow-2xl">
        {/* Gradient frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(120deg, rgba(34,211,238,0.20), rgba(56,189,248,0.06) 35%, transparent 60%, rgba(167,139,250,0.18))",
          }}
        />
        {/* Soft glow blobs */}
        <div aria-hidden className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 right-8 h-44 w-44 rounded-full bg-violet-400/15 blur-3xl" />

        <div className="relative rounded-[15px] p-6 backdrop-blur-md sm:p-8" style={{ background: "var(--ezd-bg-elev)" }}>
          {/* Corner close */}
          <button
            onClick={dismiss}
            aria-label="Close announcement"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10"
            style={{ color: "var(--ezd-fg-muted)" }}
          >
            <X size={15} />
          </button>

          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-400/25 to-sky-600/15 text-cyan-200 shadow-[0_0_30px_-6px_rgba(34,211,238,0.65)]">
            <Gift size={26} />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <Sparkles size={10} /> News
            </span>
          </div>

          <h2
            className="mt-2.5 text-[24px] font-semibold tracking-tight sm:text-[28px]"
            style={{ color: "var(--ezd-fg-strong)", fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', letterSpacing: "-0.02em" }}
          >
            EZdeck is now 100% free
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            No payments, no per-file fees, no catch. Generate, edit, present,
            and download unlimited <span style={{ color: "var(--ezd-fg-strong)" }}>.pptx</span> and{" "}
            <span style={{ color: "var(--ezd-fg-strong)" }}>.pdf</span> decks for free. All we ask
            is one quick review before your first export.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[12px] transition hover:opacity-80" style={{ color: "var(--ezd-fg-muted)" }}>
              <input
                type="checkbox"
                checked={never}
                onChange={(e) => setNever(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/25 bg-transparent accent-cyan-400"
              />
              Don&rsquo;t show this again
            </label>
            <button
              onClick={dismiss}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-6 py-2.5 text-[13px] font-semibold transition hover:brightness-110"
              style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContinueCard({ deck }: { deck: DeckListItem }) {
  return (
    <Link
      href={`/app?id=${deck.id}`}
      className="group mb-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/[0.02] to-transparent p-4 transition hover:border-cyan-300/40 hover:from-cyan-500/15"
    >
      <div className="hidden w-[140px] shrink-0 sm:block">
        <DeckThumbnail item={deck} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          <Clock size={11} />
          Continue working
        </div>
        <h3 className="mt-1.5 line-clamp-1 text-base font-semibold text-white">
          {deck.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/55">
          <span>{deck.slides} slide{deck.slides === 1 ? "" : "s"}</span>
          <Sep />
          <span>{formatRelative(deck.updatedAt)}</span>
        </div>
      </div>
      <ArrowRight
        size={16}
        className="text-white/45 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
      />
    </Link>
  );
}

/* ----------------------- Sidebar quota meter ----------------------- */

/**
 * Compact daily-quota card that lives in the sidebar above the user
 * profile. Three states tinted to match: cyan (default), amber (last
 * one), red (exhausted). Shows X/3 prominently, refill timer below,
 * and a slim progress bar at the bottom.
 *
 * Refill clock ticks every minute so the copy stays fresh while users
 * sit on the dashboard.
 */
function SidebarQuota({ used, plan, onUpgrade }: { used: number; plan: PlanId; onUpgrade: () => void }) {
  const limit = planDeckLimit(plan);
  const unlimited = limit === Infinity;
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  const pct = unlimited ? Math.min(100, used > 0 ? 12 : 0) : Math.min(100, (used / limit) * 100);
  const exhausted = !unlimited && remaining === 0;
  const last = !unlimited && remaining === 1;

  const [resetIn, setResetIn] = useState(formatMonthlyResetIn());
  useEffect(() => {
    const id = window.setInterval(() => setResetIn(formatMonthlyResetIn()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const tone =
    exhausted ? { ring: "border-red-400/30 bg-red-400/8",     fill: "bg-red-400/85",   text: "text-red-200"   } :
    last      ? { ring: "border-amber-300/30 bg-amber-300/8", fill: "bg-amber-300/85", text: "text-amber-200" } :
                { ring: "border-cyan-300/30 bg-cyan-300/8",   fill: "bg-cyan-300/85",  text: "text-cyan-200"  };

  return (
    <div className={`rounded-xl border ${tone.ring} p-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={11} className={tone.text} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            {getPlan(plan).name} plan
          </span>
        </div>
        <span className={`text-[12px] font-semibold tabular-nums ${tone.text}`}>
          {unlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>

      <div className="mt-2 text-[11px] leading-snug text-white/65">
        {unlimited
          ? "Unlimited decks"
          : exhausted
            ? "All decks used this month"
            : last
              ? "Last deck this month"
              : `${remaining} deck${remaining === 1 ? "" : "s"} left this month`}
      </div>
      {!unlimited && (
        <div className="mt-0.5 text-[10px] text-white/40">
          Resets in {resetIn}
        </div>
      )}

      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone.fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {exhausted && (
        <button
          onClick={onUpgrade}
          className="mt-2.5 w-full rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-white/90"
        >
          Upgrade for more
        </button>
      )}
    </div>
  );
}

function SearchInput({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative">
      <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search decks…"
        className="w-44 rounded-full border border-white/10 bg-black/40 py-1.5 pl-8 pr-3 text-[12px] text-white outline-none transition focus:border-white/30 sm:w-56"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-4 w-4 place-items-center rounded-full text-white/35 hover:bg-white/10 hover:text-white"
          aria-label="Clear search"
        >
          <X size={9} />
        </button>
      )}
    </label>
  );
}

function DeckCard({
  deck, onAskDelete,
}: {
  deck: DeckListItem;
  onAskDelete: () => void;
}) {
  return (
    <article
      className="group relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/30 hover:bg-white/[0.04]"
    >
      <div className="mb-3">
        <DeckThumbnail item={deck} />
      </div>

      <div className="min-h-[64px]">
        <h3 className="line-clamp-2 text-sm font-semibold text-white">{deck.title}</h3>
        {deck.subtitle && (
          <p className="mt-1 line-clamp-1 text-[11px] text-white/55">{deck.subtitle}</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
        <span>{deck.slides} slide{deck.slides === 1 ? "" : "s"}</span>
        <span>{formatRelative(deck.updatedAt)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          href={`/app?id=${deck.id}`}
          className="flex-1 rounded-lg bg-white px-3 py-1.5 text-center text-xs font-medium text-black hover:bg-white/90"
        >
          Open
        </Link>
        {deck.shareId && (
          <Link
            href={`/share/${deck.shareId}`}
            target="_blank"
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/75 hover:bg-white/10"
            title="View public share link"
          >
            Share
          </Link>
        )}
        <button
          onClick={onAskDelete}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
          title="Delete this deck"
          aria-label="Delete deck"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </article>
  );
}

function EmptyState({
  onCreate, onTemplates,
}: { onCreate: () => void; onTemplates?: () => void }) {
  const examples = [
    "Series A pitch for a logistics platform",
    "Intro lecture on transformer architectures",
    "Q1 investor update for an early-stage SaaS",
  ];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-10 sm:px-10 sm:py-12">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <h3
          className="text-[22px] font-semibold tracking-tight text-white sm:text-[26px]"
          style={{ fontFamily: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', letterSpacing: "-0.02em" }}
        >
          Make your first presentation
        </h3>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
          Type a one-line brief and EZdeck assembles a full, editable deck in
          about ten seconds. Specific beats long. Try one of these to start:
        </p>

        {/* Clickable example starters */}
        <div className="mt-6 flex w-full max-w-md flex-col gap-2">
          {examples.map((e) => (
            <button
              key={e}
              onClick={onCreate}
              className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-left text-[12.5px] text-white/70 transition hover:border-white/25 hover:bg-white/[0.05] hover:text-white"
            >
              <span className="flex items-center gap-2.5">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--ezd-fg-strong)", opacity: 0.55 }} />
                {e}
              </span>
              <ArrowRight size={13} className="shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" />
            </button>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[12.5px] font-semibold text-[#03070F] transition hover:bg-white/90"
          >
            <Plus size={13} /> Create your first deck
          </button>
          {onTemplates && (
            <button
              onClick={onTemplates}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-5 py-2.5 text-[12.5px] text-white/85 transition hover:bg-white/10"
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
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <Search size={20} className="mx-auto mb-3 text-white/30" />
      <h3 className="text-sm font-semibold text-white">No matches</h3>
      <p className="mt-1 text-xs text-white/55">
        Nothing in your library matches that search.
      </p>
      <button
        onClick={onClear}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-4 py-1.5 text-[12px] text-white/85 transition hover:bg-white/10"
      >
        Clear search
      </button>
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="text-white/20">·</span>;
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
