"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Theme } from "@/lib/themes";
import {
  DECORATIONS, DECORATION_CATEGORIES, decorationDataUri,
  type DecorationCategory,
} from "@/lib/decorations";
import { iconifySvgUrl, type IconifyHit } from "@/lib/iconify";
import { ChevronLeft, ChevronRight, Loader2, Shapes, X } from "lucide-react";
import { getIdToken } from "@/lib/auth";

const PAGE = 8;

export type DrawerPick =
  | { kind: "decoration"; id: string }
  | { kind: "icon"; iconId: string };

export default function DecorationDrawer({
  open, theme, onClose, onPick, initialMode = "graphics",
}: {
  open: boolean;
  theme: Theme;
  onClose: () => void;
  onPick: (pick: DrawerPick) => void;
  /** "graphics" opens the shape/chart library; "icons" jumps straight to Iconify search. */
  initialMode?: "graphics" | "icons";
}) {
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | DecorationCategory>(
    initialMode === "icons" ? "Icons" : "All",
  );

  // When the drawer is (re)opened, snap to the requested mode.
  useEffect(() => {
    if (open) {
      setCategory(initialMode === "icons" ? "Icons" : "All");
      setQuery("");
      setPage(0);
    }
  }, [open, initialMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DECORATIONS.filter((d) => {
      if (category === "Icons") return false; // icons handled separately
      if (category !== "All" && d.category !== category) return false;
      if (q && !d.name.toLowerCase().includes(q) && !d.category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = useMemo(
    () => filtered.slice(page * PAGE, (page + 1) * PAGE),
    [filtered, page],
  );

  useEffect(() => { setPage(0); }, [query, category]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const inIconMode = category === "Icons";

  return (
    <>
      <div className="fixed inset-0 z-[150] bg-black/40" onClick={onClose} aria-hidden />
      <aside
        role="dialog" aria-modal="true"
        className="fixed right-0 top-0 z-[151] flex h-full w-[440px] flex-col border-l border-white/10 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Shapes size={14} className="text-cyan-300" />
            <span className="text-sm font-semibold text-white">
              {inIconMode ? "Icon library" : "Graphic library"}
            </span>
            {!inIconMode && <span className="text-[10px] text-white/40">· {DECORATIONS.length}</span>}
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-white/70 hover:bg-white/10">
            <X size={14} />
          </button>
        </div>

        <div className="border-b border-white/10 p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={inIconMode
              ? "Search any icon — rocket, calendar, graph…"
              : "Search shapes, charts, frames…"}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
          />
          {/* Category chips only matter in graphics mode. In icon mode the whole
              drawer IS the icon search, so we don't show the shape categories. */}
          {!inIconMode && (
            <div className="mt-2 flex flex-wrap gap-1">
              <CategoryChip
                active={category === "All"}
                onClick={() => setCategory("All")}
                label="All"
              />
              {DECORATION_CATEGORIES.filter((c) => c !== "Icons").map((c) => (
                <CategoryChip
                  key={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                  label={c}
                />
              ))}
            </div>
          )}
        </div>

        {inIconMode ? (
          <IconSearchPanel
            theme={theme}
            query={query}
            onPick={(iconId) => { onPick({ kind: "icon", iconId }); onClose(); }}
          />
        ) : (
          <>
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4">
              {visible.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { onPick({ kind: "decoration", id: d.id }); onClose(); }}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-white/40 hover:bg-white/[0.06]"
                >
                  <div
                    className="flex aspect-[5/3] w-full items-center justify-center"
                    style={{ background: theme.bg }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={decorationDataUri(d.id, theme)}
                      alt={d.name}
                      style={{ width: "85%", height: "85%", objectFit: "contain" }}
                    />
                  </div>
                  <div className="bg-black/30 px-2 py-1.5 text-left">
                    <div className="truncate text-[11px] text-white/85">{d.name}</div>
                    <div className="text-[9px] text-white/40">{d.category}</div>
                  </div>
                </button>
              ))}
              {visible.length === 0 && (
                <div className="col-span-2 py-10 text-center text-xs text-white/40">
                  No graphics match this filter.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
              <span className="text-[10px] text-white/45">
                Page {page + 1} of {totalPages} · {filtered.length} shown
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10 disabled:opacity-40"
                >
                  <ChevronLeft size={11} /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10 disabled:opacity-40"
                >
                  Next <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function CategoryChip({
  active, onClick, label,
}: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
        active
          ? "border-white/60 bg-white/15 text-white"
          : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

/* ----------------------------- Iconify panel ------------------------------ */

const SUGGESTED_QUERIES = [
  "rocket", "user", "graph", "calendar", "lightbulb", "shield",
  "globe", "heart", "lock", "settings", "sparkles", "team",
];

function IconSearchPanel({
  theme, query, onPick,
}: {
  theme: Theme;
  query: string;
  onPick: (iconId: string) => void;
}) {
  const [results, setResults] = useState<IconifyHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastSentRef = useRef<string>("");

  const effectiveQuery = query.trim();

  useEffect(() => {
    // Debounce 220ms so typing fast doesn't hammer the API.
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!effectiveQuery) {
      setResults([]);
      setError(null);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      lastSentRef.current = effectiveQuery;
      setLoading(true);
      setError(null);
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/icon-search?q=${encodeURIComponent(effectiveQuery)}&limit=48`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        // Make sure we only apply results for the latest query.
        if (lastSentRef.current === effectiveQuery) {
          setResults(Array.isArray(data?.icons) ? data.icons : []);
        }
      } catch {
        setError("Could not reach the icon library. Check your connection.");
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [effectiveQuery]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        {!effectiveQuery && (
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-white/45">
              Try one of these
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUERIES.map((q) => (
                <a
                  key={q}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    // Bubble query change up via a custom event so the parent input updates.
                    const input = document.querySelector<HTMLInputElement>(
                      'aside input[placeholder^="Search any icon"]',
                    );
                    if (input) {
                      const setter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, "value",
                      )?.set;
                      setter?.call(input, q);
                      input.dispatchEvent(new Event("input", { bubbles: true }));
                      input.focus();
                    }
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 hover:bg-white/10"
                >
                  {q}
                </a>
              ))}
            </div>
            <p className="mt-6 text-[11px] leading-relaxed text-white/45">
              Search 200,000+ icons from open-source sets. The icon you pick keeps the
              theme accent color by default; you can recolor it later from the
              right-side panel.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-10 text-xs text-white/55">
            <Loader2 size={14} className="mr-2 animate-spin" /> Searching…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && effectiveQuery && results.length === 0 && (
          <div className="py-10 text-center text-xs text-white/40">
            No icons match "{effectiveQuery}". Try a simpler word.
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-white/45">
              {results.length} icons
            </div>
            <div className="grid grid-cols-4 gap-2">
              {results.map((hit) => (
                <button
                  key={hit.id}
                  onClick={() => onPick(hit.id)}
                  title={hit.name}
                  className="group flex aspect-square items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] transition hover:border-white/40 hover:bg-white/[0.08]"
                  style={{ background: theme.bg }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={iconifySvgUrl(hit.id, theme.accent)}
                    alt={hit.name}
                    style={{ width: "60%", height: "60%", objectFit: "contain" }}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
