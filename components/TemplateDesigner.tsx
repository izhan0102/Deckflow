"use client";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ImagePlus, Loader2, Save, Shapes, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import type { AppUser } from "@/lib/auth";
import type { Slide, UploadedImage } from "@/lib/types";
import type { Theme } from "@/lib/themes";
import { FONT_PRESETS } from "@/lib/fonts";
import { SLIDE_PATTERNS } from "@/lib/patterns";
import { GRAPHICS } from "@/lib/graphics";
import { iconifySvgUrl } from "@/lib/iconify";
import { saveCustomTemplate, type CustomTemplate, type TemplateBackground } from "@/lib/customTemplates";
import SlideCanvas from "./SlideCanvas";
import DecorationDrawer from "./DecorationDrawer";

/**
 * Full-screen template designer. The user builds a reusable visual identity
 * — colors, per-role fonts, a background (pattern / graphic / uploaded
 * image), and decorative icons/images — then saves it to their account.
 * A live slide preview reflects every change.
 */
type Mode = "choose" | "design";

const SAMPLE_SLIDE: Slide = {
  layout: "title-hero",
  titleVariant: "underlined",
  kicker: "YOUR TEMPLATE",
  title: "Your big idea, your way",
  subtitle: "A reusable look the AI will follow on every deck.",
};

const COLOR_SWATCHES = [
  "#0A0A0A", "#FFFFFF", "#0F172A", "#1D4ED8", "#0E7490", "#047857",
  "#DC2626", "#F59E0B", "#7C3AED", "#BE123C", "#334155", "#FAFAF7",
  "#111827", "#22D3EE", "#EC4899", "#10B981",
];

export default function TemplateDesigner({
  user, initial, onClose, onSaved,
}: {
  user: AppUser;
  initial?: CustomTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initial ? "design" : "choose");

  // ---- design state ----
  const [name, setName] = useState(initial?.name || "My template");
  const [colors, setColors] = useState(initial?.colors || {
    bg: "#0B1220", fg: "#FFFFFF", accent: "#22D3EE", muted: "#94A3B8",
  });
  const [fontCategory, setFontCategory] = useState<"sans" | "serif" | "mono">(initial?.fontCategory || "sans");
  const [fonts, setFonts] = useState(initial?.fonts || { title: "bricolage", subtitle: "inter", kicker: "inter", body: "inter" });
  const [background, setBackground] = useState<TemplateBackground>(initial?.background || { kind: "none" });
  const [decorations, setDecorations] = useState<UploadedImage[]>(initial?.decorations || []);
  const [iconDrawer, setIconDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDeco, setSelectedDeco] = useState<string | null>(null);

  const bgFileRef = useRef<HTMLInputElement>(null);
  const imgFileRef = useRef<HTMLInputElement>(null);

  const theme: Theme = useMemo(() => ({
    id: "custom-preview", name, bg: colors.bg, fg: colors.fg,
    accent: colors.accent, muted: colors.muted, font: fontCategory,
  }), [name, colors, fontCategory]);

  // Build the preview slide with the same overrides applyCustomTemplate uses.
  const previewSlide: Slide = useMemo(() => {
    const tplBg: UploadedImage[] = [];
    if (background.kind === "image" && background.imageDataUrl) {
      tplBg.push({
        id: "preview-bg", kind: "templateBg", dataUrl: background.imageDataUrl,
        opacity: background.imageOpacity ?? 1, x: 0, y: 0, w: 13.333, h: 7.5,
      });
    }
    return {
      ...SAMPLE_SLIDE,
      templateFonts: fonts,
      pattern: background.kind === "pattern" && background.patternId
        ? { id: background.patternId, color: background.patternColor || colors.fg, opacity: background.patternOpacity ?? 0.08 }
        : undefined,
      uploadedImages: [...tplBg, ...decorations],
    };
  }, [background, fonts, decorations, colors.fg]);

  const previewGraphic = background.kind === "graphic" ? (background.graphicId || "none") : "none";

  /* ----------------------------- handlers ----------------------------- */

  const onUploadBg = (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Choose an image file."); return; }
    if (file.size > 4 * 1024 * 1024) { alert("Image is over 4MB. Choose a smaller one."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setBackground({ kind: "image", imageDataUrl: String(reader.result || ""), imageOpacity: 1 });
    };
    reader.readAsDataURL(file);
  };

  const onUploadDecoImage = (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Choose an image file."); return; }
    if (file.size > 4 * 1024 * 1024) { alert("Image is over 4MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const probe = new window.Image();
      probe.onload = () => {
        const w = 3;
        const h = (probe.height / probe.width) * w;
        addDeco({
          id: `img_${Date.now().toString(36)}`, kind: "user", dataUrl,
          x: (13.333 - w) / 2, y: (7.5 - h) / 2, w, h, opacity: 1,
        });
      };
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const addDeco = (img: UploadedImage) => {
    setDecorations((d) => [...d, img]);
    setSelectedDeco(img.id);
  };
  const updateDeco = (id: string, patch: Partial<UploadedImage>) =>
    setDecorations((d) => d.map((x) => x.id === id ? { ...x, ...patch } : x));
  const removeDeco = (id: string) =>
    setDecorations((d) => d.filter((x) => x.id !== id));

  const save = async () => {
    setSaving(true);
    try {
      await saveCustomTemplate(user.uid, {
        id: initial?.id,
        name: name.trim() || "My template",
        colors, fontCategory, fonts, background, decorations,
      });
      onSaved();
    } catch (e: any) {
      alert(e?.message || "Couldn't save the template.");
      setSaving(false);
    }
  };

  const activeDeco = decorations.find((d) => d.id === selectedDeco) || null;

  /* ------------------------------ choose ------------------------------ */

  if (mode === "choose") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-lg rounded-2xl border border-white/12 bg-zinc-950 p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-white">Design your own template</h2>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/55 hover:bg-white/10"><X size={15} /></button>
          </div>
          <p className="mt-1.5 text-[13px] text-white/55">How do you want to start?</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button onClick={() => setMode("design")} className="flex flex-col items-start gap-2 rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-left transition hover:border-white/35 hover:bg-white/[0.06]">
              <Sparkles size={20} className="text-cyan-300" />
              <span className="text-[14px] font-semibold text-white">Start from scratch</span>
              <span className="text-[12px] text-white/55">Pick colors, fonts, background and decorations yourself.</span>
            </button>
            <button onClick={() => { setBackground({ kind: "image" }); setMode("design"); setTimeout(() => bgFileRef.current?.click(), 50); }} className="flex flex-col items-start gap-2 rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-left transition hover:border-white/35 hover:bg-white/[0.06]">
              <Upload size={20} className="text-cyan-300" />
              <span className="text-[14px] font-semibold text-white">Upload a background</span>
              <span className="text-[12px] text-white/55">Use your own PNG/JPG as the slide background, then style on top.</span>
            </button>
          </div>
          <input ref={bgFileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadBg(f); if (bgFileRef.current) bgFileRef.current.value = ""; }} />
        </div>
      </div>
    );
  }

  /* ------------------------------ design ------------------------------ */

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: "var(--ezd-bg-page)" }}>
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-[13px] text-white/65 hover:text-white">
          <ArrowLeft size={14} /> Back
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mx-auto w-56 rounded-lg border border-white/12 bg-black/40 px-3 py-1.5 text-center text-[13px] font-medium text-white outline-none focus:border-white/30"
          placeholder="Template name"
        />
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-[#03070F] transition hover:bg-white/90 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving…" : "Save template"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Preview */}
        <div className="flex flex-1 items-center justify-center p-5">
          <div className="w-full max-w-[760px]">
            <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
              <SlideCanvas
                slide={previewSlide}
                theme={theme}
                idx={0}
                total={1}
                deckTitle={name}
                graphicId={previewGraphic}
                graphicAccent={background.kind === "graphic" ? background.graphicAccent : undefined}
                fontId={fonts.body}
                interactive
                onUpdate={(patch) => {
                  // The canvas edits uploadedImages (drag/resize/delete). Sync
                  // those changes back into our decoration state, ignoring the
                  // full-bleed template background entry.
                  if (patch.uploadedImages) {
                    setDecorations(patch.uploadedImages.filter((im) => im.kind !== "templateBg"));
                  }
                }}
                selectedImageId={selectedDeco}
                onSelectImage={setSelectedDeco}
              />
            </div>
            <p className="mt-3 text-center text-[12px] text-white/45">
              Live preview · the AI will follow this look on every slide it generates.
            </p>
          </div>
        </div>

        {/* Controls */}
        <aside className="w-full shrink-0 overflow-y-auto border-t border-white/10 p-5 lg:w-[360px] lg:border-l lg:border-t-0">
          {/* Colors */}
          <Section title="Colors">
            <ColorRow label="Background" value={colors.bg} onChange={(v) => setColors((c) => ({ ...c, bg: v }))} />
            <ColorRow label="Text" value={colors.fg} onChange={(v) => setColors((c) => ({ ...c, fg: v }))} />
            <ColorRow label="Accent" value={colors.accent} onChange={(v) => setColors((c) => ({ ...c, accent: v }))} />
            <ColorRow label="Muted text" value={colors.muted} onChange={(v) => setColors((c) => ({ ...c, muted: v }))} />
          </Section>

          {/* Fonts */}
          <Section title="Fonts">
            <FontRow label="Title" value={fonts.title} onChange={(v) => setFonts((f) => ({ ...f, title: v }))} />
            <FontRow label="Subtitle" value={fonts.subtitle} onChange={(v) => setFonts((f) => ({ ...f, subtitle: v }))} />
            <FontRow label="Kicker" value={fonts.kicker} onChange={(v) => setFonts((f) => ({ ...f, kicker: v }))} />
            <FontRow label="Body / bullets" value={fonts.body} onChange={(v) => setFonts((f) => ({ ...f, body: v }))} />
          </Section>

          {/* Background */}
          <Section title="Background">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(["none", "pattern", "graphic", "image"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setBackground((b) => ({ ...b, kind: k }))}
                  className={`rounded-full border px-3 py-1 text-[11px] capitalize transition ${
                    background.kind === k ? "border-white/60 bg-white/10 text-white" : "border-white/12 bg-white/5 text-white/65 hover:bg-white/10"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {background.kind === "pattern" && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {SLIDE_PATTERNS.map((p) => {
                    const active = background.patternId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setBackground((b) => ({ ...b, patternId: p.id }))}
                        className={`overflow-hidden rounded-lg border ${active ? "border-white" : "border-white/12"}`}
                        title={p.name}
                      >
                        <div className="h-12" style={{ background: colors.bg }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(p.render(colors.fg))}`} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.4 }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <OpacityRow label="Pattern opacity" value={background.patternOpacity ?? 0.08} min={0.02} max={0.6} onChange={(v) => setBackground((b) => ({ ...b, patternOpacity: v }))} />
                <ColorRow label="Pattern color" value={background.patternColor || colors.fg} onChange={(v) => setBackground((b) => ({ ...b, patternColor: v }))} />
              </>
            )}

            {background.kind === "graphic" && (
              <div className="grid grid-cols-3 gap-2">
                {GRAPHICS.slice(0, 18).map((g) => {
                  const active = background.graphicId === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setBackground((b) => ({ ...b, graphicId: g.id }))}
                      className={`overflow-hidden rounded-lg border ${active ? "border-white" : "border-white/12"}`}
                      title={g.name}
                    >
                      <div className="h-12" style={{ background: colors.bg }} dangerouslySetInnerHTML={{ __html: g.render({ ...theme }).replace(/^<svg /, '<svg style="display:block;width:100%;height:100%;" ') }} />
                    </button>
                  );
                })}
              </div>
            )}

            {background.kind === "image" && (
              <div>
                {background.imageDataUrl ? (
                  <div className="overflow-hidden rounded-lg border border-white/12">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={background.imageDataUrl} alt="background" className="h-24 w-full object-cover" />
                  </div>
                ) : (
                  <p className="text-[12px] text-white/45">No image yet.</p>
                )}
                <button onClick={() => bgFileRef.current?.click()} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10">
                  <Upload size={12} /> {background.imageDataUrl ? "Replace image" : "Upload image"}
                </button>
                <input ref={bgFileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadBg(f); if (bgFileRef.current) bgFileRef.current.value = ""; }} />
                {background.imageDataUrl && (
                  <OpacityRow label="Image opacity" value={background.imageOpacity ?? 1} min={0.1} max={1} onChange={(v) => setBackground((b) => ({ ...b, imageOpacity: v }))} />
                )}
              </div>
            )}
          </Section>

          {/* Decorations */}
          <Section title="Decorations">
            <div className="flex gap-2">
              <button onClick={() => setIconDrawer(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10">
                <Shapes size={12} /> Add icon
              </button>
              <button onClick={() => imgFileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10">
                <ImagePlus size={12} /> Add image
              </button>
              <input ref={imgFileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadDecoImage(f); if (imgFileRef.current) imgFileRef.current.value = ""; }} />
            </div>

            {decorations.length > 0 && (
              <div className="mt-3 space-y-2">
                {decorations.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDeco(d.id === selectedDeco ? null : d.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${
                      selectedDeco === d.id ? "border-white/50 bg-white/10" : "border-white/12 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded bg-white/5">
                      {d.kind === "icon" && d.iconId
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={iconifySvgUrl(d.iconId, colors.accent)} alt="" className="h-4 w-4" />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={d.dataUrl} alt="" className="h-5 w-5 object-contain" />}
                    </span>
                    <span className="flex-1 truncate text-white/80">{d.kind === "icon" ? (d.iconId || "icon") : "image"}</span>
                    <span onClick={(e) => { e.stopPropagation(); removeDeco(d.id); if (selectedDeco === d.id) setSelectedDeco(null); }} className="text-red-300 hover:text-red-200"><Trash2 size={13} /></span>
                  </button>
                ))}
              </div>
            )}

            {activeDeco && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <OpacityRow label="Opacity" value={activeDeco.opacity ?? 1} min={0.1} max={1} onChange={(v) => updateDeco(activeDeco.id, { opacity: v })} />
                <div className="mt-2">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/45">Size</div>
                  <input type="range" min={0.5} max={6} step={0.1} value={activeDeco.w}
                    onChange={(e) => { const w = Number(e.target.value); const ratio = activeDeco.h / activeDeco.w; updateDeco(activeDeco.id, { w, h: w * ratio }); }}
                    className="w-full accent-cyan-400" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <PosRow label="X" value={activeDeco.x} max={13.333} onChange={(v) => updateDeco(activeDeco.id, { x: v })} />
                  <PosRow label="Y" value={activeDeco.y} max={7.5} onChange={(v) => updateDeco(activeDeco.id, { y: v })} />
                </div>
              </div>
            )}
          </Section>
        </aside>
      </div>

      <DecorationDrawer
        open={iconDrawer}
        theme={theme}
        initialMode="icons"
        onClose={() => setIconDrawer(false)}
        onPick={(pick) => {
          if (pick.kind === "icon") {
            addDeco({ id: `icon_${Date.now().toString(36)}`, kind: "icon", iconId: pick.iconId, dataUrl: "", x: 1, y: 1, w: 1.4, h: 1.4, opacity: 1, colorOverrides: { accent: colors.accent } });
          }
        }}
      />
    </div>
  );
}

/* ----------------------------- small UI bits ----------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{title}</div>
      {children}
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] text-white/70">{label}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-9 cursor-pointer rounded border border-white/15 bg-transparent" />
      </div>
      <div className="flex flex-wrap gap-1">
        {COLOR_SWATCHES.map((c) => (
          <button key={c} onClick={() => onChange(c)} className="h-5 w-5 rounded-full border" style={{ background: c, borderColor: value.toLowerCase() === c.toLowerCase() ? "#fff" : "rgba(255,255,255,0.2)" }} aria-label={c} />
        ))}
      </div>
    </div>
  );
}

function FontRow({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <span className="text-[12px] text-white/70">{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-40 rounded-lg border border-white/12 bg-black/40 px-2 py-1.5 text-[12px] text-white outline-none focus:border-white/30">
        {FONT_PRESETS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </div>
  );
}

function OpacityRow({ label, value, onChange, min = 0, max = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/45">
        <span>{label}</span><span>{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={min} max={max} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-cyan-400" />
    </div>
  );
}

function PosRow({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      <input type="range" min={0} max={max} step={0.1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-cyan-400" />
    </div>
  );
}
