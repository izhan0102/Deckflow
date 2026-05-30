"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Deck, Slide, UploadedImage } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { PRESET_THEMES } from "@/lib/themes";
import {
  ChevronLeft, ChevronRight, Image as ImageIcon, Link as LinkIcon, Play, RotateCcw, Shapes, Smile, Undo2,
} from "lucide-react";
import SlideCanvas from "./SlideCanvas";
import DesignerPanel from "./DesignerPanel";
import Presenter from "./Presenter";
import DeckChat from "./DeckChat";
import SlideRail from "./SlideRail";
import HiddenSlidesRenderer, { type HiddenSlidesHandle } from "./HiddenSlidesRenderer";
import ExportButton from "./ExportButton";
import DecorationDrawer from "./DecorationDrawer";
import PaymentDialog from "./PaymentDialog";
import { exportSlidesToPdf } from "@/lib/pdfExport";
import { trackEvent } from "@/lib/stats";
import type { ExportFormat } from "./ExportFormatPicker";
import { getDecoration } from "@/lib/decorations";
import { saveDeck, publishDeck, unpublishDeck, loadDeckPaid } from "@/lib/decks";
import type { AppUser } from "@/lib/auth";

type Props = {
  deck: Deck;
  setDeck: (d: Deck) => void;
  theme: Theme;
  setTheme?: (t: Theme) => void;
  onRestart: () => void;
  deckId?: string | null;
  user?: AppUser | null;
};

export default function DeckPreview({ deck, setDeck, theme, setTheme, onRestart, deckId, user }: Props) {
  const [active, setActive] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [decorOpen, setDecorOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [renderForPdf, setRenderForPdf] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [themeTransferOpen, setThemeTransferOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  // Undo: keep up to N recent deck snapshots so we can roll back accidental
  // edits, AI rewrites that went wrong, or auto-saves that wiped something.
  // We store full Deck objects (small, JSON-friendly) and skip pushing on
  // every keystroke by debouncing in the saver, not here.
  const historyRef = useRef<Deck[]>([]);
  const skipNextHistoryPushRef = useRef(false);
  const HISTORY_LIMIT = 30;
  const [canUndo, setCanUndo] = useState(false);

  // Push current deck onto history stack whenever it changes — except for
  // changes that came from popping history itself.
  useEffect(() => {
    if (skipNextHistoryPushRef.current) {
      skipNextHistoryPushRef.current = false;
      return;
    }
    const hist = historyRef.current;
    const last = hist[hist.length - 1];
    // Avoid pushing identical states.
    if (last && JSON.stringify(last) === JSON.stringify(deck)) return;
    hist.push(deck);
    while (hist.length > HISTORY_LIMIT) hist.shift();
    setCanUndo(hist.length > 1);
  }, [deck]);

  const undo = () => {
    const hist = historyRef.current;
    if (hist.length < 2) return;
    // Pop current state; the new "last" is the previous state.
    hist.pop();
    const prev = hist[hist.length - 1];
    if (!prev) return;
    skipNextHistoryPushRef.current = true;
    setDeck(prev);
    setCanUndo(hist.length > 1);
  };

  // Ctrl/Cmd+Z to undo, ignoring when the user is typing in an editable.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() !== "z") return;
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.isContentEditable || /input|textarea|select/i.test(tgt.tagName))) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Hydrate the paid flag any time the deck/user changes. Polls again
  // when the user comes back to the tab so a payment that just landed
  // unlocks without a manual refresh.
  useEffect(() => {
    if (!user || !deckId) { setPaid(false); return; }
    let cancelled = false;
    const refresh = async () => {
      try {
        const p = await loadDeckPaid(user.uid, deckId);
        if (!cancelled) setPaid(!!p?.paidAt);
      } catch { /* ignore */ }
    };
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; window.removeEventListener("focus", onFocus); };
  }, [user, deckId]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HiddenSlidesHandle>(null);

  // Debounced cloud-save: any change to deck or theme triggers a save
  // 1s after the last edit, so we don't slam Firebase on every keystroke.
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !deckId) return;
    setSaveState("saving");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await saveDeck(user.uid, deckId, deck, theme);
        // Quietly drop back to idle. The "Saved" pill was distracting and
        // hovered over the title row whenever the AI applied an edit.
        setSaveState("idle");
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[deck] save failed:", e);
        setSaveState("error");
      }
    }, 1000);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [deck, theme, user, deckId]);

  // Clear graphic selection when switching slides.
  useEffect(() => { setSelectedImageId(null); }, [active]);

  // Patches accept an opts param so the canvas can flag drag-only updates;
  // we currently treat all updates the same since undo/redo is removed.
  const updateActive = (patch: Partial<Slide>) => {
    setDeck({
      ...deck,
      slides: deck.slides.map((s, i) => (i === active ? { ...s, ...patch } : s)),
    });
  };

  const replaceActive = (next: Slide) => {
    setDeck({ ...deck, slides: deck.slides.map((s, i) => (i === active ? next : s)) });
  };

  const enrichedSlides = useMemo(() => {
    return deck.slides.map((s) =>
      s.layout === "references"
        // Only fall back to deck-level references when the slide hasn't
        // started owning its own list (so inline edits stick).
        ? { ...s, references: s.references && s.references.length ? s.references : (deck.references || []) }
        : s,
    );
  }, [deck.slides, deck.references]);

  /* ----------------------------- Image upload ----------------------------- */

  const onUploadImage = (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image is over 5MB. Choose a smaller one."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const probe = new window.Image();
      probe.onload = () => {
        const w = 5;
        const h = (probe.height / probe.width) * w;
        const newImage: UploadedImage = {
          id: `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          kind: "user",
          dataUrl,
          x: (13.333 - w) / 2, y: (7.5 - h) / 2, w, h,
        };
        const slide = deck.slides[active];
        setDeck({
          ...deck,
          slides: deck.slides.map((s, i) =>
            i === active ? { ...s, uploadedImages: [...(slide.uploadedImages || []), newImage] } : s,
          ),
        });
      };
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const addDecoration = (decId: string) => {
    const d = getDecoration(decId);
    if (!d) return;
    const w = d.defaultW;
    const h = d.defaultH;
    const newImage: UploadedImage = {
      id: `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      kind: "decoration",
      decorationId: decId,
      dataUrl: "",
      x: (13.333 - w) / 2, y: (7.5 - h) / 2, w, h,
    };
    const slide = deck.slides[active];
    setDeck({
      ...deck,
      slides: deck.slides.map((s, i) =>
        i === active ? { ...s, uploadedImages: [...(slide.uploadedImages || []), newImage] } : s,
      ),
    });
  };

  const addIcon = (iconId: string) => {
    const w = 1.6, h = 1.6;
    const newImage: UploadedImage = {
      id: `icon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      kind: "icon",
      iconId,
      dataUrl: "",
      x: (13.333 - w) / 2, y: (7.5 - h) / 2, w, h,
    };
    const slide = deck.slides[active];
    setDeck({
      ...deck,
      slides: deck.slides.map((s, i) =>
        i === active ? { ...s, uploadedImages: [...(slide.uploadedImages || []), newImage] } : s,
      ),
    });
  };

  /* ------------------------------- Export -------------------------------- */

  const downloadPptx = async () => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck, theme }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    triggerDownload(blob, `${slugify(deck.title)}.pptx`);
  };

  const downloadPdf = async () => {
    setRenderForPdf(true);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const nodes = hiddenRef.current?.getNodes() ?? [];
      if (nodes.length === 0) throw new Error("Could not render slides for PDF.");
      await exportSlidesToPdf(nodes, `${slugify(deck.title)}.pdf`);
    } finally {
      setRenderForPdf(false);
    }
  };

  const onExport = async (format: ExportFormat) => {
    // Both formats are paid. Gate behind the payment dialog if the deck
    // hasn't been unlocked yet.
    if (!paid) {
      setPaymentOpen(true);
      return;
    }
    setDownloading(true);
    try {
      if (format === "pptx") await downloadPptx();
      else await downloadPdf();
      trackEvent({
        kind: "deck_generated",
        topic: `download:${format}:${deck.title.slice(0, 80)}`,
        slides: deck.slides.length,
        ts: Date.now(),
      });
    } catch (e) {
      console.error(e);
      alert("Could not export. Check the console.");
    } finally {
      setDownloading(false);
    }
  };

  /* --------------------------------- UI --------------------------------- */

  const goPrev = () => setActive((a) => Math.max(0, a - 1));
  const goNext = () => setActive((a) => Math.min(deck.slides.length - 1, a + 1));

  const onShare = async () => {
    if (!user || !deckId) return;
    setSharing(true);
    try {
      const shareId = await publishDeck(user.uid, deckId);
      const url = `${window.location.origin}/share/${shareId}`;
      setShareUrl(url);
      setShareOpen(true);
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard might be blocked */ }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[deck] share failed:", e);
      alert("Could not publish a share link. Try again.");
    } finally {
      setSharing(false);
    }
  };

  const applyTheme = (next: Theme) => {
    if (setTheme) setTheme(next);
    setThemeTransferOpen(false);
  };

  return (
    <div className="fade-in mx-auto w-full max-w-[1400px]">
      {presenting && (
        <Presenter deck={deck} theme={theme} startIndex={active} onClose={() => setPresenting(false)} />
      )}
      {renderForPdf && <HiddenSlidesRenderer ref={hiddenRef} deck={deck} theme={theme} />}
      <DecorationDrawer
        open={decorOpen}
        theme={theme}
        initialMode="graphics"
        onClose={() => setDecorOpen(false)}
        onPick={(pick) => {
          if (pick.kind === "decoration") addDecoration(pick.id);
          else if (pick.kind === "icon") addIcon(pick.iconId);
        }}
      />
      <DecorationDrawer
        open={iconOpen}
        theme={theme}
        initialMode="icons"
        onClose={() => setIconOpen(false)}
        onPick={(pick) => {
          if (pick.kind === "decoration") addDecoration(pick.id);
          else if (pick.kind === "icon") addIcon(pick.iconId);
        }}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
            {deck.subtitle && <p className="text-sm text-white/60">{deck.subtitle}</p>}
          </div>
          <SaveBadge state={saveState} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef} type="file" accept="image/*" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadImage(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            title="Add an image to this slide"
          >
            <ImageIcon size={14} /> Add image
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            title="Undo last change (Ctrl/Cmd+Z)"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            onClick={() => setDecorOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            title="Add a graphic from the library"
          >
            <Shapes size={14} /> Add graphic
          </button>
          <button
            onClick={() => setIconOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            title="Search 200,000+ icons from Iconify"
          >
            <Smile size={14} /> Add icon
          </button>
          {setTheme && (
            <button
              onClick={() => setThemeTransferOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              title="Apply a different theme to the whole deck"
            >
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: theme.accent }} />
              Theme
            </button>
          )}
          {user && deckId && (
            <button
              onClick={onShare}
              disabled={sharing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
              title="Get a public link to share this deck"
            >
              <LinkIcon size={14} /> {sharing ? "Sharing…" : "Share"}
            </button>
          )}
          <button
            onClick={() => setPresenting(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-400/20"
            title="Start full-screen presentation (Esc to exit)"
          >
            <Play size={14} /> Present
          </button>
          <button
            onClick={onRestart}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            <RotateCcw size={14} /> Start over
          </button>
          <ExportButton onExport={onExport} busy={downloading} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
        <SlideRail
          deck={deck} theme={theme}
          active={active} setActive={setActive}
          onChange={(slides) => setDeck({ ...deck, slides })}
        />

        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <SlideCanvas
              slide={enrichedSlides[active]}
              theme={theme}
              idx={active}
              total={deck.slides.length}
              deckTitle={deck.title}
              graphicId={deck.graphic}
              graphicAccent={deck.graphicAccent}
              fontId={deck.fontId}
              interactive
              onUpdate={updateActive}
              selectedImageId={selectedImageId}
              onSelectImage={setSelectedImageId}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={active === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs text-white/50">Slide {active + 1} / {deck.slides.length}</span>
            <button
              onClick={goNext}
              disabled={active === deck.slides.length - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>

          <div className="mt-4">
            <DeckChat
              deck={deck}
              theme={theme}
              slideIndex={active}
              onApplySlide={replaceActive}
              onApplyDeck={setDeck}
            />
          </div>

          {deck.slides[active]?.notes && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <div className="mb-1 font-semibold uppercase tracking-wider text-white/40">Speaker notes</div>
              {deck.slides[active].notes}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/60">
          <DesignerPanel
            slide={deck.slides[active]}
            theme={theme}
            deck={deck}
            onUpdate={updateActive}
            onReplace={replaceActive}
            selectedImageId={selectedImageId}
            onDeselectImage={() => setSelectedImageId(null)}
          />
        </div>
      </div>

      {/* Share modal */}
      {shareOpen && shareUrl && (
        <ShareModal
          url={shareUrl}
          onClose={() => setShareOpen(false)}
          onUnpublish={async () => {
            if (!user || !deckId) return;
            try { await unpublishDeck(user.uid, deckId); } catch { /* ignore */ }
            setShareOpen(false);
            setShareUrl(null);
          }}
        />
      )}

      {/* Theme transfer modal */}
      {themeTransferOpen && setTheme && (
        <ThemeTransferModal
          current={theme}
          onClose={() => setThemeTransferOpen(false)}
          onPick={applyTheme}
        />
      )}

      {/* Razorpay payment dialog (only shown for unpaid PPTX exports) */}
      <PaymentDialog
        open={paymentOpen}
        deck={deck}
        deckId={deckId || null}
        onClose={() => setPaymentOpen(false)}
      />
    </div>
  );
}

/* ---------------------------- subcomponents ---------------------------- */

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  // Only surface the badge on actual failures. "Saving" + "Saved" used
  // to flash on every keystroke and on every AI edit, sliding into the
  // header layout. The autosave still runs silently.
  if (state !== "error") return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-200">
      Save failed
    </span>
  );
}

function ShareModal({
  url, onClose, onUnpublish,
}: { url: string; onClose: () => void; onUnpublish: () => Promise<void> | void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="m-4 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-200">
          <LinkIcon size={11} /> Public link
        </div>
        <h3 className="text-lg font-semibold text-white">Share this deck</h3>
        <p className="mt-2 text-sm text-white/65">
          Anyone with this link can view a read-only copy. The link reflects the
          version at publish time and updates whenever you click Share again.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
          <span className="flex-1 truncate font-mono text-[12px] text-white/85">{url}</span>
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
            }}
            className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-black hover:bg-white/90"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => onUnpublish()}
            className="text-xs text-white/55 underline-offset-2 hover:text-white/85 hover:underline"
          >
            Stop sharing
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeTransferModal({
  current, onClose, onPick,
}: { current: Theme; onClose: () => void; onPick: (t: Theme) => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="m-4 max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div>
            <div className="text-sm font-medium text-white">Apply a theme</div>
            <div className="text-[11px] text-white/50">Re-skins every slide instantly. Per-slide color overrides stay.</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">✕</button>
        </div>
        <div className="grid max-h-[65vh] grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 md:grid-cols-4">
          {PRESET_THEMES.map((t) => {
            const active = t.id === current.id;
            return (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className={`group overflow-hidden rounded-xl border text-left transition ${
                  active ? "border-white/60 ring-2 ring-white/30" : "border-white/10 hover:border-white/35"
                }`}
              >
                <div className="flex h-24 flex-col justify-between p-3" style={{ background: t.bg }}>
                  <div className="text-[11px] font-bold" style={{ color: t.accent }}>Sample title</div>
                  <div className="text-[9px]" style={{ color: t.muted }}>A short subtitle</div>
                  <div className="text-[8px]" style={{ color: t.fg }}>• Bullet line</div>
                </div>
                <div className="flex items-center justify-between bg-black/30 px-2 py-1.5">
                  <span className="text-[11px] text-white/85">{t.name}</span>
                  <div className="flex gap-1">
                    <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: t.bg }} />
                    <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: t.accent }} />
                    <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: t.fg }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slugify(s: string) {
  return (s || "deck").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}
