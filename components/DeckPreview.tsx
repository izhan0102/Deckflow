"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Deck, Slide, UploadedImage, TextBox } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { PRESET_THEMES } from "@/lib/themes";
import {
  BarChart3, ChevronDown, ChevronLeft, ChevronRight, Eye, Grid3x3, Image as ImageIcon, LayoutGrid, Link as LinkIcon, List, Loader2, Play, RotateCcw, Smile, Star, Undo2, X,
  Type, Bold, Italic, Underline as UnderlineIcon, Trash2, AlignLeft, AlignCenter, AlignRight, PanelRightOpen,
} from "lucide-react";
import SlideCanvas, { type CanvasSelection } from "./SlideCanvas";
import DesignerPanel from "./DesignerPanel";
import Presenter from "./Presenter";
import DeckChat from "./DeckChat";
import SlideRail from "./SlideRail";
import OutlineEditor from "./OutlineEditor";
import HiddenSlidesRenderer, { type HiddenSlidesHandle } from "./HiddenSlidesRenderer";
import ExportButton from "./ExportButton";
import DecorationDrawer from "./DecorationDrawer";
import { exportSlidesToPdf } from "@/lib/pdfExport";
import { trackEvent } from "@/lib/stats";
import type { ExportFormat } from "./ExportFormatPicker";
import { getDecoration } from "@/lib/decorations";
import { saveDeck, publishDeck, unpublishDeck } from "@/lib/decks";
import { submitReview, REVIEW_LIMITS } from "@/lib/reviews";
import { loadShareAnalytics, formatDwell, type ShareAnalytics } from "@/lib/analytics";
import { stripHtml, applyWholeStyle, readWholeStyle } from "@/lib/richText";
import { SLIDE_PATTERNS, PATTERN_OPACITY, patternToDataUri } from "@/lib/patterns";
import { FONT_PRESETS, resolveFontFamily } from "@/lib/fonts";
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
  const [viewMode, setViewMode] = useState<"slides" | "outline">("slides");
  const [downloading, setDownloading] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  // Right "insert" sidebar: collapsed by default, opens to Add text / image.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [placingText, setPlacingText] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [canvasSelection, setCanvasSelection] = useState<CanvasSelection>(null);
  const [renderForPdf, setRenderForPdf] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [themeTransferOpen, setThemeTransferOpen] = useState(false);
  // Mandatory one-time review before exporting (replaces the old payment
  // gate — exports are free now). Persisted per-browser so we only ask once.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewGiven, setReviewGiven] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
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
  // Has the user already left a review? We only gate the first export.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("ezdeck_reviewed") === "1") setReviewGiven(true);
    } catch { /* ignore */ }
  }, []);
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

  // Apply a whole-element text format (bold/italic/color/font/etc.) to the
  // currently selected fixed element, writing back to the right slide field.
  const applyElementFormat = (id: string, prop: string, value: string) => {
    const slide = deck.slides[active];
    if (!slide) return;
    if (id === "bullets") {
      const next = (slide.bullets || []).map((b) => applyWholeStyle(b, prop, value));
      updateActive({ bullets: next });
      return;
    }
    const field = elementFieldName(id);
    if (!field) return;
    const cur = (slide as any)[field] as string | undefined;
    updateActive({ [field]: applyWholeStyle(cur || "", prop, value) } as Partial<Slide>);
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
    // Exports are free, but we ask for a one-time review before the first
    // export of this session. Once submitted (or already given), exports
    // go straight through.
    if (!reviewGiven) {
      setPendingFormat(format);
      setReviewOpen(true);
      return;
    }
    await runExport(format);
  };

  const runExport = async (format: ExportFormat) => {
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
        open={iconOpen}
        theme={theme}
        initialMode="icons"
        onClose={() => setIconOpen(false)}
        onPick={(pick) => {
          if (pick.kind === "decoration") addDecoration(pick.id);
          else if (pick.kind === "icon") addIcon(pick.iconId);
        }}
      />
      <PatternPicker
        open={patternOpen}
        theme={theme}
        current={deck.slides[active]?.pattern}
        onClose={() => setPatternOpen(false)}
        onApply={(p) => setDeck({
          ...deck,
          // Patterns are deck-wide: apply (or clear) on every slide at once.
          slides: deck.slides.map((s) => ({ ...s, pattern: p })),
        })}
      />

      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* View toggle: slides ↔ outline — prominent segmented control */}
          <div
            role="tablist"
            aria-label="Editor view"
            className="inline-flex items-center rounded-xl border border-white/15 bg-white/[0.04] p-1 text-[13px]"
          >
            <button
              role="tab"
              aria-selected={viewMode === "slides"}
              onClick={() => setViewMode("slides")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-medium transition ${
                viewMode === "slides" ? "bg-white text-black shadow-sm" : "text-white/70 hover:text-white"
              }`}
              title="Edit slide by slide"
            >
              <LayoutGrid size={13} /> Slides
            </button>
            <button
              role="tab"
              aria-selected={viewMode === "outline"}
              onClick={() => setViewMode("outline")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-medium transition ${
                viewMode === "outline" ? "bg-white text-black shadow-sm" : "text-white/70 hover:text-white"
              }`}
              title="Edit the whole deck as an outline"
            >
              <List size={13} /> Outline
            </button>
          </div>
          <SaveBadge state={saveState} />
        </div>
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto [&>*]:shrink-0">
          <input
            ref={fileInputRef} type="file" accept="image/*" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadImage(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          {viewMode === "slides" && (
            <>
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
            onClick={() => setPatternOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            title="Add a background pattern to this slide"
          >
            <Grid3x3 size={14} /> Add pattern
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
            </>
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

      {viewMode === "outline" ? (
        <OutlineEditor deck={deck} setDeck={setDeck} active={active} setActive={setActive} />
      ) : (
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
              placingText={placingText}
              onPlaceText={(x, y) => {
                const id = `tb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
                const tb = { id, text: "Text", x: Math.max(0, x - 1), y: Math.max(0, y - 0.25), w: 3, fontSize: 18 };
                updateActive({ textBoxes: [...(deck.slides[active]?.textBoxes || []), tb] });
                setPlacingText(false);
                setSelectedTextId(id);
                setSidebarOpen(true);
              }}
              selectedTextId={selectedTextId}
              onSelectText={(id) => {
                setSelectedTextId(id);
                if (id) { setCanvasSelection(null); setSidebarOpen(true); }
              }}
              canvasSelection={canvasSelection}
              onCanvasSelect={(sel) => {
                setCanvasSelection(sel);
                if (sel) { setSelectedTextId(null); setSidebarOpen(true); }
              }}
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
      )}

      {/* Share modal */}
      {shareOpen && shareUrl && (
        <ShareModal
          url={shareUrl}
          deck={deck}
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

      {/* Right insert sidebar — add text / image, or edit a selected text box. */}
      <InsertSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        theme={theme}
        placingText={placingText}
        onStartPlaceText={() => { setPlacingText(true); setSelectedTextId(null); setCanvasSelection(null); }}
        onAddImage={() => fileInputRef.current?.click()}
        selectedText={selectedTextId ? (deck.slides[active]?.textBoxes || []).find((t) => t.id === selectedTextId) || null : null}
        onUpdateText={(patch) => {
          if (!selectedTextId) return;
          updateActive({ textBoxes: (deck.slides[active]?.textBoxes || []).map((t) => t.id === selectedTextId ? { ...t, ...patch } : t) });
        }}
        onDeleteText={() => {
          if (!selectedTextId) return;
          updateActive({ textBoxes: (deck.slides[active]?.textBoxes || []).filter((t) => t.id !== selectedTextId) });
          setSelectedTextId(null);
        }}
        onClearSelection={() => { setSelectedTextId(null); setCanvasSelection(null); }}
        decoSelection={canvasSelection}
        decoState={canvasSelection?.kind === "deco" ? (deck.slides[active]?.deco?.[canvasSelection.key] || {}) : null}
        onUpdateDeco={(patch) => {
          if (canvasSelection?.kind !== "deco") return;
          const key = canvasSelection.key;
          const cur = deck.slides[active]?.deco?.[key] || {};
          updateActive({ deco: { ...(deck.slides[active]?.deco || {}), [key]: { ...cur, ...patch } } });
        }}
        onDeleteDeco={() => {
          if (canvasSelection?.kind !== "deco") return;
          const key = canvasSelection.key;
          const cur = deck.slides[active]?.deco?.[key] || {};
          updateActive({ deco: { ...(deck.slides[active]?.deco || {}), [key]: { ...cur, hidden: true } } });
          setCanvasSelection(null);
        }}
        elementSelection={canvasSelection?.kind === "element" ? canvasSelection.id : null}
        elementSize={canvasSelection?.kind === "element" ? (deck.slides[active]?.elementFontSizes?.[canvasSelection.id]) : undefined}
        onUpdateElementSize={(size) => {
          if (canvasSelection?.kind !== "element") return;
          const id = canvasSelection.id;
          updateActive({ elementFontSizes: { ...(deck.slides[active]?.elementFontSizes || {}), [id]: size as any } });
        }}
        elementText={canvasSelection?.kind === "element" ? elementFieldValue(deck.slides[active], canvasSelection.id) : null}
        onFormatElement={(prop, value) => {
          if (canvasSelection?.kind !== "element") return;
          applyElementFormat(canvasSelection.id, prop, value);
        }}
        onResetElement={() => {
          if (canvasSelection?.kind !== "element") return;
          const id = canvasSelection.id;
          updateActive({ elementOffsets: { ...(deck.slides[active]?.elementOffsets || {}), [id]: { dx: 0, dy: 0 } } });
        }}
        onDeleteElement={() => {
          if (canvasSelection?.kind !== "element") return;
          const id = canvasSelection.id;
          updateActive({ elementHidden: { ...(deck.slides[active]?.elementHidden || {}), [id]: true } });
          setCanvasSelection(null);
        }}
      />

      {/* Mandatory one-time review before the first export (free). */}
      <ReviewGate
        open={reviewOpen}
        onClose={() => { setReviewOpen(false); setPendingFormat(null); }}
        onDone={async () => {
          try { window.localStorage.setItem("ezdeck_reviewed", "1"); } catch { /* ignore */ }
          setReviewGiven(true);
          setReviewOpen(false);
          const fmt = pendingFormat;
          setPendingFormat(null);
          if (fmt) await runExport(fmt);
        }}
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
  url, deck, onClose, onUnpublish,
}: { url: string; deck: Deck; onClose: () => void; onUnpublish: () => Promise<void> | void }) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"link" | "stats">("link");

  // Derive the shareId from the public URL (.../share/<shareId>).
  const shareId = url.split("/share/")[1] || "";

  const [stats, setStats] = useState<ShareAnalytics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const loadStats = async () => {
    if (!shareId) return;
    setStatsLoading(true);
    try {
      const a = await loadShareAnalytics(shareId);
      setStats(a);
    } finally {
      setStatsLoading(false);
      setStatsLoaded(true);
    }
  };

  // Load analytics the first time the user opens the Performance tab.
  const openStats = () => {
    setTab("stats");
    if (!statsLoaded) loadStats();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="m-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setTab("link")}
            className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-[12.5px] font-medium transition ${
              tab === "link" ? "text-white" : "text-white/45 hover:text-white/75"
            }`}
          >
            <LinkIcon size={12} /> Share link
          </button>
          <button
            onClick={openStats}
            className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-[12.5px] font-medium transition ${
              tab === "stats" ? "text-white" : "text-white/45 hover:text-white/75"
            }`}
          >
            <BarChart3 size={12} /> Performance
          </button>
        </div>

        <div className="p-6">
          {tab === "link" ? (
            <>
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
              <p className="mt-3 text-[11px] text-white/40">
                Want to know if they actually read it? Check the Performance tab.
              </p>
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
            </>
          ) : (
            <ShareStats
              deck={deck}
              stats={stats}
              loading={statsLoading}
              loaded={statsLoaded}
              onRefresh={loadStats}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Owner-facing view analytics for a shared deck. */
function ShareStats({
  deck, stats, loading, loaded, onRefresh, onClose,
}: {
  deck: Deck;
  stats: ShareAnalytics | null;
  loading: boolean;
  loaded: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  if (loading || !loaded) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-white/55">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[13px]">Loading view activity…</span>
      </div>
    );
  }

  const opens = stats?.opens || 0;

  if (opens === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5">
          <Eye size={18} className="text-white/45" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">No views yet</div>
          <p className="mx-auto mt-1 max-w-[16rem] text-[12px] text-white/50">
            Once someone opens your link, you'll see how many times it was viewed
            and which slides held attention.
          </p>
        </div>
      </div>
    );
  }

  // Slide-level dwell. views = times the slide was on screen, ms = total time.
  const slideRows = deck.slides.map((s, i) => {
    const rec = stats?.slides?.[String(i)];
    const views = rec?.views || 0;
    const ms = rec?.ms || 0;
    const avg = views > 0 ? ms / views : 0;
    return { i, title: stripHtml(s.title) || `Slide ${i + 1}`, views, avg };
  });
  const maxAvg = Math.max(1, ...slideRows.map((r) => r.avg));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Performance</h3>
        <button
          onClick={onRefresh}
          className="text-[11px] text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Headline stat */}
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-white">
          <Eye size={16} />
        </div>
        <div>
          <div className="text-xl font-semibold tabular-nums text-white">{opens.toLocaleString()}</div>
          <div className="text-[11px] text-white/50">total {opens === 1 ? "view" : "views"}</div>
        </div>
      </div>

      {/* Per-slide attention */}
      <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto pr-1">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Time spent per slide (avg)
        </div>
        {slideRows.map((r) => (
          <div key={r.i} className="flex items-center gap-2.5">
            <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-white/40">
              {r.i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] text-white/80">{r.title}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-white/50">
                  {r.avg > 0 ? formatDwell(r.avg) : "—"}
                </span>
              </div>
              <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-white/70"
                  style={{ width: `${Math.round((r.avg / maxAvg) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10.5px] text-white/35">
        Anonymous aggregate counts. No individual visitors are tracked.
      </p>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
        >
          Done
        </button>
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

/* ----------------------- Review gate (pre-export) ----------------------- */

/**
 * Shown once before a user's first export. EZdeck is free — instead of
 * payment, we ask for a quick honest review. On submit we record it (and
 * remember in localStorage so we never block again) and let the export run.
 */
function ReviewGate({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;
  const shown = hover || rating;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await submitReview({ name, role, rating, text });
      onDone();
    } catch (e: any) {
      setError(e?.message || "Couldn't submit. Try again.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border"
        style={{ background: "var(--ezd-bg-elev)", borderColor: "var(--ezd-divider)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--ezd-fg-strong)" }}>
            <Star size={13} /> One quick review, then download
          </span>
          <button onClick={onClose} disabled={busy} className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/10" style={{ color: "var(--ezd-fg-muted)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "var(--ezd-fg-muted)" }}>
            EZdeck is completely free. All we ask is a quick, honest review
            before your first download — the good ones get featured on the
            homepage.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, REVIEW_LIMITS.name))}
              placeholder="Your name"
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-white/30"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value.slice(0, REVIEW_LIMITS.role))}
              placeholder="What you do"
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div className="mt-3 flex items-center gap-2" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                aria-label={`${n} stars`}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  size={24}
                  style={{
                    fill: n <= shown ? "var(--ezd-fg-strong)" : "transparent",
                    color: n <= shown ? "var(--ezd-fg-strong)" : "var(--ezd-divider)",
                  }}
                />
              </button>
            ))}
            <span className="ml-1 text-[12.5px] tabular-nums text-white/55">{shown} / 5</span>
          </div>

          <div className="relative mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, REVIEW_LIMITS.text))}
              placeholder="A line or two — the UI, speed, workflow, whatever stood out."
              rows={3}
              className="w-full resize-none rounded-xl border border-white/12 bg-black/40 p-3 pb-7 text-sm leading-relaxed outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-white/35">
              {text.length}/{REVIEW_LIMITS.text}
            </span>
          </div>

          {error && <p className="mt-2 text-[12.5px] text-red-300">{error}</p>}

          <button
            onClick={submit}
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
            {busy ? "Submitting…" : "Submit & download"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Pattern picker (per-slide) ----------------------- */

/**
 * Modal for adding / changing / removing a subtle background pattern on the
 * current slide. Patterns tile the whole slide at low opacity so the text
 * stays readable. The user can pick a pattern, recolor it, or remove it.
 */
function PatternPicker({
  open, theme, current, onClose, onApply,
}: {
  open: boolean;
  theme: Theme;
  current?: { id: string; color?: string; opacity?: number };
  onClose: () => void;
  onApply: (p: { id: string; color?: string; opacity?: number } | undefined) => void;
}) {
  if (!open) return null;

  const activeId = current?.id;
  const activeColor = current?.color || theme.fg;
  const activeOpacity = current?.opacity ?? PATTERN_OPACITY;
  const SWATCHES = [theme.fg, theme.accent, theme.muted, "#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#A855F7"];

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add background pattern"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border"
        style={{ background: "var(--ezd-bg-elev)", borderColor: "var(--ezd-divider)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--ezd-divider)" }}>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--ezd-fg-strong)" }}>
            <Grid3x3 size={14} /> Background pattern
          </span>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/10" style={{ color: "var(--ezd-fg-muted)" }}>
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {/* Color row */}
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--ezd-fg-muted)" }}>
              Color
            </div>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => activeId && onApply({ id: activeId, color: c, opacity: activeOpacity })}
                  className="h-7 w-7 rounded-full transition"
                  style={{
                    background: c,
                    border: activeColor.toLowerCase() === c.toLowerCase() ? "2px solid var(--ezd-fg-strong)" : "1px solid var(--ezd-divider)",
                    opacity: activeId ? 1 : 0.4,
                    cursor: activeId ? "pointer" : "not-allowed",
                  }}
                  aria-label={`Pattern color ${c}`}
                  disabled={!activeId}
                />
              ))}
            </div>
            {!activeId && (
              <p className="mt-2 text-[11px]" style={{ color: "var(--ezd-fg-muted)" }}>
                Pick a pattern first, then choose a color.
              </p>
            )}
          </div>

          {/* Opacity slider */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--ezd-fg-muted)" }}>
                Opacity
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: "var(--ezd-fg-muted)" }}>
                {Math.round(activeOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={60}
              value={Math.round(activeOpacity * 100)}
              onChange={(e) => activeId && onApply({ id: activeId, color: current?.color, opacity: Number(e.target.value) / 100 })}
              disabled={!activeId}
              className="w-full accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>

          {/* Pattern grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SLIDE_PATTERNS.map((p) => {
              const selected = activeId === p.id;
              const uri = patternToDataUri(p.render(activeColor));
              return (
                <button
                  key={p.id}
                  onClick={() => onApply({ id: p.id, color: current?.color, opacity: current?.opacity })}
                  className="group relative overflow-hidden rounded-xl border text-left transition"
                  style={{
                    borderColor: selected ? "var(--ezd-fg-strong)" : "var(--ezd-divider)",
                    outline: selected ? "2px solid var(--ezd-fg-strong)" : "none",
                  }}
                >
                  <div className="relative h-24 w-full" style={{ background: theme.bg }}>
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url("${uri}")`,
                        backgroundSize: "cover",
                        opacity: Math.min(1, activeOpacity * 3.5), // boosted in the swatch so it's visible
                      }}
                    />
                    <span className="absolute left-2 top-2 text-[11px] font-medium" style={{ color: theme.fg }}>
                      Aa
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2" style={{ background: "var(--ezd-bg-card)" }}>
                    <span className="text-[11.5px]" style={{ color: "var(--ezd-fg-strong)" }}>{p.name}</span>
                    {selected && <span className="text-[10px]" style={{ color: "var(--ezd-fg-muted)" }}>selected</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: "1px solid var(--ezd-divider)" }}>
          <button
            onClick={() => { onApply(undefined); }}
            disabled={!activeId}
            className="rounded-xl border px-4 py-2 text-[12.5px] transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "var(--ezd-divider)", color: "var(--ezd-fg-muted)" }}
          >
            Remove pattern
          </button>
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2 text-[12.5px] font-semibold transition hover:brightness-110"
            style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Insert sidebar ------------------------------- */

/**
 * Right-edge collapsible "insert" panel. Collapsed by default with a small
 * arrow tab pointing left. When open it shows insert options (Add text, Add
 * image). When a free text box is selected it switches to text settings
 * (size, bold/italic/underline, color, alignment, delete).
 */
function InsertSidebar({
  open, onToggle, theme, placingText, onStartPlaceText, onAddImage,
  selectedText, onUpdateText, onDeleteText, onClearSelection,
  decoSelection, decoState, onUpdateDeco, onDeleteDeco,
  elementSelection, elementSize, elementText, onUpdateElementSize, onFormatElement, onResetElement, onDeleteElement,
}: {
  open: boolean;
  onToggle: () => void;
  theme: Theme;
  placingText: boolean;
  onStartPlaceText: () => void;
  onAddImage: () => void;
  selectedText: TextBox | null;
  onUpdateText: (patch: Partial<TextBox>) => void;
  onDeleteText: () => void;
  onClearSelection: () => void;
  decoSelection: CanvasSelection;
  decoState: { dx?: number; dy?: number; scale?: number; color?: string; hidden?: boolean } | null;
  onUpdateDeco: (patch: { scale?: number; color?: string; dx?: number; dy?: number }) => void;
  onDeleteDeco: () => void;
  elementSelection: string | null;
  elementSize?: number;
  elementText: string | null;
  onUpdateElementSize: (size: number | undefined) => void;
  onFormatElement: (prop: string, value: string) => void;
  onResetElement: () => void;
  onDeleteElement: () => void;
}) {
  const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 54, 72];
  const COLORS = ["", theme.fg, theme.accent, "#0F172A", "#FFFFFF", "#22D3EE", "#1D4ED8", "#DC2626", "#F59E0B", "#047857", "#7C3AED"];
  const decoActive = decoSelection?.kind === "deco";
  const elementActive = !!elementSelection;
  const panelTitle = selectedText ? "Text settings" : decoActive ? "Element settings" : elementActive ? "Text settings" : "Insert";

  return (
    <>
      {/* Arrow tab — always visible, pinned to the right edge mid-height. */}
      <button
        onClick={onToggle}
        title={open ? "Close panel" : "Insert text or image"}
        className="fixed right-0 top-1/2 z-[120] flex h-12 w-7 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-white/15 bg-zinc-900/90 shadow-lg backdrop-blur transition hover:bg-zinc-800"
        style={{ transform: open ? "translate(-300px, -50%)" : "translateY(-50%)", transition: "transform 240ms ease", color: "#ffffff" }}
      >
        <span className={!open ? "ezd-arrow-beat grid place-items-center rounded-full" : "grid place-items-center"}>
          {open ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </span>
      </button>

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-[115] flex h-full w-[300px] flex-col border-l border-white/10 bg-zinc-950/95 backdrop-blur"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms ease" }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-white">
            <PanelRightOpen size={14} /> {panelTitle}
          </span>
          <button onClick={onToggle} className="grid h-7 w-7 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white">
            <X size={14} />
          </button>
        </div>

        <div key={elementActive ? `el-${elementSelection}` : decoActive ? `deco-${decoSelection?.kind === "deco" ? decoSelection.key : ""}` : selectedText ? "text" : "insert"} className="ezd-panel-pop flex-1 overflow-y-auto p-4">
          {elementActive ? (
            <ElementSettings
              theme={theme}
              size={elementSize}
              text={elementText}
              onSetSize={onUpdateElementSize}
              onFormat={onFormatElement}
              onReset={onResetElement}
              onDelete={onDeleteElement}
              onDone={onClearSelection}
            />
          ) : decoActive ? (
            <DecoSettings
              theme={theme}
              state={decoState || {}}
              onUpdate={onUpdateDeco}
              onDelete={onDeleteDeco}
              onDone={onClearSelection}
            />
          ) : !selectedText ? (
            <div className="space-y-2.5">
              <button
                onClick={onStartPlaceText}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                  placingText ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-white/85 hover:bg-white/[0.06]"
                }`}
              >
                <Type size={16} />
                <span>
                  <span className="block font-medium">{placingText ? "Click on the slide…" : "Add text"}</span>
                  <span className="block text-[11px] text-white/45">{placingText ? "Pick where it goes" : "Drop a text box anywhere"}</span>
                </span>
              </button>
              <button
                onClick={onAddImage}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.06]"
              >
                <ImageIcon size={16} />
                <span>
                  <span className="block font-medium">Add image</span>
                  <span className="block text-[11px] text-white/45">Upload a photo or logo</span>
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Edit content */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Text</label>
                <textarea
                  value={stripHtml(selectedText.text)}
                  onChange={(e) => onUpdateText({ text: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-white/12 bg-black/40 p-2.5 text-sm text-white outline-none focus:border-white/30"
                />
                <p className="mt-1.5 text-[11px] text-white/40">Tip: drag the box on the slide to position it.</p>
              </div>

              {/* Font family */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Font</label>
                <FontDropdown
                  value={selectedText.fontId}
                  onChange={(id) => onUpdateText({ fontId: id })}
                />
              </div>

              {/* Font size */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Font size</label>
                <div className="flex flex-wrap gap-1.5">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdateText({ fontSize: s })}
                      className={`rounded-md border px-2 py-1 text-[11px] tabular-nums transition ${
                        selectedText.fontSize === s ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style toggles */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Style</label>
                <div className="flex gap-1.5">
                  <ToggleBtn active={!!selectedText.bold} onClick={() => onUpdateText({ bold: !selectedText.bold })}><Bold size={14} /></ToggleBtn>
                  <ToggleBtn active={!!selectedText.italic} onClick={() => onUpdateText({ italic: !selectedText.italic })}><Italic size={14} /></ToggleBtn>
                  <ToggleBtn active={!!selectedText.underline} onClick={() => onUpdateText({ underline: !selectedText.underline })}><UnderlineIcon size={14} /></ToggleBtn>
                  <span className="mx-1 w-px bg-white/10" />
                  <ToggleBtn active={(selectedText.align || "left") === "left"} onClick={() => onUpdateText({ align: "left" })}><AlignLeft size={14} /></ToggleBtn>
                  <ToggleBtn active={selectedText.align === "center"} onClick={() => onUpdateText({ align: "center" })}><AlignCenter size={14} /></ToggleBtn>
                  <ToggleBtn active={selectedText.align === "right"} onClick={() => onUpdateText({ align: "right" })}><AlignRight size={14} /></ToggleBtn>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => {
                    const isDefault = c === "";
                    const active = (selectedText.color || "") === c;
                    return (
                      <button
                        key={c || "default"}
                        onClick={() => onUpdateText({ color: c || undefined })}
                        className="h-7 w-7 rounded-full transition"
                        style={{
                          background: c || "transparent",
                          backgroundImage: isDefault ? "linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.4) 55%, transparent 55%)" : undefined,
                          border: active ? "2px solid #fff" : "1px solid rgba(255,255,255,0.25)",
                        }}
                        title={isDefault ? "Default" : c}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                <button
                  onClick={onClearSelection}
                  className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 transition hover:bg-white/10"
                >
                  Done
                </button>
                <button
                  onClick={onDeleteText}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-200 transition hover:bg-red-500/20"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md border transition ${
        active ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/* --------------------------- Font dropdown -------------------------------- */

/**
 * Custom font picker that renders each font's NAME in that font, so the
 * user can see what they're choosing (native <select> options can't be
 * individually styled cross-browser).
 */
function FontDropdown({
  value, onChange,
}: { value?: string; onChange: (id: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = FONT_PRESETS.find((f) => f.id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-white/12 bg-black/40 px-2.5 py-2 text-sm text-white outline-none transition focus:border-white/30"
      >
        <span style={{ fontFamily: current ? resolveFontFamily(current.id) : undefined }}>
          {current ? current.name : "Theme default"}
        </span>
        <ChevronDown size={14} className="shrink-0 text-white/45" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/12 bg-zinc-950/98 p-1 shadow-2xl backdrop-blur">
          <button
            onClick={() => { onChange(undefined); setOpen(false); }}
            className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition hover:bg-white/10 ${!value ? "text-white" : "text-white/70"}`}
          >
            Theme default
          </button>
          {FONT_PRESETS.map((f) => (
            <button
              key={f.id}
              onClick={() => { onChange(f.id); setOpen(false); }}
              className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[15px] transition hover:bg-white/10 ${value === f.id ? "bg-white/10 text-white" : "text-white/80"}`}
              style={{ fontFamily: resolveFontFamily(f.id) }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------- Decorative element settings ---------------------- */

/** Sidebar settings for a selected decorative element (line / bar / shape). */
function DecoSettings({
  theme, state, onUpdate, onDelete, onDone,
}: {
  theme: Theme;
  state: { scale?: number; color?: string };
  onUpdate: (patch: { scale?: number; color?: string; dx?: number; dy?: number }) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const SCALES = [0.5, 0.75, 1, 1.5, 2];
  const COLORS = [theme.accent, theme.fg, theme.muted, "#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#A855F7"];
  const curScale = state.scale ?? 1;
  const curColor = (state.color || theme.accent).toLowerCase();

  return (
    <div className="space-y-5">
      <p className="text-[12px] leading-relaxed text-white/55">
        Drag the element on the slide to reposition it, or adjust its size and color here.
      </p>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Size</label>
        <div className="flex flex-wrap gap-1.5">
          {SCALES.map((m) => (
            <button
              key={m}
              onClick={() => onUpdate({ scale: m })}
              className={`rounded-md border px-2.5 py-1 text-[11px] tabular-nums transition ${
                curScale === m ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:bg-white/10"
              }`}
            >
              {m}×
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onUpdate({ color: c })}
              className="h-7 w-7 rounded-full transition"
              style={{ background: c, border: curColor === c.toLowerCase() ? "2px solid #fff" : "1px solid rgba(255,255,255,0.25)" }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
        <button
          onClick={() => onUpdate({ dx: 0, dy: 0, scale: 1 })}
          className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 transition hover:bg-white/10"
        >
          Reset
        </button>
        <div className="flex gap-2">
          <button
            onClick={onDone}
            className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 transition hover:bg-white/10"
          >
            Done
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-200 transition hover:bg-red-500/20"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Fixed element (text) settings -------------------- */

/** Full text-formatting controls for a selected AI-generated / fixed text
 *  element. Formatting applies to the whole element via applyWholeStyle. */
function ElementSettings({
  theme, size, text, onSetSize, onFormat, onReset, onDelete, onDone,
}: {
  theme: Theme;
  size?: number;
  text: string | null;
  onSetSize: (size: number | undefined) => void;
  onFormat: (prop: string, value: string) => void;
  onReset: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 54, 72];
  const COLORS = ["", theme.fg, theme.accent, "#0F172A", "#FFFFFF", "#22D3EE", "#1D4ED8", "#DC2626", "#F59E0B", "#047857", "#7C3AED"];
  const html = text || "";
  const isBold = /font-weight:\s*(?:bold|[6-9]00)/.test(html) || /<(?:b|strong)\b/.test(html);
  const isItalic = /font-style:\s*italic/.test(html) || /<(?:i|em)\b/.test(html);
  const isUnderline = /text-decoration[^;"]*underline/.test(html) || /<u\b/.test(html);
  const curColor = readWholeStyle(html, "color").toLowerCase();

  return (
    <div className="space-y-5">
      <p className="text-[12px] leading-relaxed text-white/55">
        Drag to move on the slide. Format the whole element below, or select
        text inside it for partial formatting.
      </p>

      {/* Font family */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Font</label>
        <FontDropdown
          value={fontIdFromFamily(readWholeStyle(html, "font-family"))}
          onChange={(id) => onFormat("font-family", id ? fontFamilyFor(id) : "")}
        />
      </div>

      {/* Font size */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Font size {size ? `(${size}pt)` : "(auto)"}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => onSetSize(s)}
              className={`rounded-md border px-2 py-1 text-[11px] tabular-nums transition ${
                size === s ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:bg-white/10"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => onSetSize(undefined)}
            className={`rounded-md border px-2 py-1 text-[11px] transition ${
              !size ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:bg-white/10"
            }`}
          >
            Auto
          </button>
        </div>
      </div>

      {/* Style toggles */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Style</label>
        <div className="flex gap-1.5">
          <ToggleBtn active={isBold} onClick={() => onFormat("font-weight", isBold ? "" : "700")}><Bold size={14} /></ToggleBtn>
          <ToggleBtn active={isItalic} onClick={() => onFormat("font-style", isItalic ? "" : "italic")}><Italic size={14} /></ToggleBtn>
          <ToggleBtn active={isUnderline} onClick={() => onFormat("text-decoration", isUnderline ? "" : "underline")}><UnderlineIcon size={14} /></ToggleBtn>
          <span className="mx-1 w-px bg-white/10" />
          <ToggleBtn active={false} onClick={() => onFormat("text-align", "left")}><AlignLeft size={14} /></ToggleBtn>
          <ToggleBtn active={false} onClick={() => onFormat("text-align", "center")}><AlignCenter size={14} /></ToggleBtn>
          <ToggleBtn active={false} onClick={() => onFormat("text-align", "right")}><AlignRight size={14} /></ToggleBtn>
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => {
            const isDefault = c === "";
            const active = curColor === c.toLowerCase();
            return (
              <button
                key={c || "default"}
                onClick={() => onFormat("color", c)}
                className="h-7 w-7 rounded-full transition"
                style={{
                  background: c || "transparent",
                  backgroundImage: isDefault ? "linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.4) 55%, transparent 55%)" : undefined,
                  border: active ? "2px solid #fff" : "1px solid rgba(255,255,255,0.25)",
                }}
                title={isDefault ? "Default" : c}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
        <button
          onClick={onReset}
          className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 transition hover:bg-white/10"
        >
          Reset position
        </button>
        <div className="flex gap-2">
          <button
            onClick={onDone}
            className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 transition hover:bg-white/10"
          >
            Done
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-200 transition hover:bg-red-500/20"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/** Map a stored font-family string back to a preset id (best-effort). */
function fontIdFromFamily(family: string): string | undefined {
  if (!family) return undefined;
  const f = FONT_PRESETS.find((p) => family.includes(p.name) || p.family === family);
  return f?.id;
}
function fontFamilyFor(id: string): string {
  return resolveFontFamily(id);
}


/* -------------------- element id <-> slide field mapping ------------------ */

function elementFieldName(id: string): "title" | "subtitle" | "body" | "quote" | "kicker" | null {
  if (id === "title") return "title";
  if (id === "subtitle") return "subtitle";
  if (id === "body") return "body";
  if (id === "kicker") return "kicker";
  if (id === "quote") return "body"; // quote layout stores its text in body
  return null;
}

function elementFieldValue(slide: Slide | undefined, id: string): string {
  if (!slide) return "";
  if (id === "bullets") return (slide.bullets || [])[0] || "";
  const field = elementFieldName(id);
  if (!field) return "";
  return ((slide as any)[field] as string) || "";
}
