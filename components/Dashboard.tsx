"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Clock, Crown, FileText, Home, Info, LayoutGrid,
  Loader2, LogOut, Plus, Search, Trash2, Wand2, X, Zap,
} from "lucide-react";
import { type AppUser } from "@/lib/auth";
import { deleteDeck, watchDeckList, type DeckListItem } from "@/lib/decks";
import { getFirebaseDb } from "@/lib/firebase";
import { onValue, ref } from "firebase/database";
import DeckThumbnail from "./DeckThumbnail";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import {
  DAILY_GENERATION_LIMIT, formatRefillIn, watchTodayGenerations,
} from "@/lib/usage";

/**
 * Dashboard shown on /app.
 *
 * Layout:
 *   - Sidebar: brand + nav (Dashboard / My decks / Templates / About) +
 *     daily quota meter + user profile + sign out.
 *   - Main: minimal — a header with the user's name, two compact action
 *     buttons (New deck / Templates), an optional "continue working"
 *     card, then the decks grid with search + filter.
 *
 * The shape of the "decks" list comes from watchDeckList(). The "paid"
 * flag is read from a separate Firebase listener so unlock status updates
 * live across tabs.
 */

type Props = {
  user: AppUser;
  /** Drop into the prompt step. */
  onStartFromScratch: () => void;
  /** Drop into the prompt step AND open the template gallery. */
  onStartFromTemplate?: () => void;
  onSignOut: () => void | Promise<void>;
};

type Filter = "all" | "unlocked" | "drafts";

export default function Dashboard({
  user, onStartFromScratch, onStartFromTemplate, onSignOut,
}: Props) {
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [todayGenerations, setTodayGenerations] = useState(0);

  // Live deck list.
  useEffect(() => {
    const unsub = watchDeckList(user.uid, (items) => {
      setDecks(items);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  // Live daily generation count.
  useEffect(() => {
    const unsub = watchTodayGenerations(user.uid, setTodayGenerations);
    return () => unsub();
  }, [user.uid]);

  // Live `paid` flags.
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;
    const unsub = onValue(ref(db, `decks/${user.uid}`), (snap) => {
      const val = snap.val() || {};
      const ids = new Set<string>();
      for (const [id, row] of Object.entries(val as Record<string, any>)) {
        if (row?.paid?.paidAt) ids.add(id);
      }
      setPaidIds(ids);
    });
    return () => unsub();
  }, [user.uid]);

  /* ----------------------------- derived ----------------------------- */

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
      if (filter === "unlocked" && !paidIds.has(d.id)) return false;
      if (filter === "drafts" && paidIds.has(d.id)) return false;
      if (q) {
        const hay = `${d.title} ${d.subtitle ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [decks, paidIds, query, filter]);

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

        {/* Quick links */}
        <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-[11px] text-white/55">
          <div className="font-semibold uppercase tracking-[0.22em] text-white/40">
            Heads up
          </div>
          <p className="mt-1.5 leading-relaxed">
            Generate, edit, and present every deck for free. Pay ₹15 only when
            you decide to download.
          </p>
        </div>

        {/* Bottom-anchored stack: daily quota meter + user card. The
            mt-auto on the wrapper pushes both to the foot of the
            sidebar so they stay glued to the bottom regardless of nav
            length. */}
        <div className="mt-auto space-y-2.5">
          <SidebarQuota used={todayGenerations} />

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
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
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
              onClick={onStartFromScratch}
              data-tour="start-from-scratch"
              disabled={todayGenerations >= DAILY_GENERATION_LIMIT}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-[#03070F] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                todayGenerations >= DAILY_GENERATION_LIMIT
                  ? `Daily quota used. Resets in ${formatRefillIn()}.`
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
          <ContinueCard deck={recentDeck} isPaid={paidIds.has(recentDeck.id)} />
        )}

        {/* ---------- Decks header (search + filter) ---------- */}
        {decks.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/40">
              All decks
            </div>
            <div className="flex items-center gap-2">
              <SearchInput value={query} onChange={setQuery} />
              <FilterChips value={filter} onChange={setFilter} />
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
          <NoMatchState onClear={() => { setQuery(""); setFilter("all"); }} />
        ) : (
          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDecks.slice(0, 9).map((d) => (
              <DeckCard
                key={d.id}
                deck={d}
                isPaid={paidIds.has(d.id)}
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

function ContinueCard({ deck, isPaid }: { deck: DeckListItem; isPaid: boolean }) {
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
          {isPaid && (
            <>
              <Sep />
              <span className="inline-flex items-center gap-1 text-amber-200">
                <Crown size={10} /> Unlocked
              </span>
            </>
          )}
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
function SidebarQuota({ used }: { used: number }) {
  const remaining = Math.max(0, DAILY_GENERATION_LIMIT - used);
  const pct = Math.min(100, (used / DAILY_GENERATION_LIMIT) * 100);
  const exhausted = remaining === 0;
  const last = remaining === 1;

  const [refillIn, setRefillIn] = useState(formatRefillIn());
  useEffect(() => {
    const id = window.setInterval(() => setRefillIn(formatRefillIn()), 60_000);
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
            Daily plan
          </span>
        </div>
        <span className={`text-[12px] font-semibold tabular-nums ${tone.text}`}>
          {used} / {DAILY_GENERATION_LIMIT}
        </span>
      </div>

      <div className="mt-2 text-[11px] leading-snug text-white/65">
        {exhausted
          ? "All generations used"
          : last
            ? "Last generation today"
            : `${remaining} generation${remaining === 1 ? "" : "s"} left`}
      </div>
      <div className="mt-0.5 text-[10px] text-white/40">
        Resets in {refillIn}
      </div>

      {/* Slim progress bar */}
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone.fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
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

function FilterChips({
  value, onChange,
}: { value: Filter; onChange: (f: Filter) => void }) {
  const opts: { id: Filter; label: string }[] = [
    { id: "all",      label: "All" },
    { id: "unlocked", label: "Unlocked" },
    { id: "drafts",   label: "Drafts" },
  ];
  return (
    <div className="hidden items-center rounded-full border border-white/10 bg-white/[0.025] p-0.5 text-[11px] sm:flex">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-3 py-1 transition ${
              active ? "bg-white text-[#03070F]" : "text-white/65 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DeckCard({
  deck, isPaid, onAskDelete,
}: {
  deck: DeckListItem;
  isPaid: boolean;
  onAskDelete: () => void;
}) {
  return (
    <article
      className={`group relative flex h-full flex-col rounded-2xl border p-4 transition ${
        isPaid
          ? "border-amber-300/40 bg-gradient-to-br from-amber-300/10 via-yellow-300/5 to-transparent hover:border-amber-300/60"
          : "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
      }`}
    >
      <div className="mb-3">
        <DeckThumbnail item={deck} />
      </div>

      {isPaid && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-300/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
          <Crown size={10} /> Unlocked
        </span>
      )}

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
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-10 sm:px-8 sm:py-12">
      <div className="max-w-xl">
        <h3 className="text-base font-semibold text-white">
          Nothing here yet.
        </h3>
        <p className="mt-1.5 text-[13px] text-white/55">
          Type a one-line brief and EZdeck assembles the deck. Specific is better than long.
        </p>
        <ul className="mt-5 space-y-1.5 text-[12.5px] text-white/55">
          {examples.map((e) => (
            <li key={e} className="flex items-start gap-2">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-300/70" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-[12.5px] font-semibold text-[#03070F] transition hover:bg-white/90"
          >
            <Plus size={12} /> Create your first deck
          </button>
          {onTemplates && (
            <button
              onClick={onTemplates}
              className="inline-flex items-center gap-1.5 text-[12px] text-white/55 transition hover:text-white/85"
            >
              <LayoutGrid size={11} /> Or browse templates →
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
        Nothing in your library matches the search and filter combo.
      </p>
      <button
        onClick={onClear}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-4 py-1.5 text-[12px] text-white/85 transition hover:bg-white/10"
      >
        Clear filters
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
