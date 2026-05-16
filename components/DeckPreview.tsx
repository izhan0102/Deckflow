"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Deck, Slide, UploadedImage } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import {
  ChevronLeft, ChevronRight, Image as ImageIcon, Play, RotateCcw, Shapes,
} from "lucide-react";
import SlideCanvas from "./SlideCanvas";
import DesignerPanel from "./DesignerPanel";
import SlideChat from "./SlideChat";
import Presenter from "./Presenter";
import SlideRail from "./SlideRail";
import HiddenSlidesRenderer, { type HiddenSlidesHandle } from "./HiddenSlidesRenderer";
import ExportButton from "./ExportButton";
import DecorationDrawer from "./DecorationDrawer";
import { exportSlidesToPdf } from "@/lib/pdfExport";
import { trackEvent } from "@/lib/stats";
import type { ExportFormat } from "./ExportFormatPicker";
import { getDecoration } from "@/lib/decorations";

type Props = {
  deck: Deck;
  setDeck: (d: Deck) => void;
  theme: Theme;
  onRestart: () => void;
};

export default function DeckPreview({ deck, setDeck, theme, onRestart }: Props) {
  const [active, setActive] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [decorOpen, setDecorOpen] = useState(false);
  const [renderForPdf, setRenderForPdf] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HiddenSlidesHandle>(null);

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

  return (
    <div className="fade-in mx-auto w-full max-w-[1400px]">
      {presenting && (
        <Presenter deck={deck} theme={theme} startIndex={active} onClose={() => setPresenting(false)} />
      )}
      {renderForPdf && <HiddenSlidesRenderer ref={hiddenRef} deck={deck} theme={theme} />}
      <DecorationDrawer
        open={decorOpen}
        theme={theme}
        onClose={() => setDecorOpen(false)}
        onPick={(pick) => {
          if (pick.kind === "decoration") addDecoration(pick.id);
          else if (pick.kind === "icon") addIcon(pick.iconId);
        }}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deck.title}</h1>
          {deck.subtitle && <p className="text-sm text-white/60">{deck.subtitle}</p>}
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
            onClick={() => setDecorOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            title="Add a graphic from the library"
          >
            <Shapes size={14} /> Add graphic
          </button>
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

          <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/70 p-3">
            <SlideChat
              deck={deck}
              theme={theme}
              slideIndex={active}
              slideKey={`slide-${active}`}
              onApply={replaceActive}
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
