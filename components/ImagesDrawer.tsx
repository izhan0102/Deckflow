"use client";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Search, X } from "lucide-react";
import { searchPexels, type PexelsPhoto, type PexelsOrientation } from "@/lib/pexels";

const ORIENTATIONS: { id: PexelsOrientation; label: string }[] = [
  { id: "", label: "Any" },
  { id: "landscape", label: "Landscape" },
  { id: "portrait", label: "Portrait" },
  { id: "square", label: "Square" },
];

/**
 * Image search drawer (Pexels). Used to add a photo to the current slide,
 * or to replace an existing one ("related images"). Clicking a result calls
 * onPick with the chosen photo; the parent decides whether to insert or
 * replace. Pexels requires crediting photographers, so each result links to
 * the photographer.
 */
export default function ImagesDrawer({
  open, onClose, initialQuery = "", replacing = false, onPick,
}: {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  replacing?: boolean;
  onPick: (photo: PexelsPhoto) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [orientation, setOrientation] = useState<PexelsOrientation>("");
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const reqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (q: string, pg: number, orient: PexelsOrientation) => {
    const term = q.trim();
    if (!term) { setPhotos([]); setError(null); return; }
    const myReq = ++reqRef.current;
    setLoading(true);
    setError(null);
    try {
      const results = await searchPexels(term, { perPage: 28, page: pg, orientation: orient });
      if (myReq !== reqRef.current) return;
      setPhotos(results);
      if (results.length === 0) setError("No images found. Try a different search.");
    } catch (e: any) {
      if (myReq !== reqRef.current) return;
      setError(e?.message || "Image search failed.");
      setPhotos([]);
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  };

  // On open, seed the query and run an initial search.
  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setOrientation("");
    setPage(1);
    setPhotos([]);
    setError(null);
    // Focus input after drawer opens (with delay for mobile)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // On mobile, select all text to make it easy to replace
        if (window.innerWidth < 768) {
          inputRef.current.select();
        }
      }
    }, 300);
    if (initialQuery.trim()) run(initialQuery, 1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => { e.preventDefault(); setPage(1); run(query, 1, orientation); };
  const goPage = (pg: number) => { const p = Math.max(1, pg); setPage(p); run(query, p, orientation); };
  const setOrient = (o: PexelsOrientation) => { setOrientation(o); setPage(1); run(query, 1, o); };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        touchAction: "manipulation",
        // Prevent scroll on touch
        overscrollBehavior: "contain",
      }}
      // Prevent scroll on touch for iOS
      onTouchMove={(e) => {
        // Allow scrolling inside the drawer content
        const target = e.target as HTMLElement;
        if (target.closest('.drawer-content')) return;
        e.preventDefault();
      }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl drawer-content"
        style={{ background: "var(--ezd-bg-elev)", borderColor: "var(--ezd-divider)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--ezd-divider)" }}>
          <span className="inline-flex items-center gap-2 text-[14px] font-semibold" style={{ color: "var(--ezd-fg-strong)" }}>
            <ImageIcon size={16} /> {replacing ? "Replace image" : "Add a photo"}
          </span>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full transition hover:opacity-70"
            style={{ color: "var(--ezd-fg-muted)" }}
            aria-label="Close"
            // Larger touch target
            style={{ 
              color: "var(--ezd-fg-muted)",
              minWidth: "44px",
              minHeight: "44px",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Search controls */}
        <div className="border-b px-5 py-3.5" style={{ borderColor: "var(--ezd-divider)" }}>
          <form onSubmit={submit} className="flex items-center gap-2">
            <label className="relative flex-1">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ezd-fg-quiet)" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="Search photos — e.g. babies, data center, mountains"
                className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition"
                style={{ 
                  borderColor: "var(--ezd-hairline)", 
                  background: "var(--ezd-bg-card)", 
                  color: "var(--ezd-fg-strong)",
                  touchAction: "manipulation",
                  // Larger tap target on mobile
                  minHeight: "44px",
                }}
                // Prevent zoom on iOS
                inputMode="search"
                enterKeyHint="search"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition hover:opacity-90 disabled:opacity-60"
              style={{ 
                background: "var(--ezd-button-strong)", 
                color: "var(--ezd-button-strong-fg)",
                touchAction: "manipulation",
                minHeight: "44px",
                minWidth: "44px",
              }}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Search
            </button>
          </form>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {ORIENTATIONS.map((o) => (
              <button
                key={o.id || "any"}
                onClick={() => setOrient(o.id)}
                className="rounded-full border px-3 py-1 text-[11.5px] transition"
                style={
                  orientation === o.id
                    ? { borderColor: "var(--ezd-fg-strong)", background: "var(--ezd-bg-hover)", color: "var(--ezd-fg-strong)", minHeight: "32px", minWidth: "44px", touchAction: "manipulation" }
                    : { borderColor: "var(--ezd-hairline)", color: "var(--ezd-fg-muted)", minHeight: "32px", minWidth: "44px", touchAction: "manipulation" }
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5 drawer-content" style={{ WebkitOverflowScrolling: "touch" }}>
          {loading && photos.length === 0 ? (
            <div className="grid h-[220px] place-items-center" style={{ color: "var(--ezd-fg-muted)" }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : error && photos.length === 0 ? (
            <div className="grid h-[220px] place-items-center text-center text-[13px]" style={{ color: "var(--ezd-fg-muted)" }}>
              {error}
            </div>
          ) : photos.length === 0 ? (
            <div className="grid h-[220px] place-items-center text-center text-[13px]" style={{ color: "var(--ezd-fg-quiet)" }}>
              Search for an image to {replacing ? "replace this one" : "add to your slide"}.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onPick(p); onClose(); }}
                    className="group relative overflow-hidden rounded-xl border transition hover:-translate-y-0.5"
                    style={{ 
                      borderColor: "var(--ezd-divider)", 
                      background: p.avg_color || "var(--ezd-bg-hover)",
                      touchAction: "manipulation",
                      // Larger touch target for images
                      minHeight: "80px",
                    }}
                    title={p.alt ? `${p.alt} — by ${p.photographer}` : `Photo by ${p.photographer}`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.src.medium}
                        alt={p.alt || "Stock photo"}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                    <span
                      className="pointer-events-none absolute inset-x-0 bottom-0 truncate px-2 py-1 text-left text-[9.5px] opacity-0 transition group-hover:opacity-100"
                      style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))", color: "#fff" }}
                    >
                      {p.photographer}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px]" style={{ color: "var(--ezd-fg-quiet)" }}>
                  Photos via Pexels
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goPage(page - 1)}
                    disabled={page <= 1 || loading}
                    className="rounded-lg border px-3 py-1.5 text-[12px] transition hover:opacity-80 disabled:opacity-40"
                    style={{ 
                      borderColor: "var(--ezd-hairline)", 
                      color: "var(--ezd-fg-strong)",
                      touchAction: "manipulation",
                      minHeight: "36px",
                      minWidth: "44px",
                    }}
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => goPage(page + 1)}
                    disabled={loading}
                    className="rounded-lg border px-3 py-1.5 text-[12px] transition hover:opacity-80 disabled:opacity-40"
                    style={{ 
                      borderColor: "var(--ezd-hairline)", 
                      color: "var(--ezd-fg-strong)",
                      touchAction: "manipulation",
                      minHeight: "36px",
                      minWidth: "44px",
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}