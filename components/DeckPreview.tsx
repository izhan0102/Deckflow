"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Deck, Slide, UploadedImage, TextBox, ContentDensity } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { PRESET_THEMES, getTheme } from "@/lib/themes";
import {
  BarChart3, ChevronDown, ChevronLeft, ChevronRight, Eye, Grid3x3, Image as ImageIcon, LayoutGrid, Link as LinkIcon, List, Loader2, NotebookText, Play, RotateCcw, Smile, Star, Undo2, X,
  Type, Bold, Italic, Underline as UnderlineIcon, Trash2, AlignLeft, AlignCenter, AlignRight, PanelRightOpen,
  Users, Plus, Minus, Languages, MessageCircleQuestion, Send, Lock, Check, SlidersHorizontal, LayoutTemplate,
} from "lucide-react";
import SlideCanvas, { type CanvasSelection } from "./SlideCanvas";
import DesignerPanel from "./DesignerPanel";
import Presenter from "./Presenter";
import DeckChat from "./DeckChat";
import SlideRail from "./SlideRail";
import OutlineEditor from "./OutlineEditor";
import HiddenSlidesRenderer, { type HiddenSlidesHandle } from "./HiddenSlidesRenderer";
import HiddenHandoutRenderer, { type HiddenHandoutHandle } from "./HiddenHandoutRenderer";
import ExportButton from "./ExportButton";
import DecorationDrawer from "./DecorationDrawer";
import { exportSlidesToPdf, exportHandoutToPdf } from "@/lib/pdfExport";
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
import { getIdToken } from "@/lib/auth";
import { watchUserPlan } from "@/lib/plan";
import { type PlanId, planHasFeature, planShowsWatermark } from "@/lib/plans";
import UpgradeDialog from "./UpgradeDialog";
import DeckTour from "./DeckTour";
import GenerateOverlay from "./GenerateOverlay";
import TemplateGallery from "./TemplateGallery";
import { type DeckTemplate } from "@/lib/templates";
import { applyCustomTemplateToDeck } from "@/lib/applyCustomTemplate";
import { watchCustomTemplates, deleteCustomTemplate, type CustomTemplate } from "@/lib/customTemplates";
import VisualsDrawer from "./VisualsDrawer";
import ImagesDrawer from "./ImagesDrawer";
import { searchPexels, type PexelsPhoto } from "@/lib/pexels";
import type { ChartSpec } from "@/lib/charts";

const DENSITY_TABS: { id: ContentDensity; label: string }[] = [
  { id: "concise", label: "Concise" },
  { id: "balanced", label: "Balanced" },
  { id: "detailed", label: "Detailed" },
  { id: "comprehensive", label: "In-depth" },
];

const DENSITY_HINTS: Record<ContentDensity, string> = {
  concise: "3 short bullets",
  balanced: "4 medium bullets",
  detailed: "5 full sentences",
  comprehensive: "5–6 rich bullets",
};

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
  const [notesState, setNotesState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [notesMenuOpen, setNotesMenuOpen] = useState(false);
  const [customNotesOpen, setCustomNotesOpen] = useState(false);
  const [notesViewOpen, setNotesViewOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [plan, setPlan] = useState<PlanId>("free");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  // Density rewrite (premium): re-runs the AI to rewrite the whole deck's
  // bullets at a new content density while showing the building overlay.
  const [densifying, setDensifying] = useState(false);
  const [densityError, setDensityError] = useState<string | null>(null);
  const [densityMenuOpen, setDensityMenuOpen] = useState(false);
  const pendingDensityRef = useRef<ContentDensity | null>(null);
  // Template switch (premium): re-skin the whole deck with another template.
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  // Add-visuals (charts) drawer + the chart element currently being edited.
  const [visualsOpen, setVisualsOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<{ id: string; spec: ChartSpec } | null>(null);
  // Pexels image drawer + "related images" sidebar state.
  const [imagesOpen, setImagesOpen] = useState(false);
  const [imageReplaceId, setImageReplaceId] = useState<string | null>(null);
  const [imageQuery, setImageQuery] = useState("");
  const [relatedImages, setRelatedImages] = useState<PexelsPhoto[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Load the user's saved custom templates for the gallery.
  useEffect(() => {
    if (!user) return;
    const unsub = watchCustomTemplates(user.uid, setCustomTemplates);
    return () => unsub();
  }, [user]);

  // Live plan so feature locks reflect upgrades immediately.
  useEffect(() => {
    if (!user) return;
    const unsub = watchUserPlan(user.uid, setPlan);
    return () => unsub();
  }, [user]);

  const requireFeatureOrUpgrade = (
    feature: "speakerNotes" | "qaPrep" | "translate" | "icons" | "reorder" | "density" | "template",
    reason: string,
    run: () => void,
  ) => {
    if (planHasFeature(plan, feature)) { run(); return; }
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  };
  const [patternOpen, setPatternOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  // Right "insert" sidebar: collapsed by default, opens to Add text / image.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [placingText, setPlacingText] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [canvasSelection, setCanvasSelection] = useState<CanvasSelection>(null);
  const [renderForPdf, setRenderForPdf] = useState(false);
  const [renderForHandout, setRenderForHandout] = useState(false);
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

  const undo = useCallback(() => {
    const hist = historyRef.current;
    if (hist.length < 2) return;
    // Pop current state; the new "last" is the previous state.
    hist.pop();
    const prev = hist[hist.length - 1];
    if (!prev) return;
    skipNextHistoryPushRef.current = true;
    setDeck(prev);
    setCanUndo(hist.length > 1);
  }, [setDeck, setCanUndo]);

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
  }, [undo]);
  // Has the user already left a review? We only gate the first export.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("ezdeck_reviewed") === "1") setReviewGiven(true);
    } catch { /* ignore */ }
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HiddenSlidesHandle>(null);
  const handoutRef = useRef<HiddenHandoutHandle>(null);

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

  // When a photo (kind "user", incl. AI-placed) is selected, fetch related
  // images for the slide topic so the sidebar offers one-click replacements.
  useEffect(() => {
    const img = (deck.slides[active]?.uploadedImages || []).find((im) => im.id === selectedImageId);
    if (!selectedImageId || !img || (img.kind && img.kind !== "user")) { setRelatedImages([]); return; }
    let cancelled = false;
    setRelatedLoading(true);
    const q = deck.slides[active]?.title || deck.topic || deck.title || "background";
    searchPexels(q, { perPage: 9 })
      .then((r) => { if (!cancelled) setRelatedImages(r); })
      .catch(() => { if (!cancelled) setRelatedImages([]); })
      .finally(() => { if (!cancelled) setRelatedLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImageId, active]);

  // Is the active slide an intro/closing slide that uses a cover photo?
  const slideIsCover = (s?: Slide): boolean => {
    if (!s) return false;
    const tv = s.titleVariant;
    return (s.layout === "title-hero" && (tv === "image-cover" || tv === "image-center" || tv === "image-editorial")) ||
      (s.layout === "closing" && s.closingVariant === "image");
  };
  const coverMode = slideIsCover(deck.slides[active]);

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

  /* ------------------------------- Images --------------------------------- */

  // Append a Pexels photo to the active slide as a movable/resizable image.
  const addStockImage = (photo: PexelsPhoto) => {
    const slide = deck.slides[active];
    const tv = slide?.titleVariant;
    const isCover =
      (slide?.layout === "title-hero" && (tv === "image-cover" || tv === "image-center" || tv === "image-editorial")) ||
      (slide?.layout === "closing" && slide?.closingVariant === "image");
    // On an image title/closing slide, the photo IS that variant's cover —
    // set it on coverImages at the variant's index, not as a floating image.
    if (isCover) {
      const idx = tv === "image-center" ? 1 : tv === "image-editorial" ? 2 : 0;
      const covers = [...(slide.coverImages || [])];
      while (covers.length <= idx) covers.push("");
      covers[idx] = photo.src.large;
      setDeck({
        ...deck,
        slides: deck.slides.map((s, i) => i === active ? { ...s, coverImages: covers } : s),
      });
      return;
    }
    const ar = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
    const w = 5.4;
    const h = Math.max(0.8, Math.min(6.6, w / ar));
    const newImage: UploadedImage = {
      id: `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      kind: "user",
      dataUrl: photo.src.large,
      x: (13.333 - w) / 2, y: (7.5 - h) / 2, w, h,
    };
    setDeck({
      ...deck,
      slides: deck.slides.map((s, i) =>
        i === active ? { ...s, uploadedImages: [...(slide.uploadedImages || []), newImage] } : s,
      ),
    });
  };

  // Swap the photo behind an existing image element, keeping its position
  // and width (height re-derived from the new aspect ratio).
  const replaceImageWith = (id: string, photo: PexelsPhoto) => {
    const ar = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
    setDeck({
      ...deck,
      slides: deck.slides.map((s, i) => i === active ? {
        ...s,
        uploadedImages: (s.uploadedImages || []).map((im) =>
          im.id === id ? { ...im, dataUrl: photo.src.large, h: Math.max(0.8, Math.min(6.6, im.w / ar)) } : im,
        ),
      } : s),
    });
  };

  const onPickImage = (photo: PexelsPhoto) => {
    if (imageReplaceId) replaceImageWith(imageReplaceId, photo);
    else addStockImage(photo);
  };

  const openAddImages = () => {
    setImageReplaceId(null);
    setImageQuery(deck.topic || deck.title || "");
    setImagesOpen(true);
  };

  /* ------------------------------- Visuals -------------------------------- */

  const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  // Place a chart as a free, draggable element on the current slide. When
  // dropped, atX/atY (slide inches) center it on the drop point.
  const addChartToCurrent = (spec: ChartSpec, atX?: number, atY?: number) => {
    const w = 5.2, h = 3.25; // chart SVG is 16:10
    const x = atX != null ? clampN(atX - w / 2, 0, 13.333 - w) : (13.333 - w) / 2;
    const y = atY != null ? clampN(atY - h / 2, 0, 7.5 - h) : (7.5 - h) / 2;
    const id = `chart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newImage: UploadedImage = { id, kind: "chart", chartSpec: spec, dataUrl: "", x, y, w, h };
    const slide = deck.slides[active];
    setDeck({
      ...deck,
      slides: deck.slides.map((s, i) =>
        i === active ? { ...s, uploadedImages: [...(slide.uploadedImages || []), newImage] } : s,
      ),
    });
    setSelectedImageId(id);
  };

  // Insert a brand-new chart slide right after the current one.
  const addChartNewSlide = (spec: ChartSpec) => {
    const newSlide: Slide = { layout: "chart", title: spec.title || "Chart", chart: spec, bullets: [] };
    const next = [...deck.slides];
    next.splice(active + 1, 0, newSlide);
    setDeck({ ...deck, slides: next });
    setActive(active + 1);
  };

  // Update an existing chart's spec (data / type / colors). Handles both a
  // floating chart element and the dedicated chart-layout slide's chart.
  const updateChartElement = (id: string, spec: ChartSpec) => {
    if (id === "__slide__chart") { updateActive({ chart: spec }); return; }
    const slide = deck.slides[active];
    setDeck({
      ...deck,
      slides: deck.slides.map((s, i) =>
        i === active
          ? { ...s, uploadedImages: (slide.uploadedImages || []).map((im) => im.id === id ? { ...im, chartSpec: spec } : im) }
          : s,
      ),
    });
  };

  const editChartElement = (id: string) => {
    if (id === "__slide__chart") {
      const spec = deck.slides[active]?.chart;
      if (spec) { setEditingChart({ id, spec }); setVisualsOpen(true); }
      return;
    }
    const img = (deck.slides[active]?.uploadedImages || []).find((im) => im.id === id);
    if (img?.chartSpec) { setEditingChart({ id, spec: img.chartSpec }); setVisualsOpen(true); }
  };

  /* ------------------------------- Export -------------------------------- */

  const hasNotes = !!deck.speakerNotesGenerated;

  // Generate spoken speaker notes for every slide via the AI, then fold each
  // script into the matching slide's `notes`. Powers the presenter
  // teleprompter and the PPTX speaker-notes export. When `speakers` is passed
  // (group presentations) the script is divided per presenter and stored as
  // `noteSegments` for the Show-notes view.
  const generateNotes = async (speakers?: string[], setting?: string) => {
    if (notesState === "loading") return;
    setNotesState("loading");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/speaker-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          deck,
          audience: deck.audience,
          tone: deck.tone,
          ...(speakers && speakers.length >= 2 ? { speakers, setting } : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        notes?: { index: number; script: string; segments?: { speaker: string; text: string }[] }[];
      };
      const byIndex = new Map<number, { script: string; segments?: { speaker: string; text: string }[] }>();
      for (const n of data.notes || []) {
        if (typeof n?.index === "number" && typeof n?.script === "string") {
          byIndex.set(n.index, { script: n.script, segments: n.segments });
        }
      }
      setDeck({
        ...deck,
        speakerNotesGenerated: true,
        slides: deck.slides.map((s, i) => {
          const got = byIndex.get(i);
          if (!got || !got.script) return s;
          return { ...s, notes: got.script, noteSegments: got.segments };
        }),
      });
      setNotesState("done");
      setNotesViewOpen(true);
      window.setTimeout(() => setNotesState("idle"), 2500);
    } catch (e) {
      console.error("[generateNotes] failed:", e);
      setNotesState("error");
      window.setTimeout(() => setNotesState("idle"), 3000);
    }
  };

  // Translate the whole deck in place into a target language. Only text
  // changes; layout/theme/charts stay put. Returns true on success.
  const translateDeckTo = async (language: string): Promise<boolean> => {
    if (translating || !language.trim()) return false;
    setTranslating(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deck, targetLanguage: language.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { deck?: Deck };
      if (data.deck) setDeck(data.deck);
      return true;
    } catch (e) {
      console.error("[translateDeck] failed:", e);
      return false;
    } finally {
      setTranslating(false);
    }
  };

  const downloadPptx = async () => {
    const token = await getIdToken();
    const res = await fetch("/api/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

  const downloadHandout = async () => {
    setRenderForHandout(true);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      const nodes = handoutRef.current?.getNodes() ?? [];
      if (nodes.length === 0) throw new Error("Could not render handout.");
      await exportHandoutToPdf(nodes, `${slugify(deck.title)}-handout.pdf`);
    } finally {
      setRenderForHandout(false);
    }
  };

  const onExport = async (format: ExportFormat) => {
    // The notes handout is a Pro feature — gate it before anything else.
    if (format === "handout" && !planHasFeature(plan, "handout")) {
      setUpgradeReason("The notes handout PDF is a Pro feature. Upgrade to export slides with speaker notes.");
      setUpgradeOpen(true);
      return;
    }
    // We ask for a one-time review before the first export of this session.
    // Once submitted (or already given), exports go straight through.
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
      else if (format === "handout") await downloadHandout();
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

  const currentDensity: ContentDensity = deck.density || "balanced";
  const currentDensityLabel = DENSITY_TABS.find((d) => d.id === currentDensity)?.label || "Balanced";

  // Premium: rewrite the whole deck's bullet content at a new density. Shows
  // the EXdeck building overlay while the AI reworks every content slide.
  const runDensity = async (target: ContentDensity) => {
    pendingDensityRef.current = target;
    setDensityError(null);
    setDensifying(true);
    // Keep the animation up for a beat so the rewrite feels intentional.
    const minDelay = new Promise<void>((r) => window.setTimeout(r, 6500));
    try {
      const token = await getIdToken();
      const fetchPromise = (async () => {
        const res = await fetch("/api/redensify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ deck, density: target }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Couldn't change the density. Try again.");
        return data as { deck?: Deck };
      })();
      const [data] = await Promise.all([fetchPromise, minDelay]);
      if (data?.deck) setDeck(data.deck);
      else setDeck({ ...deck, density: target });
    } catch (e: any) {
      await minDelay.catch(() => {});
      setDensityError(e?.message || "Something went wrong changing the density.");
    } finally {
      setDensifying(false);
    }
  };

  const changeDensity = (target: ContentDensity) => {
    if (target === currentDensity || densifying) return;
    requireFeatureOrUpgrade(
      "density",
      "Changing the deck's density is a Pro feature. Upgrade to rewrite your whole deck at a new level of detail.",
      () => runDensity(target),
    );
  };

  // Premium: re-skin the whole deck with a different preset template. Theme,
  // font, graphic, and per-layout variants change; content stays put. We
  // force the template's variants (the shared helper only fills blanks) and
  // clear any per-slide overrides a previous template left behind.
  const applyPresetTemplate = (t: DeckTemplate) => {
    const picked = getTheme(t.themeId);
    if (picked && setTheme) setTheme(picked);
    const v = t.variants;
    setDeck({
      ...deck,
      graphic: t.graphicId,
      graphicAccent: t.graphicAccent,
      fontId: t.fontId,
      slides: deck.slides.map((s) => {
        // The intro's image cover and the image closing are deliberate photo
        // slides — keep them intact across a template swap (their photos live
        // in coverImages, which the spread preserves).
        const keepTitle = s.layout === "title-hero" &&
          (s.titleVariant === "image-cover" || s.titleVariant === "image-center" || s.titleVariant === "image-editorial");
        const keepClosing = s.layout === "closing" && s.closingVariant === "image";
        return {
          ...s,
          titleVariant: keepTitle ? s.titleVariant : (v.titleVariant ?? s.titleVariant),
          bulletsVariant: v.bulletsVariant ?? s.bulletsVariant,
          twoColumnVariant: v.twoColumnVariant ?? s.twoColumnVariant,
          tableVariant: v.tableVariant ?? s.tableVariant,
          quoteVariant: v.quoteVariant ?? s.quoteVariant,
          sectionVariant: v.sectionVariant ?? s.sectionVariant,
          closingVariant: keepClosing ? s.closingVariant : (v.closingVariant ?? s.closingVariant),
          // Drop overrides a previous template applied so the new look shows.
          textColorOverride: undefined,
          accentColorOverride: undefined,
          backgroundColorOverride: undefined,
          templateFonts: undefined,
          uploadedImages: (s.uploadedImages || []).filter((im) => im.kind !== "templateBg"),
        };
      }),
    });
    setTemplateGalleryOpen(false);
  };

  // Premium: re-skin the deck to follow one of the user's custom templates.
  const applyCustomTemplate = (t: CustomTemplate) => {
    const applied = applyCustomTemplateToDeck(deck, t);
    setDeck(applied.deck);
    if (setTheme) setTheme(applied.theme);
    setTemplateGalleryOpen(false);
  };

  const openTemplateGallery = () => {
    requireFeatureOrUpgrade(
      "template",
      "Switching templates is a Pro feature. Upgrade to restyle your whole deck with a different template.",
      () => setTemplateGalleryOpen(true),
    );
  };

  return (
    <div className="fade-in mx-auto w-full max-w-[1400px]">
      <DeckTour userId={user?.uid ?? null} />
      {(densifying || !!densityError) && (
        <GenerateOverlay
          open
          loading={densifying}
          error={densityError}
          onRetry={() => {
            const t = pendingDensityRef.current;
            setDensityError(null);
            if (t) void runDensity(t);
          }}
        />
      )}
      {templateGalleryOpen && (
        <TemplateGallery
          open
          onClose={() => setTemplateGalleryOpen(false)}
          customTemplates={customTemplates}
          onPick={applyPresetTemplate}
          onPickCustom={applyCustomTemplate}
          onDeleteCustom={(t) => { if (user) deleteCustomTemplate(user.uid, t.id).catch(() => {}); }}
        />
      )}
      {presenting && (
        <Presenter deck={deck} theme={theme} startIndex={active} onClose={() => setPresenting(false)} />
      )}
      {notesMenuOpen && (
        <NotesModeDialog
          onClose={() => setNotesMenuOpen(false)}
          onQuick={() => { setNotesMenuOpen(false); generateNotes(); }}
          onCustom={() => { setNotesMenuOpen(false); setCustomNotesOpen(true); }}
        />
      )}
      {customNotesOpen && (
        <CustomNotesDialog
          onClose={() => setCustomNotesOpen(false)}
          onGenerate={(speakers, setting) => { setCustomNotesOpen(false); generateNotes(speakers, setting); }}
        />
      )}
      {notesViewOpen && (
        <NotesViewModal
          deck={deck}
          onClose={() => setNotesViewOpen(false)}
          onRegenerate={() => { setNotesViewOpen(false); setNotesMenuOpen(true); }}
        />
      )}
      {translateOpen && (
        <TranslateDialog
          busy={translating}
          onClose={() => setTranslateOpen(false)}
          onTranslate={async (lang) => {
            const ok = await translateDeckTo(lang);
            if (ok) setTranslateOpen(false);
          }}
        />
      )}
      {qaOpen && (
        <QAPrepModal deck={deck} onClose={() => setQaOpen(false)} />
      )}
      {upgradeOpen && (
        <UpgradeDialog
          currentPlan={plan}
          reason={upgradeReason}
          onClose={() => setUpgradeOpen(false)}
        />
      )}
      {renderForPdf && <HiddenSlidesRenderer ref={hiddenRef} deck={deck} theme={theme} watermark={planShowsWatermark(plan)} />}
      {renderForHandout && <HiddenHandoutRenderer ref={handoutRef} deck={deck} theme={theme} />}
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
            data-tour="tour-outline"
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
          {viewMode === "slides" && (
            <div className="relative hidden lg:block" data-tour="tour-density">
              <button
                onClick={() => setDensityMenuOpen((o) => !o)}
                disabled={densifying}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                title="Change the whole deck's content density"
              >
                <SlidersHorizontal size={13} className="opacity-70" />
                <span className="text-white/55">Density:</span>
                <span className="font-medium text-white">{currentDensityLabel}</span>
                {!planHasFeature(plan, "density") && <Lock size={11} className="opacity-60" />}
                <ChevronDown size={12} className="opacity-60" />
              </button>
              {densityMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDensityMenuOpen(false)} />
                  <div
                    className="absolute left-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl border p-1 shadow-2xl"
                    style={{ background: "var(--ezd-bg-elev)", borderColor: "var(--ezd-hairline)" }}
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                      Content density
                      {!planHasFeature(plan, "density") && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-white/50"><Lock size={9} /> Pro</span>
                      )}
                    </div>
                    {DENSITY_TABS.map((d) => {
                      const activeD = currentDensity === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => { setDensityMenuOpen(false); changeDensity(d.id); }}
                          disabled={densifying}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition disabled:opacity-60 ${
                            activeD ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/10"
                          }`}
                        >
                          <span>
                            <span className="font-medium">{d.label}</span>
                            <span className="ml-1.5 text-[10.5px] text-white/40">{DENSITY_HINTS[d.id]}</span>
                          </span>
                          {activeD && <Check size={14} className="shrink-0 text-cyan-300" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto [&>*]:shrink-0 [&_button]:gap-1.5 [&_button]:rounded-lg [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-[12.5px]">
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
            onClick={undo}
            disabled={!canUndo}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            title="Undo last change (Ctrl/Cmd+Z)"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            onClick={() => requireFeatureOrUpgrade("icons", "Adding icons is a Pro feature. Upgrade to use the icon library.", () => setIconOpen(true))}
            data-tour="tour-icon"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            title="Search 200,000+ icons from Iconify"
          >
            <Smile size={14} /> Add icon
            {!planHasFeature(plan, "icons") && <Lock size={12} className="opacity-60" />}
          </button>
          <button
            onClick={openTemplateGallery}
            data-tour="tour-template"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            title="Switch the whole deck to a different template (theme, font, graphic, layout)"
          >
            <LayoutTemplate size={14} /> Template
            {!planHasFeature(plan, "template") && <Lock size={12} className="opacity-60" />}
          </button>
            </>
          )}
          {user && deckId && (
            <button
              onClick={onShare}
              disabled={sharing}
              data-tour="tour-share"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
              title="Get a public link to share this deck"
            >
              <LinkIcon size={14} /> {sharing ? "Sharing…" : "Share"}
            </button>
          )}
          <div className="relative" data-tour="tour-notes" />
          {coverMode && (            <button
              onClick={openAddImages}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-90"
              style={{ background: "var(--ezd-button-strong)", color: "var(--ezd-button-strong-fg)" }}
              title="Replace this slide's photo with a relevant one"
            >
              <ImageIcon size={14} /> Replace image
            </button>
          )}
          <button
            onClick={() => setPresenting(true)}
            data-tour="tour-present"
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
          <span data-tour="tour-export">
            <ExportButton onExport={onExport} busy={downloading} handoutLocked={!planHasFeature(plan, "handout")} />
          </span>
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
          canReorder={planHasFeature(plan, "reorder")}
          onLockedReorder={() => requireFeatureOrUpgrade("reorder", "Reordering slides is a Pro feature. Upgrade to rearrange your deck.", () => {})}
        />

        <div className="min-w-0">
          <div
            className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-exdeck-chart")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData("application/x-exdeck-chart");
              if (!raw) return;
              e.preventDefault();
              try {
                const spec = JSON.parse(raw) as ChartSpec;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 13.333;
                const y = ((e.clientY - rect.top) / rect.height) * 7.5;
                addChartToCurrent(spec, x, y);
              } catch { /* ignore malformed drop */ }
            }}
          >
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
              onEditChart={editChartElement}
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
              watermark={planShowsWatermark(plan)}
              onWatermarkClick={() => { setUpgradeReason("Upgrade to remove the \u201CMade with EXdeck\u201D watermark from your slides and exports."); setUpgradeOpen(true); }}
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

          <div className="mt-4" data-tour="tour-ask-ai">
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

        <div className="rounded-2xl border border-white/10 bg-zinc-950/60" data-tour="tour-styles">
          <DesignerPanel
            slide={deck.slides[active]}
            theme={theme}
            deck={deck}
            onUpdate={updateActive}
            onReplace={replaceActive}
            selectedImageId={selectedImageId}
            onDeselectImage={() => setSelectedImageId(null)}
            relatedImages={relatedImages}
            relatedLoading={relatedLoading}
            onReplaceImage={(photo) => { if (selectedImageId) replaceImageWith(selectedImageId, photo); }}
            onSearchImages={() => {
              if (!selectedImageId) return;
              setImageReplaceId(selectedImageId);
              setImageQuery(deck.slides[active]?.title || deck.topic || deck.title || "");
              setImagesOpen(true);
            }}
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
        onAddPhoto={openAddImages}
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
        onTranslate={() => requireFeatureOrUpgrade("translate", "Translation is a Pro Plus feature. Upgrade to translate decks.", () => setTranslateOpen(true))}
        translating={translating}
        onQAPrep={() => requireFeatureOrUpgrade("qaPrep", "Q&A prep is a Pro feature. Upgrade to use it.", () => setQaOpen(true))}
        translateLocked={!planHasFeature(plan, "translate")}
        qaLocked={!planHasFeature(plan, "qaPrep")}
        onAddVisuals={() => { setEditingChart(null); setVisualsOpen(true); }}
        onGenerateNotes={() => {
          if (hasNotes) { setNotesViewOpen(true); return; }
          requireFeatureOrUpgrade("speakerNotes", "Speaker notes are a Pro feature. Upgrade to generate them.", () => setNotesMenuOpen(true));
        }}
        notesLoading={notesState === "loading"}
        notesLabel={notesState === "loading" ? "Writing notes…" : notesState === "error" ? "Try again" : hasNotes ? "Show notes" : "Generate notes"}
        onOpenTheme={() => setThemeTransferOpen(true)}
        onOpenPattern={() => setPatternOpen(true)}
        themeAvailable={!!setTheme}
      />

      <VisualsDrawer
        open={visualsOpen}
        onClose={() => { setVisualsOpen(false); setEditingChart(null); }}
        theme={theme}
        editing={editingChart}
        getToken={() => getIdToken()}
        onInsertCurrent={(spec) => addChartToCurrent(spec)}
        onInsertNewSlide={(spec) => addChartNewSlide(spec)}
        onUpdate={(id, spec) => updateChartElement(id, spec)}
      />

      <ImagesDrawer
        open={imagesOpen}
        onClose={() => { setImagesOpen(false); setImageReplaceId(null); }}
        initialQuery={imageQuery}
        replacing={!!imageReplaceId}
        onPick={onPickImage}
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
 * Shown once before a user's first export. EXdeck is free — instead of
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
            One quick thing before your first download: a short, honest
            review. The good ones get featured on the homepage.
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
  open, onToggle, theme, placingText, onStartPlaceText, onAddImage, onAddPhoto,
  selectedText, onUpdateText, onDeleteText, onClearSelection,
  decoSelection, decoState, onUpdateDeco, onDeleteDeco,
  elementSelection, elementSize, elementText, onUpdateElementSize, onFormatElement, onResetElement, onDeleteElement,
  onTranslate, translating,
  onQAPrep, translateLocked, qaLocked, onAddVisuals,
  onGenerateNotes, notesLoading, notesLabel, onOpenTheme, onOpenPattern, themeAvailable,
}: {
  open: boolean;
  onToggle: () => void;
  theme: Theme;
  placingText: boolean;
  onStartPlaceText: () => void;
  onAddImage: () => void;
  onAddPhoto: () => void;
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
  onTranslate: () => void;
  translating: boolean;
  onQAPrep: () => void;
  translateLocked: boolean;
  qaLocked: boolean;
  onAddVisuals: () => void;
  onGenerateNotes: () => void;
  notesLoading: boolean;
  notesLabel: string;
  onOpenTheme: () => void;
  onOpenPattern: () => void;
  themeAvailable: boolean;
}) {
  const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 54, 72];
  const COLORS = ["", theme.fg, theme.accent, "#0F172A", "#FFFFFF", "#22D3EE", "#1D4ED8", "#DC2626", "#F59E0B", "#047857", "#7C3AED"];
  const decoActive = decoSelection?.kind === "deco";
  const elementActive = !!elementSelection;
  const panelTitle = selectedText ? "Text settings" : decoActive ? "Element settings" : elementActive ? "Text settings" : "Slide tools";

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
              <button
                onClick={onAddPhoto}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.06]"
              >
                <ImageIcon size={16} />
                <span className="flex-1">
                  <span className="block font-medium">Search photos</span>
                  <span className="block text-[11px] text-white/45">Find a stock image (Pexels)</span>
                </span>
              </button>
              <button
                onClick={onAddVisuals}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.06]"
              >
                <BarChart3 size={16} />
                <span className="flex-1">
                  <span className="block font-medium">Add visuals</span>
                  <span className="block text-[11px] text-white/45">Charts &amp; graphs from your data or a topic</span>
                </span>
              </button>
              <button
                onClick={onTranslate}
                disabled={translating}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.06] disabled:opacity-60"
              >
                {translating ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
                <span className="flex-1">
                  <span className="block font-medium">{translating ? "Translating…" : "Translate deck"}</span>
                  <span className="block text-[11px] text-white/45">Rewrite every slide in another language</span>
                </span>
                {translateLocked && !translating && <Lock size={14} className="text-white/40" />}
              </button>
              <button
                onClick={onQAPrep}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.06]"
              >
                <MessageCircleQuestion size={16} />
                <span className="flex-1">
                  <span className="block font-medium">Prep for Q&amp;A</span>
                  <span className="block text-[11px] text-white/45">Likely questions, answers, and ask your own</span>
                </span>
                {qaLocked && <Lock size={14} className="text-white/40" />}
              </button>
              <button
                onClick={onGenerateNotes}
                disabled={notesLoading}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.06] disabled:opacity-60"
              >
                {notesLoading ? <Loader2 size={16} className="animate-spin" /> : <NotebookText size={16} />}
                <span className="flex-1">
                  <span className="block font-medium">{notesLabel}</span>
                  <span className="block text-[11px] text-white/45">Spoken speaker notes for every slide</span>
                </span>
              </button>
              {themeAvailable && (
                <button
                  onClick={onOpenTheme}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.06]"
                >
                  <span className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ background: theme.accent, boxShadow: "0 0 0 1px rgba(255,255,255,0.25)" }} />
                  <span className="flex-1">
                    <span className="block font-medium">Theme</span>
                    <span className="block text-[11px] text-white/45">Recolor the whole deck</span>
                  </span>
                </button>
              )}
              <button
                onClick={onOpenPattern}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.06]"
              >
                <Grid3x3 size={16} />
                <span className="flex-1">
                  <span className="block font-medium">Background pattern</span>
                  <span className="block text-[11px] text-white/45">Add a subtle pattern to this slide</span>
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

/* ----------------------- Speaker notes: mode picker ----------------------- */

/** First step after clicking Generate notes: choose quick (one presenter) or
 *  split-by-speaker. Rendered as a centered modal so it can't be clipped by
 *  the scrollable toolbar. */
function NotesModeDialog({
  onClose, onQuick, onCustom,
}: {
  onClose: () => void;
  onQuick: () => void;
  onCustom: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{ background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", borderColor: "var(--ezd-hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <NotebookText size={18} className="text-emerald-300" />
          <h2 className="text-lg font-semibold">Generate speaker notes</h2>
        </div>
        <p className="mb-5 text-[13px] leading-relaxed text-white/55">
          Write a spoken script for every slide. Choose how you're presenting.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onQuick}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
          >
            <div className="text-sm font-medium">Quick notes</div>
            <div className="text-[12px] text-white/45">One presenter, whole deck</div>
          </button>
          <button
            onClick={onCustom}
            className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-left hover:bg-emerald-400/20"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-100">
              <Users size={14} /> Split by speaker
            </div>
            <div className="text-[12px] text-emerald-200/50">Divide the script across a group of presenters</div>
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Speaker notes: custom dialog ----------------------- */
/**
 * Collects who's presenting before generating split-by-speaker notes:
 * the setting/occasion and an ordered list of presenter names. The AI
 * divides each slide's spoken script across these people.
 */
function CustomNotesDialog({
  onClose, onGenerate,
}: {
  onClose: () => void;
  onGenerate: (speakers: string[], setting: string) => void;
}) {
  const [setting, setSetting] = useState("");
  const [names, setNames] = useState<string[]>(["", ""]);

  const setName = (i: number, v: string) =>
    setNames((arr) => arr.map((n, j) => (j === i ? v : n)));
  const addName = () => setNames((arr) => (arr.length >= 8 ? arr : [...arr, ""]));
  const removeName = (i: number) =>
    setNames((arr) => (arr.length <= 2 ? arr : arr.filter((_, j) => j !== i)));

  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  const canGenerate = cleaned.length >= 2;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{ background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", borderColor: "var(--ezd-hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Users size={18} className="text-emerald-300" />
          <h2 className="text-lg font-semibold">Split notes by speaker</h2>
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-white/55">
          Tell us who's presenting and the setting. We'll write the spoken
          script and divide it across the team, slide by slide.
        </p>

        <label className="mb-1.5 block text-[12px] font-medium text-white/70">
          Setting or occasion
        </label>
        <input
          value={setting}
          onChange={(e) => setSetting(e.target.value)}
          placeholder="e.g. class presentation, team standup, conference panel"
          className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-emerald-400/40"
        />

        <label className="mb-1.5 block text-[12px] font-medium text-white/70">
          Presenters <span className="text-white/40">(in speaking order)</span>
        </label>
        <div className="flex flex-col gap-2">
          {names.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/8 text-[12px] text-white/60">
                {i + 1}
              </span>
              <input
                value={n}
                onChange={(e) => setName(i, e.target.value)}
                placeholder={`Speaker ${i + 1} name`}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-emerald-400/40"
              />
              <button
                onClick={() => removeName(i)}
                disabled={names.length <= 2}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30"
                title="Remove speaker"
              >
                <Minus size={14} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addName}
          disabled={names.length >= 8}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 text-[13px] text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
        >
          <Plus size={14} /> Add speaker
        </button>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(cleaned, setting.trim())}
            disabled={!canGenerate}
            className="rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generate
          </button>
        </div>
        {!canGenerate && (
          <p className="mt-2 text-right text-[11px] text-white/35">Add at least two names.</p>
        )}
      </div>
    </div>
  );
}

/* ----------------------- Speaker notes: view modal ----------------------- */

/** Read-only view of the generated speaker notes for the whole deck, grouped
 *  by speaker when the notes were split for a group presentation. */
function NotesViewModal({
  deck, onClose, onRegenerate,
}: {
  deck: Deck;
  onClose: () => void;
  onRegenerate: () => void;
}) {
  const plainText = (s?: string) =>
    (s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", borderColor: "var(--ezd-hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div className="flex items-center gap-2">
            <NotebookText size={18} className="text-emerald-300" />
            <h2 className="text-lg font-semibold">Speaker notes</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRegenerate}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] hover:bg-white/10"
            >
              Regenerate
            </button>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          {deck.slides.map((s, i) => {
            const script = plainText(s.notes);
            return (
              <div key={i} className="mb-5 last:mb-1">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="grid h-6 min-w-6 place-items-center rounded-md bg-white/8 px-1.5 text-[11px] font-medium text-white/55">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-semibold text-white/80">
                    {plainText(s.title) || `Slide ${i + 1}`}
                  </span>
                </div>
                {s.noteSegments && s.noteSegments.length > 0 ? (
                  <div className="flex flex-col gap-2 pl-8">
                    {s.noteSegments.map((seg, j) => (
                      <div key={j}>
                        <span className="text-[12px] font-semibold text-emerald-300">{seg.speaker}</span>
                        <p className="mt-0.5 text-[14px] leading-relaxed text-white/75">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                ) : script ? (
                  <p className="pl-8 text-[14px] leading-relaxed text-white/75">{script}</p>
                ) : (
                  <p className="pl-8 text-[13px] italic text-white/35">No notes for this slide.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Translate dialog ---------------------------- */

const COMMON_LANGUAGES = [
  "Spanish", "French", "German", "Hindi", "Arabic", "Portuguese",
  "Mandarin Chinese", "Japanese", "Korean", "Russian", "Italian", "Urdu",
];

/** Pick a target language (preset chips or free text), then translate the
 *  whole deck in place. Theme-aware so it reads in light and dark. */
function TranslateDialog({
  busy, onClose, onTranslate,
}: {
  busy: boolean;
  onClose: () => void;
  onTranslate: (language: string) => void;
}) {
  const [lang, setLang] = useState("");

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
        style={{ background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", borderColor: "var(--ezd-hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Languages size={18} className="text-cyan-300" />
          <h2 className="text-lg font-semibold">Translate deck</h2>
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-white/55">
          Rewrites every slide, including titles, bullets, tables, and speaker
          notes, in your chosen language. Layout, theme, and charts stay the same.
        </p>

        <label className="mb-1.5 block text-[12px] font-medium text-white/70">Language</label>
        <input
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          placeholder="Type a language, e.g. Spanish"
          disabled={busy}
          className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-cyan-400/40 disabled:opacity-60"
        />

        <div className="mb-5 flex flex-wrap gap-1.5">
          {COMMON_LANGUAGES.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              disabled={busy}
              className={`rounded-full border px-2.5 py-1 text-[12px] transition disabled:opacity-50 ${
                lang === l
                  ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => onTranslate(lang)}
            disabled={busy || !lang.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/15 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
            {busy ? "Translating…" : "Translate"}
          </button>
        </div>
        {busy && (
          <p className="mt-3 text-center text-[11px] text-white/40">
            This can take a few seconds for a long deck.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Q&A prep -------------------------------- */

type QAItem = { category: string; question: string; answer: string };

/**
 * Q&A prep: generates likely audience questions with suggested answers, and
 * lets the user ask their own question and get a deck-grounded answer.
 * Self-contained — does its own API calls. Theme-aware.
 */
function QAPrepModal({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const [items, setItems] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Custom-question state.
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [custom, setCustom] = useState<QAItem[]>([]);

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/qa-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ deck, audience: deck.audience, tone: deck.tone }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items?: QAItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
      setLoaded(true);
    } catch (e) {
      console.error("[qaPrep] failed:", e);
      setError("Could not generate questions. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const ask = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/qa-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ deck, question: q, audience: deck.audience, tone: deck.tone }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { answer?: string };
      const answer = (data.answer || "").trim();
      if (answer) {
        setCustom((c) => [{ category: "Your question", question: q, answer }, ...c]);
        setQuestion("");
      } else {
        setError("No answer came back. Try rephrasing.");
      }
    } catch (e) {
      console.error("[qaPrep ask] failed:", e);
      setError("Could not answer that question. Try again.");
    } finally {
      setAsking(false);
    }
  };

  const all = [...custom, ...items];

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "var(--ezd-bg-elev)", color: "var(--ezd-fg)", borderColor: "var(--ezd-hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion size={18} className="text-amber-300" />
            <h2 className="text-lg font-semibold">Prep for Q&amp;A</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
          >
            <X size={15} />
          </button>
        </div>

        {/* Ask your own question */}
        <div className="border-b border-white/8 px-6 py-4">
          <label className="mb-1.5 block text-[12px] font-medium text-white/70">Ask your own question</label>
          <div className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              placeholder="e.g. How does this scale to 10k users?"
              disabled={asking}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-amber-400/40 disabled:opacity-60"
            />
            <button
              onClick={ask}
              disabled={asking || !question.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/15 px-3 py-2 text-sm text-amber-100 hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {asking ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Ask
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[12px] text-red-200">
              {error}
            </div>
          )}

          {!loaded && !loading && all.length === 0 && (
            <div className="py-6 text-center">
              <p className="mb-4 text-[13px] leading-relaxed text-white/55">
                Generate the toughest questions an audience or reviewer is likely
                to ask, each with a suggested answer grounded in your deck.
              </p>
              <button
                onClick={generate}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-2 text-sm text-amber-100 hover:bg-amber-400/25"
              >
                <MessageCircleQuestion size={15} /> Generate likely questions
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-white/55">
              <Loader2 size={16} className="animate-spin" /> Thinking through the tough ones…
            </div>
          )}

          {all.map((it, i) => (
            <div key={i} className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 last:mb-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55">
                  {it.category}
                </span>
              </div>
              <p className="text-[14px] font-semibold text-white/90">{it.question}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">{it.answer}</p>
            </div>
          ))}

          {loaded && items.length > 0 && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={generate}
                disabled={loading}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] hover:bg-white/10 disabled:opacity-60"
              >
                Regenerate questions
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
